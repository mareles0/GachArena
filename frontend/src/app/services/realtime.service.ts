import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { EventService, AppEvent } from './event.service';
import { AuthService } from './auth.service';

type AppEventPayload = { type: AppEvent };

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private socket?: Socket;
  private started = false;

  constructor(private eventService: EventService, private authService: AuthService) {}

  connect(): void {
    if (this.started) return;
    this.started = true;

    const serverUrl = environment.backendUrl.replace(/\/api\/?$/, '');

    this.socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true
    });

    this.socket.on('connect', () => {
      console.log('[Realtime] Conectado ao servidor:', this.socket?.id);
      // Prefetch imediato ao conectar/reconectar para aquecer cache
      this.authService.getCurrentUser().then(user => {
        if (user && user.uid) {
          this.authService.prefetchUserData(user.uid).catch(err => console.warn('[Realtime] Prefetch error on connect:', err));
        }
      }).catch(() => {});
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[Realtime] Desconectado:', reason);
    });

    this.socket.on('appEvent', (payload: AppEventPayload) => {
      const type = payload?.type as AppEvent | undefined;
      if (!type) return;
      console.log('[Realtime] Evento recebido do servidor:', type);
      this.eventService.emit(type);
    });

    // opcional: prefetch também ao reconectar
    this.socket.on('reconnect', (attempt: number) => {
      console.log('[Realtime] Reconnect attempt:', attempt);
      this.authService.getCurrentUser().then(user => {
        if (user && user.uid) {
          this.authService.prefetchUserData(user.uid).catch(err => console.warn('[Realtime] Prefetch error on reconnect:', err));
        }
      }).catch(() => {});
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.started = false;
  }
}
