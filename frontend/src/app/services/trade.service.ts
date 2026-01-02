import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Trade } from '../models/trade.model';
import { EventService } from './event.service';

@Injectable({
  providedIn: 'root'
})
export class TradeService {

  constructor(private http: HttpClient, private eventService: EventService) { }

  async createTrade(trade: Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const response = await this.http.post<{ id: string }>(`${environment.backendUrl}/trades`, trade).toPromise();
    this.eventService.tradesChanged();
    return response!.id;
  }

  async getTradeById(tradeId: string): Promise<Trade | null> {
    const trade = await this.http.get<Trade>(`${environment.backendUrl}/trades/${tradeId}`).toPromise();
    return trade || null;
  }

  async getUserSentTrades(userId: string, includeItems: boolean = false): Promise<Trade[]> {
    const qs = includeItems ? '?includeItems=1' : '';
    const trades = await this.http.get<Trade[]>(`${environment.backendUrl}/trades/user/${userId}/sent${qs}`).toPromise();
    return trades || [];
  }

  async getUserReceivedTrades(userId: string, includeItems: boolean = false): Promise<Trade[]> {
    const qs = includeItems ? '?includeItems=1' : '';
    const trades = await this.http.get<Trade[]>(`${environment.backendUrl}/trades/user/${userId}/received${qs}`).toPromise();
    return trades || [];
  }

  async acceptTrade(tradeId: string): Promise<void> {
    await this.http.put(`${environment.backendUrl}/trades/${tradeId}/accept`, {}).toPromise();
    this.eventService.tradesChanged();
  }

  async rejectTrade(tradeId: string): Promise<void> {
    await this.http.put(`${environment.backendUrl}/trades/${tradeId}/reject`, {}).toPromise();
    this.eventService.tradesChanged();
  }

  async cancelTrade(tradeId: string): Promise<void> {
    await this.http.put(`${environment.backendUrl}/trades/${tradeId}/cancel`, {}).toPromise();
    this.eventService.tradesChanged();
  }

  async deleteTrade(tradeId: string): Promise<void> {
    await this.http.delete(`${environment.backendUrl}/trades/${tradeId}`).toPromise();
    this.eventService.tradesChanged();
  }
}
