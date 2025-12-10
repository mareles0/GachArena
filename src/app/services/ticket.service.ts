import { Injectable } from '@angular/core';
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { Ticket, UserTickets } from '../models/ticket.model';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private db = getFirestore();

  constructor() { }

  async initializeUserTickets(userId: string): Promise<void> {
    const docRef = doc(this.db, 'userTickets', userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      const userTickets: Omit<UserTickets, 'userId'> = {
        tickets: {
          normalTickets: 5,
          premiumTickets: 1
        },
        updatedAt: new Date()
      };
      await setDoc(docRef, { userId, ...userTickets });
    }
  }

  async getUserTickets(userId: string): Promise<Ticket> {
    await this.initializeUserTickets(userId);
    const docRef = doc(this.db, 'userTickets', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as UserTickets;
      return data.tickets;
    }
    
    return { normalTickets: 0, premiumTickets: 0 };
  }

  async useTicket(userId: string, type: 'NORMAL' | 'PREMIUM'): Promise<boolean> {
    const tickets = await this.getUserTickets(userId);
    const docRef = doc(this.db, 'userTickets', userId);

    if (type === 'NORMAL' && tickets.normalTickets > 0) {
      await updateDoc(docRef, {
        'tickets.normalTickets': increment(-1),
        updatedAt: new Date()
      });
      return true;
    } else if (type === 'PREMIUM' && tickets.premiumTickets > 0) {
      await updateDoc(docRef, {
        'tickets.premiumTickets': increment(-1),
        updatedAt: new Date()
      });
      return true;
    }

    return false;
  }

  async addTickets(userId: string, normalTickets: number, premiumTickets: number): Promise<void> {
    await this.initializeUserTickets(userId);
    const docRef = doc(this.db, 'userTickets', userId);
    
    await updateDoc(docRef, {
      'tickets.normalTickets': increment(normalTickets),
      'tickets.premiumTickets': increment(premiumTickets),
      updatedAt: new Date()
    });
  }
}
