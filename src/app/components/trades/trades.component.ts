import { Component, OnInit } from '@angular/core';
import { TradeService } from '../../services/trade.service';
import { AuthService } from '../../services/auth.service';
import { ItemService } from '../../services/item.service';

@Component({
  selector: 'app-trades',
  templateUrl: './trades.component.html',
  styleUrls: ['./trades.component.scss']
})
export class TradesComponent implements OnInit {
  received: any[] = [];
  sent: any[] = [];
  history: any[] = [];
  view: 'received' | 'sent' | 'history' = 'received';
  expandedTradeId: string | null = null;
  loading = false;
  error = '';

  notification = { show: false, message: '', type: 'success' };

  constructor(private tradeService: TradeService, private auth: AuthService, private itemService: ItemService) {}

  async ngOnInit() {
    const me = await this.auth.getCurrentUser();
    console.log('current user uid:', me?.uid);
    if (!me) return;
    await this.load();
  }

  async load() {
    this.loading = true;
    const me = await this.auth.getCurrentUser();
    if (!me) return;
    try {
      // Received
      const rTrades = await this.tradeService.getUserReceivedTrades(me.uid);
      const receivedDetailed = await Promise.all(rTrades.map(async t => {
        const offered = await Promise.all((t.offeredUserItemIds || []).map((id:string) => this.itemService.getUserItemById(id)));
        const requested = await Promise.all((t.requestedUserItemIds || []).map((id:string) => this.itemService.getUserItemById(id)));
        return { ...t, offeredItems: offered.filter(Boolean), requestedItems: requested.filter(Boolean) } as any;
      }));
      this.received = receivedDetailed.filter(t => t.status === 'PENDING');

      // Sent
      const sTrades = await this.tradeService.getUserSentTrades(me.uid);
      const sentDetailed = await Promise.all(sTrades.map(async t => {
        const offered = await Promise.all((t.offeredUserItemIds || []).map((id:string) => this.itemService.getUserItemById(id)));
        const requested = await Promise.all((t.requestedUserItemIds || []).map((id:string) => this.itemService.getUserItemById(id)));
        return { ...t, offeredItems: offered.filter(Boolean), requestedItems: requested.filter(Boolean) } as any;
      }));
      this.sent = sentDetailed.filter(t => t.status === 'PENDING');

      // History
      this.history = [...receivedDetailed, ...sentDetailed].filter(t => t.status !== 'PENDING');
    } catch (err) {
      console.error('Erro ao carregar propostas', err);
      this.error = 'Erro ao carregar propostas';
    } finally { this.loading = false; }
  }

  async accept(tId: string) {
    try {
      if (!confirm('Tem certeza que quer aceitar essa troca?')) return;
      await this.tradeService.acceptTrade(tId);
      await this.load();
      this.showNotification('Troca aceita!', 'success');
    } catch (err:any) { this.showNotification(err?.message || 'Erro ao aceitar', 'error'); }
  }

  async reject(tId: string) {
    try {
      if (!confirm('Tem certeza que quer rejeitar essa troca?')) return;
      await this.tradeService.rejectTrade(tId);
      await this.load();
      this.showNotification('Troca rejeitada!', 'success');
    } catch (err:any) { this.showNotification(err?.message || 'Erro ao rejeitar', 'error'); }
  }

  async cancel(tId: string) {
    try {
      if (!confirm('Tem certeza que quer cancelar essa troca?')) return;
      await this.tradeService.cancelTrade(tId);
      await this.load();
      this.showNotification('Troca cancelada!', 'success');
    } catch (err:any) { this.showNotification(err?.message || 'Erro ao cancelar', 'error'); }
  }

  toggleExpand(tId: string) {
    this.expandedTradeId = this.expandedTradeId === tId ? null : tId;
  }

  setView(v: 'received'|'sent'|'history') {
    this.view = v;
    this.expandedTradeId = null;
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    this.notification = { show: true, message, type };
    setTimeout(() => this.notification.show = false, 5000);
  }
}
