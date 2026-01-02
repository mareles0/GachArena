import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type AppEvent = 
  | 'itemsChanged'      // Quando itens são adicionados/removidos
  | 'ticketsChanged'    // Quando tickets são usados/adicionados
  | 'missionsChanged'   // Quando missões são completadas/atualizadas
  | 'tradesChanged'     // Quando trades são criadas/aceitas
  | 'userDataChanged'   // Quando dados do usuário mudam (power, stats)
  | 'boxesOpened';      // Quando caixas são abertas

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

  // Métodos helper para emitir eventos específicos
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
}
