import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { EventService } from './event.service';

@Injectable({
  providedIn: 'root'
})
export class TradeUpService {

  constructor(private http: HttpClient, private eventService: EventService) { }

  async performTradeUp(userId: string, itemsToTrade: { userItemId: string, quantity: number }[]): Promise<{ success: boolean, ticketsAdded: { normal: number, premium: number }, message: string }> {
    const response = await this.http.post<{ success: boolean, ticketsAdded: { normal: number, premium: number }, message: string }>(`${environment.backendUrl}/tradeUp`, { userId, itemsToTrade }).toPromise();
    this.eventService.emit('ticketsChanged');
    this.eventService.emit('userDataChanged');
    return response!;
  }
}