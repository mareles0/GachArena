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

  async deleteAllItems(): Promise<void> {
    console.log('Deletando todos os itens...');
    const items = await this.getAllItems();
    console.log(`Encontrados ${items.length} itens para deletar`);
    
    for (const item of items) {
      console.log(`Deletando ${item.name}...`);
      await this.deleteItem(item.id);
    }
    
    console.log('Todos os itens foram deletados!');
  }

  async addItemToUser(userId: string, itemId: string): Promise<number> {
    const item = await this.getItemById(itemId);
    if (!item) throw new Error('Item não encontrado');

    // Gerar nível de raridade aleatório (1-1000)
    const rarityLevel = Math.floor(Math.random() * 1000) + 1;

    // Para itens lendários e míticos, cada cópia é tratada como item único
    if (item.rarity === 'LENDARIO' || item.rarity === 'MITICO') {
      // Criar entrada única para cada item lendário/mítico
      const uniqueId = `${userId}_${itemId}_${Date.now()}_${rarityLevel}`;
      const docRef = doc(this.db, 'userItems', uniqueId);

      const userItemData: Omit<UserItem, 'id'> = {
        userId,
        itemId,
        item,
        obtainedAt: new Date(),
        quantity: 1,
        rarityLevel
      };
      await setDoc(docRef, userItemData);
      return rarityLevel;
    } else {
      // Para itens comuns, raros e épicos, manter o sistema atual
      const userItemId = `${userId}_${itemId}`;
      const docRef = doc(this.db, 'userItems', userItemId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentData = docSnap.data();
        await updateDoc(docRef, {
          quantity: currentData['quantity'] + 1,
          rarityLevel: Math.max(currentData['rarityLevel'] || 0, rarityLevel)
        });
        return rarityLevel;
      } else {
        const userItemData: Omit<UserItem, 'id'> = {
          userId,
          itemId,
          item,
          obtainedAt: new Date(),
          quantity: 1,
          rarityLevel
        };
        await setDoc(docRef, userItemData);
        return rarityLevel;
      }
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
    
    // Usar as taxas de drop configuradas para cada item
    const totalDropRate = items.reduce((sum, item) => sum + (item.dropRate || 0), 0);
    
    if (totalDropRate === 0) {
      throw new Error('As taxas de drop dos itens não foram configuradas corretamente');
    }

    // Gerar número aleatório entre 0 e o total de taxas
    const random = Math.random() * totalDropRate;
    
    // Selecionar item baseado na taxa de drop
    let currentSum = 0;
    for (const item of items) {
      currentSum += (item.dropRate || 0);
      if (random <= currentSum) {
        return item;
      }
    }

    // Fallback (não deveria acontecer, mas por segurança)
    return items[items.length - 1];
  }
}
