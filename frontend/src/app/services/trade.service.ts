import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Trade } from '../models/trade.model';

@Injectable({
  providedIn: 'root'
})
export class TradeService {

  constructor(private http: HttpClient) { }

  async createTrade(trade: Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const response = await this.http.post<{ id: string }>(`${environment.backendUrl}/trades`, trade).toPromise();
    return response!.id;
  }

  async getTradeById(tradeId: string): Promise<Trade | null> {
    const trade = await this.http.get<Trade>(`${environment.backendUrl}/trades/${tradeId}`).toPromise();
    return trade || null;
  }

  async getUserSentTrades(userId: string): Promise<Trade[]> {
    const trades = await this.http.get<Trade[]>(`${environment.backendUrl}/trades/user/${userId}/sent`).toPromise();
    return trades || [];
  }

  async getUserReceivedTrades(userId: string): Promise<Trade[]> {
    const trades = await this.http.get<Trade[]>(`${environment.backendUrl}/trades/user/${userId}/received`).toPromise();
    return trades || [];
  }

  async acceptTrade(tradeId: string): Promise<void> {
    await this.http.put(`${environment.backendUrl}/trades/${tradeId}/accept`, {}).toPromise();
  }

  async rejectTrade(tradeId: string): Promise<void> {
    await this.http.put(`${environment.backendUrl}/trades/${tradeId}/reject`, {}).toPromise();
  }

  async cancelTrade(tradeId: string): Promise<void> {
    await this.http.put(`${environment.backendUrl}/trades/${tradeId}/cancel`, {}).toPromise();
  }

  async deleteTrade(tradeId: string): Promise<void> {
    await this.http.delete(`${environment.backendUrl}/trades/${tradeId}`).toPromise();
  }
}
