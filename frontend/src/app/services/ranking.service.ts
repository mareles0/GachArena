import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
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
  score: number;
}

@Injectable({
  providedIn: 'root'
})
export class RankingService {

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private itemService: ItemService
  ) { }

  async getGlobalRanking(limitCount: number = 50): Promise<RankingEntry[]> {
    try {
      const rankingEntries = await this.http.get<RankingEntry[]>(`${environment.backendUrl}/rankings/global/${limitCount}`).toPromise();
      return rankingEntries || [];
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
      return [];
    }
  }

  async getRankingByBox(boxId: string, limitCount: number = 20): Promise<RankingEntry[]> {
    try {
      const rankingEntries = await this.http.get<RankingEntry[]>(`${environment.backendUrl}/rankings/box/${boxId}/${limitCount}`).toPromise();
      return rankingEntries || [];
    } catch (error) {
      console.error('Erro ao buscar ranking por caixa:', error);
      return [];
    }
  }
}
