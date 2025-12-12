import { Injectable } from '@angular/core';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, deleteDoc, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase.config';
import { Trade } from '../models/trade.model';

@Injectable({
  providedIn: 'root'
})
export class TradeService {

  constructor() { }

  async createTrade(trade: Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const tradeData = {
      ...trade,
      status: 'PENDING' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const docRef = await addDoc(collection(db, 'trades'), tradeData);
    return docRef.id;
  }

  async getTradeById(tradeId: string): Promise<Trade | null> {
    const docRef = doc(db, 'trades', tradeId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Trade;
    }
    return null;
  }

  async getUserSentTrades(userId: string): Promise<Trade[]> {
    const q = query(
      collection(db, 'trades'), 
      where('fromUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
  }

  async getUserReceivedTrades(userId: string): Promise<Trade[]> {
    const q = query(
      collection(db, 'trades'), 
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
  }

  async acceptTrade(tradeId: string): Promise<void> {
    const docRef = doc(db, 'trades', tradeId);
    await updateDoc(docRef, {
      status: 'ACCEPTED',
      updatedAt: new Date()
    });
  }

  async rejectTrade(tradeId: string): Promise<void> {
    const docRef = doc(db, 'trades', tradeId);
    await updateDoc(docRef, {
      status: 'REJECTED',
      updatedAt: new Date()
    });
  }

  async cancelTrade(tradeId: string): Promise<void> {
    const docRef = doc(db, 'trades', tradeId);
    await updateDoc(docRef, {
      status: 'CANCELLED',
      updatedAt: new Date()
    });
  }

  async deleteTrade(tradeId: string): Promise<void> {
    await deleteDoc(doc(db, 'trades', tradeId));
  }
}
