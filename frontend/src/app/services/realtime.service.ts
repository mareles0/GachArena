import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { EventService, AppEvent } from './event.service';

type AppEventPayload = { type: AppEvent };

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private socket?: Socket;
  private started = false;

  constructor(private eventService: EventService) {}

  connect(): void {
    if (this.started) return;
    this.started = true;

    // backendUrl vem como http://localhost:3000/api
    const serverUrl = environment.backendUrl.replace(/\/api\/?$/, '');

    this.socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true
    });

    this.socket.on('connect', () => {
      console.log('[Realtime] Conectado ao servidor:', this.socket?.id);
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
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.started = false;
  }
}
