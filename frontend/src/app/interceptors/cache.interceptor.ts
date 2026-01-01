import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  private cache = new Map<string, { response: HttpResponse<any>, timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

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
}
