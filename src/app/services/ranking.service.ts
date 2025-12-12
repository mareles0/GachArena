import { Injectable } from '@angular/core';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase.config';
import { UserService } from './user.service';
import { ItemService } from './item.service';
import { User } from '../models/user.model';

export interface RankingEntry {
  userId: string;
  username: string;
  photoURL: string;
  rarestItem: any;
  totalItems: number;
  score: number; // Calculado baseado em raridade
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
        if (user.userType === 'admin') continue; // Pular admins

        if (!user.id) continue;

        const userItems = await this.itemService.getUserItems(user.id);
        
        if (userItems.length === 0) continue;

        // Calcular score baseado em raridade
        const rarityScores: any = {
          'COMUM': 1,
          'RARO': 5,
          'EPICO': 15,
          'LENDARIO': 50,
          'MITICO': 200
        };

        let totalScore = 0;
        let rarestItem = userItems[0];
        let maxRarityScore = 0;

        userItems.forEach(ui => {
          let score = 0;

          // Para itens lendários e míticos, cada entrada é única (quantity sempre 1)
          // Para outros itens, multiplicar pela quantidade
          if (ui.item.rarity === 'LENDARIO' || ui.item.rarity === 'MITICO') {
            score = rarityScores[ui.item.rarity];
            // Aplicar multiplicador baseado no rarityLevel
            if (ui.rarityLevel) {
              const rarityMultiplier = 1 + ((1000 - ui.rarityLevel) / 1000); // 1.0 a 2.0
              score = score * rarityMultiplier;
            }
          } else {
            score = rarityScores[ui.item.rarity] * ui.quantity;
          }

          totalScore += score;

          const itemScore = (ui.item.rarity === 'LENDARIO' || ui.item.rarity === 'MITICO') && ui.rarityLevel
            ? rarityScores[ui.item.rarity] * (1 + ((1000 - ui.rarityLevel) / 1000))
            : rarityScores[ui.item.rarity];

          if (itemScore > maxRarityScore) {
            maxRarityScore = itemScore;
            rarestItem = ui;
          }
        });

        rankingEntries.push({
          userId: user.id || '',
          username: user.username || 'Jogador',
          photoURL: user.photoURL || '',
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
        if (user.userType === 'admin') continue;

        if (!user.id) continue;

        const rarestItem = await this.itemService.getUserRarestItemInBox(user.id, boxId);
        
        if (!rarestItem) continue;

        const rarityScores: any = {
          'COMUM': 1,
          'RARO': 5,
          'EPICO': 15,
          'LENDARIO': 50,
          'MITICO': 200
        };

        let score = rarityScores[rarestItem.item.rarity] + rarestItem.item.power;

        // Para itens lendários e míticos, multiplicar pelo rarityLevel
        if ((rarestItem.item.rarity === 'LENDARIO' || rarestItem.item.rarity === 'MITICO') && rarestItem.rarityLevel) {
          const rarityMultiplier = 1 + ((1000 - rarestItem.rarityLevel) / 1000); // 1.0 a 2.0
          score = score * rarityMultiplier;
        }
      }

      rankingEntries.sort((a, b) => b.score - a.score);

      return rankingEntries.slice(0, limitCount);
    } catch (error) {
      console.error('Erro ao buscar ranking por caixa:', error);
      return [];
    }
  }
}
