import { Injectable } from '@angular/core';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, deleteDoc, addDoc, orderBy, runTransaction, writeBatch } from 'firebase/firestore';
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
      where('fromUserId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
  }

  async getUserReceivedTrades(userId: string): Promise<Trade[]> {
    const q = query(
      collection(db, 'trades'), 
      where('toUserId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
  }

  async acceptTrade(tradeId: string): Promise<void> {
    // Ao aceitar, validar posses e trocar ownership dos userItems de forma atômica
    const tradeRef = doc(db, 'trades', tradeId);
    await runTransaction(db, async (tx) => {
      const tradeSnap = await tx.get(tradeRef as any);
      if (!tradeSnap.exists()) throw new Error('Trade não encontrado');
      const trade = tradeSnap.data() as Trade;
      if (trade.status !== 'PENDING') throw new Error('Trade já processado');

      const fromUserId = trade.fromUserId;
      const toUserId = trade.toUserId;

      // Ler todos os userItems envolvidos
      const allUserItemIds = [...(trade.offeredUserItemIds || []), ...(trade.requestedUserItemIds || [])];
      const userItemSnaps = await Promise.all(allUserItemIds.map(id => getDoc(doc(db, 'userItems', id))));

      // Validar propriedade
      for (const id of trade.offeredUserItemIds) {
        const snap = userItemSnaps.find(s => s && s.id === id);
        if (!snap || !snap.exists()) throw new Error('Item oferecido não encontrado: ' + id);
        const data: any = snap.data();
        if (data.userId !== fromUserId) throw new Error('O usuário não possui o item oferecido: ' + id);
      }
      for (const id of trade.requestedUserItemIds) {
        const snap = userItemSnaps.find(s => s && s.id === id);
        if (!snap || !snap.exists()) throw new Error('Item solicitado não encontrado: ' + id);
        const data: any = snap.data();
        if (data.userId !== toUserId) throw new Error('O usuário não possui o item solicitado: ' + id);
      }

      // Coletar userItemIds transferidos para limpar showcasedCards
      const transferredUserItemIds = new Set<string>([...trade.offeredUserItemIds, ...trade.requestedUserItemIds]);
      console.log('acceptTrade - transferredUserItemIds:', Array.from(transferredUserItemIds));

      // Realizar transferências (simples: atualizar userId ou ajustar quantities)
      // Usar batch para operações de escrita
      const batch = writeBatch(db);

      // Transferir oferecidos -> toUserId
      for (const id of trade.offeredUserItemIds) {
        const ref = doc(db, 'userItems', id);
        const snap = userItemSnaps.find(s => s && s.id === id) as any;
        const data: any = snap.data();

        if (data.quantity && data.quantity > 1) {
          // decrementar quantidade no documento origem
          batch.update(ref, { quantity: data.quantity - 1 });
          // incrementar/crear doc destino (toUserId_itemId)
          const destId = `${toUserId}_${data.itemId}`;
          const destRef = doc(db, 'userItems', destId);
          const destSnap = await getDoc(destRef);
          if (destSnap.exists()) {
            batch.update(destRef, { quantity: (destSnap.data() as any).quantity + 1 });
          } else {
            batch.set(destRef, { userId: toUserId, itemId: data.itemId, item: data.item, obtainedAt: new Date(), quantity: 1 });
          }
        } else {
          // quantidade == 1 -> mudar dono (atualizar userId)
          batch.update(ref, { userId: toUserId, obtainedAt: new Date() });
        }
      }

      // Transferir solicitados -> fromUserId
      for (const id of trade.requestedUserItemIds) {
        const ref = doc(db, 'userItems', id);
        const snap = userItemSnaps.find(s => s && s.id === id) as any;
        const data: any = snap.data();

        if (data.quantity && data.quantity > 1) {
          batch.update(ref, { quantity: data.quantity - 1 });
          const destId = `${fromUserId}_${data.itemId}`;
          const destRef = doc(db, 'userItems', destId);
          const destSnap = await getDoc(destRef);
          if (destSnap.exists()) {
            batch.update(destRef, { quantity: (destSnap.data() as any).quantity + 1 });
          } else {
            batch.set(destRef, { userId: fromUserId, itemId: data.itemId, item: data.item, obtainedAt: new Date(), quantity: 1 });
          }
        } else {
          batch.update(ref, { userId: fromUserId, obtainedAt: new Date() });
        }
      }

      // Limpar showcasedCards dos usuários envolvidos
      const fromUserRef = doc(db, 'users', fromUserId);
      const toUserRef = doc(db, 'users', toUserId);
      
      const fromUserSnap = await tx.get(fromUserRef);
      const toUserSnap = await tx.get(toUserRef);
      
      if (fromUserSnap.exists()) {
        const fromUserData = fromUserSnap.data() as any;
        const currentShowcased = fromUserData.showcasedCards || [];
        const filteredShowcased = currentShowcased.filter((userItemId: string) => !transferredUserItemIds.has(userItemId));
        console.log('acceptTrade - fromUser showcasedCards:', { before: currentShowcased, after: filteredShowcased });
        if (filteredShowcased.length !== currentShowcased.length) {
          batch.update(fromUserRef, { showcasedCards: filteredShowcased });
        }
      }
      
      if (toUserSnap.exists()) {
        const toUserData = toUserSnap.data() as any;
        const currentShowcased = toUserData.showcasedCards || [];
        const filteredShowcased = currentShowcased.filter((userItemId: string) => !transferredUserItemIds.has(userItemId));
        console.log('acceptTrade - toUser showcasedCards:', { before: currentShowcased, after: filteredShowcased });
        if (filteredShowcased.length !== currentShowcased.length) {
          batch.update(toUserRef, { showcasedCards: filteredShowcased });
        }
      }

      // Atualizar trade status
      batch.update(tradeRef, { status: 'ACCEPTED', updatedAt: new Date() } as any);

      // Commit batch
      await batch.commit();
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
