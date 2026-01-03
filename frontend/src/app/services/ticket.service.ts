import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { Ticket } from '../models/ticket.model';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private ticketsSubject = new BehaviorSubject<Ticket>({ normalTickets: 0, premiumTickets: 0 });
  public tickets$ = this.ticketsSubject.asObservable();

  constructor(private http: HttpClient) { }

  async getUserTickets(userId: string): Promise<Ticket> {
    const tickets = await this.http.get(`${environment.backendUrl}/users/${userId}/tickets`).toPromise() as Ticket;
    this.ticketsSubject.next(tickets);
    return tickets;
  }

  async useTicket(userId: string, type: 'NORMAL' | 'PREMIUM', count: number = 1): Promise<boolean> {
    try {
      console.log('[TicketService] Fazendo POST use-ticket:', userId, type, count);
      await this.http.post(`${environment.backendUrl}/users/${userId}/use-ticket`, { type, count }).toPromise();
      console.log('[TicketService] POST use-ticket completado');
      const tickets = this.ticketsSubject.value;
      if (type === 'NORMAL' && tickets.normalTickets >= count) {
        this.ticketsSubject.next({
          ...tickets,
          normalTickets: tickets.normalTickets - count
        });
      } else if (type === 'PREMIUM' && tickets.premiumTickets >= count) {
        this.ticketsSubject.next({
          ...tickets,
          premiumTickets: tickets.premiumTickets - count
        });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async addTickets(userId: string, normalTickets: number, premiumTickets: number): Promise<void> {
    if (normalTickets > 0) {
      await this.http.post(`${environment.backendUrl}/users/${userId}/tickets`, { amount: normalTickets, type: 'normal' }).toPromise();
    }
    if (premiumTickets > 0) {
      await this.http.post(`${environment.backendUrl}/users/${userId}/tickets`, { amount: premiumTickets, type: 'premium' }).toPromise();
    }
  }

  async refreshTickets(userId: string): Promise<void> {
    await this.getUserTickets(userId);
  }
}
