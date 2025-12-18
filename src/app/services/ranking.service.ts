import { Injectable } from '@angular/core';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase.config';
import { UserService } from './user.service';
import { ItemService } from './item.service';
import { User } from '../models/user.model';
import { UserItem } from '../models/item.model';

export interface RankingEntry {
  userId: string;
  username: string;
  photoURL: string;
  profileBackground?: string;
  rarestItem: any;
  totalItems: number;
  score: number; // Calculado baseado nos pontos dos itens
}

@Injectable({
  providedIn: 'root'
})
export class RankingService {

  constructor(
    private userService: UserService,
    private itemService: ItemService
  ) { }

  async getGlobalRanking(limitCount: number = 50): Promise<RankingEntry[]> {
    try {
      // Buscar todos os usuários
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

      const rankingEntries: RankingEntry[] = [];

      for (const user of users) {
        if (!user.id) continue;

        const userItems = await this.itemService.getUserItems(user.id);
        
        if (userItems.length === 0) continue;

        // Calcular score baseado nos pontos dos itens
        let totalScore = 0;
        let rarestItem = userItems[0];
        let maxPoints = 0;

        userItems.forEach(ui => {
          // Calcular pontos totais do item (pontos * quantidade)
          const itemPoints = (ui.item.points || 0) * ui.quantity;
          totalScore += itemPoints;

          // Encontrar o item com mais pontos (para mostrar como "mais raro")
          const singleItemPoints = ui.item.points || 0;
          if (singleItemPoints > maxPoints) {
            maxPoints = singleItemPoints;
            rarestItem = ui;
          }
        });

        rankingEntries.push({
          userId: user.id || '',
          username: user.username || 'Jogador',
          photoURL: (user as any).profileIcon || user.photoURL || '',
          profileBackground: (user as any).profileBackground || '',
          rarestItem: rarestItem.item,
          totalItems: userItems.length,
          score: totalScore
        });
      }

      // Ordenar por score
      rankingEntries.sort((a, b) => b.score - a.score);

      return rankingEntries.slice(0, limitCount);
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
      return [];
    }
  }

  async getRankingByBox(boxId: string, limitCount: number = 20): Promise<RankingEntry[]> {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

      const rankingEntries: RankingEntry[] = [];

      for (const user of users) {
        if (!user.id) continue;

        const rarestItem = await this.itemService.getUserRarestItemInBox(user.id, boxId);
        
        if (!rarestItem) continue;

        let score = (rarestItem.item.points || 0) + rarestItem.item.power;

        // Para itens lendários e míticos, multiplicar pelo rarityLevel
        if ((rarestItem.item.rarity === 'LENDARIO' || rarestItem.item.rarity === 'MITICO') && rarestItem.rarityLevel) {
          const rarityMultiplier = 1 + ((1000 - rarestItem.rarityLevel) / 1000); // 1.0 a 2.0
          score = score * rarityMultiplier;
        }

        // contar quantos itens o usuário tem nessa caixa
        const userItems = await this.itemService.getUserItems(user.id);
        const itemsInBox = userItems.filter((ui: UserItem) => ui.item.boxId === boxId);
        const totalItemsInBox = itemsInBox.length;

        rankingEntries.push({
          userId: user.id || '',
          username: user.username || 'Jogador',
          photoURL: (user as any).profileIcon || user.photoURL || '',
          profileBackground: (user as any).profileBackground || '',
          rarestItem: rarestItem.item,
          totalItems: totalItemsInBox,
          score
        });
      }

      rankingEntries.sort((a, b) => b.score - a.score);

      return rankingEntries.slice(0, limitCount);
    } catch (error) {
      console.error('Erro ao buscar ranking por caixa:', error);
      return [];
    }
  }
}
