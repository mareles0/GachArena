import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import { AppEvent, EventService } from '../services/event.service';

@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  private cache = new Map<string, { response: HttpResponse<any>, timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  private pendingEvents = new Set<AppEvent>();
  private invalidateTimer?: any;

  constructor(private eventService: EventService) {
    // Quando algo muda no app, invalidar os caches relacionados.
    // Isso evita telas “presas” em dados antigos por até 5 minutos.
    this.eventService.events$.subscribe((event) => this.queueInvalidate(event));
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Apenas cachear requisições GET
    if (req.method !== 'GET') {
      return next.handle(req);
    }

    // Verificar se existe cache válido
    const cached = this.cache.get(req.urlWithParams);
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`[Cache] Retornando do cache: ${req.urlWithParams}`);
      return of(cached.response.clone());
    }

    // Fazer a requisição e cachear
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          console.log(`[Cache] Armazenando no cache: ${req.urlWithParams}`);
          this.cache.set(req.urlWithParams, {
            response: event.clone(),
            timestamp: Date.now()
          });
        }
      }),
      shareReplay(1) // Compartilhar a resposta com múltiplas inscrições
    );
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  clearCache() {
    console.log('[Cache] Limpando todo o cache');
    this.cache.clear();
  }

  clearCacheByUrl(url: string) {
    console.log(`[Cache] Limpando cache para: ${url}`);
    this.cache.delete(url);
  }

  private invalidateCacheForEvent(event: AppEvent) {
    switch (event) {
      case 'missionsChanged':
        this.clearCacheBySubstring('/missions');
        break;
      case 'itemsChanged':
        this.clearCacheBySubstring('/items');
        this.clearCacheBySubstring('/userItems');
        this.clearCacheBySubstring('/boxes');
        break;
      case 'tradesChanged':
        this.clearCacheBySubstring('/trades');
        break;
      case 'ticketsChanged':
        // tickets normalmente ficam sob /users/.../tickets
        this.clearCacheBySubstring('/tickets');
        this.clearCacheBySubstring('/users');
        break;
      case 'userDataChanged':
        this.clearCacheBySubstring('/users');
        this.clearCacheBySubstring('/rankings');
        break;
      case 'boxesOpened':
        this.clearCacheBySubstring('/boxes');
        this.clearCacheBySubstring('/items');
        this.clearCacheBySubstring('/userItems');
        this.clearCacheBySubstring('/users');
        break;
      default:
        // AppEvent é uma union; não deve cair aqui.
        break;
    }
  }

  private queueInvalidate(event: AppEvent) {
    this.pendingEvents.add(event);
    if (this.invalidateTimer) return;

    // Coalescer eventos em janela pequena evita thrash de rede/render.
    this.invalidateTimer = setTimeout(() => {
      const events = Array.from(this.pendingEvents);
      this.pendingEvents.clear();
      this.invalidateTimer = undefined;

      for (const ev of events) {
        this.invalidateCacheForEvent(ev);
      }
    }, 75);
  }

  private clearCacheBySubstring(substring: string) {
    const keys = Array.from(this.cache.keys());
    const matching = keys.filter(k => k.includes(substring));
    if (matching.length === 0) return;

    console.log(`[Cache] Invalidando ${matching.length} entradas por evento. Substring: ${substring}`);
    for (const key of matching) {
      this.cache.delete(key);
    }
  }
}
