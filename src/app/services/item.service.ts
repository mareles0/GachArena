import { Injectable } from '@angular/core';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { Item, UserItem } from '../models/item.model';

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  private db = getFirestore();

  constructor() { }

  async createItem(item: Omit<Item, 'id' | 'createdAt'>): Promise<string> {
    const itemData = {
      ...item,
      createdAt: new Date()
    };
    const docRef = await addDoc(collection(this.db, 'items'), itemData);
    return docRef.id;
  }

  async getAllItems(): Promise<Item[]> {
    const querySnapshot = await getDocs(collection(this.db, 'items'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Item));
  }

  async getItemsByBox(boxId: string): Promise<Item[]> {
    const q = query(collection(this.db, 'items'), where('boxId', '==', boxId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Item));
  }

  async getItemById(itemId: string): Promise<Item | null> {
    const docRef = doc(this.db, 'items', itemId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Item;
    }
    return null;
  }

  async updateItem(itemId: string, data: Partial<Item>): Promise<void> {
    const docRef = doc(this.db, 'items', itemId);
    await updateDoc(docRef, data);
  }

  async deleteItem(itemId: string): Promise<void> {
    const docRef = doc(this.db, 'items', itemId);
    await deleteDoc(docRef);
  }

  async addItemToUser(userId: string, itemId: string): Promise<void> {
    const item = await this.getItemById(itemId);
    if (!item) throw new Error('Item não encontrado');

    const userItemId = `${userId}_${itemId}`;
    const docRef = doc(this.db, 'userItems', userItemId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data();
      await updateDoc(docRef, {
        quantity: currentData['quantity'] + 1
      });
    } else {
      const userItemData: Omit<UserItem, 'id'> = {
        userId,
        itemId,
        item,
        obtainedAt: new Date(),
        quantity: 1
      };
      await setDoc(docRef, userItemData);
    }
  }

  async getUserItems(userId: string): Promise<UserItem[]> {
    const q = query(collection(this.db, 'userItems'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as UserItem));
  }

  async getUserRarestItemInBox(userId: string, boxId: string): Promise<UserItem | null> {
    const userItems = await this.getUserItems(userId);
    const boxItems = userItems.filter(ui => ui.item.boxId === boxId);
    
    if (boxItems.length === 0) return null;

    const rarityOrder = { 'MITICO': 5, 'LENDARIO': 4, 'EPICO': 3, 'RARO': 2, 'COMUM': 1 };
    
    boxItems.sort((a, b) => {
      const rarityDiff = rarityOrder[b.item.rarity] - rarityOrder[a.item.rarity];
      if (rarityDiff !== 0) return rarityDiff;
      return b.item.power - a.item.power;
    });

    return boxItems[0];
  }

  async drawRandomItem(boxId: string): Promise<Item> {
    const items = await this.getItemsByBox(boxId);
    if (items.length === 0) throw new Error('Nenhum item disponível nesta caixa');
    const rarityWeights = {
      'COMUM': 50,
      'RARO': 30,
      'EPICO': 15,
      'LENDARIO': 4,
      'MITICO': 1
    };

    const weightedItems: Item[] = [];
    items.forEach(item => {
      const weight = rarityWeights[item.rarity];
      for (let i = 0; i < weight; i++) {
        weightedItems.push(item);
      }
    });

    const randomIndex = Math.floor(Math.random() * weightedItems.length);
    return weightedItems[randomIndex];
  }
}
