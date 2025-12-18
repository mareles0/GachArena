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
    return querySnapshot.docs.map(doc => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        ...data,
        points: data.points ?? 0
      } as Item;
    });
  }

  async getItemsByBox(boxId: string): Promise<Item[]> {
    const q = query(collection(this.db, 'items'), where('boxId', '==', boxId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        ...data,
        points: data.points ?? 0
      } as Item;
    });
  }

  async getItemById(itemId: string): Promise<Item | null> {
    const docRef = doc(this.db, 'items', itemId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      return { 
        id: docSnap.id, 
        ...data,
        points: data.points ?? 0 // Define 0 como padrão se points for undefined
      } as Item;
    }
    return null;
  }

  async updateItem(itemId: string, data: Partial<Item>): Promise<void> {
    const docRef = doc(this.db, 'items', itemId);
    await updateDoc(docRef, data);
  }

  // Função auxiliar para calcular pontos baseado na raridade e rarityLevel
  private calculateItemPoints(rarity: string, rarityLevel?: number): number {
    const rarityPoints: any = {
      'COMUM': 10,
      'RARO': 25,
      'EPICO': 50,
      'LENDARIO': 100,
      'MITICO': 200
    };

    let points = rarityPoints[rarity] || 10;

    // Aplicar multiplicador baseado no rarityLevel se existir
    if (rarityLevel && typeof rarityLevel === 'number') {
      const rarityMultiplier = 1 + ((1000 - rarityLevel) / 1000);
      points = Math.round(points * rarityMultiplier);
    }

    return points;
  }

  async migrateItemsWithoutPoints(forceRecalculate: boolean = false): Promise<void> {
    // Busca todos os documentos diretamente do Firestore para verificar campos brutos
    const querySnapshot = await getDocs(collection(this.db, 'items'));
    const itemsToUpdate: any[] = [];
    const allItems: any[] = [];

    const mode = forceRecalculate ? '(MODO FORÇADO - RECALCULAR TODOS)' : '';
    console.log(`Verificando todos os itens no banco... ${mode}`);

    querySnapshot.forEach(doc => {
      const data = doc.data();
      allItems.push({
        id: doc.id,
        name: data.name,
        rarity: data.rarity,
        rarityLevel: data.rarityLevel,
        points: data.points,
        hasPointsField: data.hasOwnProperty('points')
      });

      // Se for modo forçado, recalcular todos os itens
      if (forceRecalculate) {
        itemsToUpdate.push({
          id: doc.id,
          ...data
        });
      } else {
        // Modo normal: só itens sem pontos válidos
        const needsMigration = !data.hasOwnProperty('points') ||
                              data.points === null ||
                              data.points === undefined ||
                              data.points === 0;

        if (needsMigration) {
          itemsToUpdate.push({
            id: doc.id,
            ...data
          });
        }
      }
    });

    console.log('Todos os itens encontrados:', allItems);
    console.log(`Encontrados ${itemsToUpdate.length} itens para atualizar pontos`);

    if (itemsToUpdate.length === 0 && !forceRecalculate) {
      console.log('Nenhum item precisa de migracao. Verificando se ha itens com points = 0...');

      // Verificar especificamente itens com points = 0
      const itemsWithZeroPoints = allItems.filter(item => item.points === 0);
      if (itemsWithZeroPoints.length > 0) {
        console.log('Encontrados itens com points = 0. Forcando migracao...', itemsWithZeroPoints);
        // Adicionar itens com points = 0 à lista de atualização
        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.points === 0) {
            itemsToUpdate.push({
              id: doc.id,
              ...data
            });
          }
        });
      } else {
        console.log('Todos os itens ja tem pontos validos (> 0).');
        console.log('Dica: Use migrateItemsWithoutPoints(true) para forcar recalculo de todos os pontos.');
        return;
      }
    }

    // Define pontos baseados na raridade
    const rarityPoints: any = {
      'COMUM': 10,
      'RARO': 25,
      'EPICO': 50,
      'LENDARIO': 100,
      'MITICO': 200
    };

    for (const itemData of itemsToUpdate) {
      console.log(`Processando item: ${itemData.name}`, {
        rarity: itemData.rarity,
        rarityLevel: itemData.rarityLevel,
        hasRarityLevel: itemData.hasOwnProperty('rarityLevel'),
        rarityLevelType: typeof itemData.rarityLevel
      });

      let points = rarityPoints[itemData.rarity] || 10;
      console.log(`Pontos base calculados: ${points} para raridade ${itemData.rarity}`);

      // Aplicar multiplicador baseado no rarityLevel PARA TODOS os itens
      if (itemData.rarityLevel && typeof itemData.rarityLevel === 'number') {
        const rarityMultiplier = 1 + ((1000 - itemData.rarityLevel) / 1000); // 1.0 a 2.0
        const oldPoints = points;
        points = Math.round(points * rarityMultiplier);
        console.log(`Aplicando multiplicador: ${oldPoints} x ${rarityMultiplier.toFixed(3)} = ${points} (rarityLevel: ${itemData.rarityLevel})`);
      } else {
        console.log(`Sem rarityLevel ou invalido: ${itemData.rarityLevel}`);
      }

      console.log(`Salvando item ${itemData.name} com ${points} pontos`);
      await this.updateItem(itemData.id, { points });
      console.log(`Atualizado item ${itemData.name} com points = ${points}`);
    }

    console.log('Migração concluída');
  }

  async migrateUserItemsPoints(): Promise<void> {
    console.log('Iniciando migracao de pontos para userItems...');

    // Buscar todos os userItems
    const querySnapshot = await getDocs(collection(this.db, 'userItems'));
    const userItemsToUpdate: any[] = [];

    querySnapshot.forEach(doc => {
      const data = doc.data();
      // Verificar se não tem pontos ou pontos = 0
      if (!data.hasOwnProperty('points') || data.points === null || data.points === undefined || data.points === 0) {
        userItemsToUpdate.push({
          id: doc.id,
          ...data
        });
      }
    });

    console.log(`Encontrados ${userItemsToUpdate.length} userItems para atualizar pontos`);

    if (userItemsToUpdate.length === 0) {
      console.log('Todos os userItems ja tem pontos validos.');
      return;
    }

    for (const userItemData of userItemsToUpdate) {
      // Se não tem item aninhado, buscar pelo itemId
      let itemRarity = userItemData.item?.rarity;
      if (!itemRarity && userItemData.itemId) {
        const item = await this.getItemById(userItemData.itemId);
        itemRarity = item?.rarity;
      }

      if (!itemRarity) {
        console.log(`Nao foi possivel determinar raridade para userItem ${userItemData.id}`);
        continue;
      }

      const points = this.calculateItemPoints(itemRarity, userItemData.rarityLevel);
      console.log(`Migrando userItem ${userItemData.id}: raridade ${itemRarity}, rarityLevel ${userItemData.rarityLevel}, pontos ${points}`);

      await updateDoc(doc(this.db, 'userItems', userItemData.id), { points });
      console.log(`Atualizado userItem ${userItemData.id} com points = ${points}`);
    }

    console.log('Migracao de userItems concluida!');
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

  async addItemToUser(userId: string, itemId: string, rarityLevel?: number): Promise<number> {
    const item = await this.getItemById(itemId);
    if (!item) throw new Error('Item não encontrado');

    // Gerar nível de raridade aleatório (1-1000) se não fornecido
    const finalRarityLevel = rarityLevel ?? Math.floor(Math.random() * 1000) + 1;

    // Calcular pontos baseado na raridade e rarityLevel
    const points = this.calculateItemPoints(item.rarity, finalRarityLevel);

    // Para itens lendários e míticos, cada cópia é tratada como item único
    if (item.rarity === 'LENDARIO' || item.rarity === 'MITICO') {
      // Criar entrada única para cada item lendário/mítico
      const uniqueId = `${userId}_${itemId}_${Date.now()}_${finalRarityLevel}`;
      const docRef = doc(this.db, 'userItems', uniqueId);

      const userItemData: Omit<UserItem, 'id'> = {
        userId,
        itemId,
        item,
        obtainedAt: new Date(),
        quantity: 1,
        rarityLevel: finalRarityLevel,
        points
      };
      await setDoc(docRef, userItemData);
      return finalRarityLevel;
    } else {
      // Para itens comuns, raros e épicos, manter o sistema atual
      const userItemId = `${userId}_${itemId}`;
      const docRef = doc(this.db, 'userItems', userItemId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentData = docSnap.data();
        await updateDoc(docRef, {
          quantity: currentData['quantity'] + 1,
          points: Math.max(currentData['points'] || 0, points)
        });
        return 0; // No rarity level for common items
      } else {
        const userItemData: Omit<UserItem, 'id'> = {
          userId,
          itemId,
          item,
          obtainedAt: new Date(),
          quantity: 1,
          points
        };
        await setDoc(docRef, userItemData);
        return 0;
      }
    }
  }

  async getUserItems(userId: string): Promise<UserItem[]> {
    const q = query(collection(this.db, 'userItems'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const userItems = await Promise.all(querySnapshot.docs.map(async doc => {
      const data = doc.data() as any;
      const item = await this.getItemById(data.itemId);
      return {
        id: doc.id,
        ...data,
        item
      } as UserItem;
    }));
    return userItems;
  }

  async getUserItemById(id: string): Promise<UserItem | null> {
    const docRef = doc(this.db, 'userItems', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      const item = await this.getItemById(data.itemId);
      return { id: docSnap.id, ...data, item } as UserItem;
    }
    return null;
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

  async removeItemFromUser(userItemId: string, quantity: number = 1): Promise<void> {
    const docRef = doc(this.db, 'userItems', userItemId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      if (data.quantity > quantity) {
        // Decrement quantity
        await updateDoc(docRef, {
          quantity: data.quantity - quantity
        });
      } else {
        // Delete the document
        await deleteDoc(docRef);
      }
    }
  }
}
