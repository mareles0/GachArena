import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type AppEvent = 
  | 'itemsChanged'
  | 'ticketsChanged'
  | 'missionsChanged'
  | 'tradesChanged'
  | 'userDataChanged'
  | 'boxesChanged'
  | 'boxesOpened';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private eventSubject = new Subject<AppEvent>();
  public events$ = this.eventSubject.asObservable();

  constructor() {
    console.log('[EventService] Serviço de eventos inicializado');
  }

  emit(event: AppEvent) {
    console.log('[EventService] Evento emitido:', event);
    this.eventSubject.next(event);
  }

  itemsChanged() {
    this.emit('itemsChanged');
  }

  ticketsChanged() {
    this.emit('ticketsChanged');
  }

  missionsChanged() {
    this.emit('missionsChanged');
  }

  tradesChanged() {
    this.emit('tradesChanged');
  }

  userDataChanged() {
    this.emit('userDataChanged');
  }

  boxesOpened() {
    this.emit('boxesOpened');
  }

  boxesChanged() {
    this.emit('boxesChanged');
  }
}
