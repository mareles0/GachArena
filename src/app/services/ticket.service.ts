import { Injectable } from '@angular/core';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { Ticket } from '../models/ticket.model';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private db = getFirestore();
  private ticketsSubject = new BehaviorSubject<Ticket>({ normalTickets: 0, premiumTickets: 0 });
  public tickets$ = this.ticketsSubject.asObservable();

  constructor() { }

  async getUserTickets(userId: string): Promise<Ticket> {
    const docRef = doc(this.db, 'users', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      const tickets = {
        normalTickets: data.normalTickets || 0,
        premiumTickets: data.premiumTickets || 0
      };
      this.ticketsSubject.next(tickets);
      return tickets;
    }

    const defaultTickets = { normalTickets: 0, premiumTickets: 0 };
    this.ticketsSubject.next(defaultTickets);
    return defaultTickets;
  }

  async useTicket(userId: string, type: 'NORMAL' | 'PREMIUM'): Promise<boolean> {
    const tickets = await this.getUserTickets(userId);
    const docRef = doc(this.db, 'users', userId);

    if (type === 'NORMAL' && tickets.normalTickets > 0) {
      await updateDoc(docRef, {
        normalTickets: increment(-1)
      });
      // Atualizar o subject após usar ticket
      const updatedTickets = {
        ...tickets,
        normalTickets: tickets.normalTickets - 1
      };
      this.ticketsSubject.next(updatedTickets);
      return true;
    } else if (type === 'PREMIUM' && tickets.premiumTickets > 0) {
      await updateDoc(docRef, {
        premiumTickets: increment(-1)
      });
      // Atualizar o subject após usar ticket
      const updatedTickets = {
        ...tickets,
        premiumTickets: tickets.premiumTickets - 1
      };
      this.ticketsSubject.next(updatedTickets);
      return true;
    }

    return false;
  }

  async addTickets(userId: string, normalTickets: number, premiumTickets: number): Promise<void> {
    const docRef = doc(this.db, 'users', userId);

    // Check if user document exists; if not, create it with initial amounts
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        normalTickets: normalTickets || 0,
        premiumTickets: premiumTickets || 0
      });
      return;
    }

    await updateDoc(docRef, {
      normalTickets: increment(normalTickets),
      premiumTickets: increment(premiumTickets)
    });

    // Não atualizar o subject aqui para evitar bug visual na navbar do admin
  }

  // Método para forçar atualização dos tickets
  async refreshTickets(userId: string): Promise<void> {
    await this.getUserTickets(userId);
  }
}
