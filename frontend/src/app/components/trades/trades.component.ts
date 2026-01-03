import { Component, OnInit, OnDestroy } from '@angular/core';
import { TradeService } from '../../services/trade.service';
import { AuthService } from '../../services/auth.service';
import { ItemService } from '../../services/item.service';
import { EventService } from '../../services/event.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-trades',
  templateUrl: './trades.component.html',
  styleUrls: ['./trades.component.scss']
})
export class TradesComponent implements OnInit, OnDestroy {
  received: any[] = [];
  sent: any[] = [];
  history: any[] = [];
  view: 'received' | 'sent' | 'history' = 'received';
  expandedTradeId: string | null = null;
  loading = false;
  error = '';
  
  private eventSubscription?: Subscription;
  private reloadQueued = false;

  notification = { show: false, message: '', type: 'success' };

  constructor(
    private tradeService: TradeService,
    private auth: AuthService,
    private itemService: ItemService,
    private eventService: EventService
  ) {}

  async ngOnInit() {
    const me = await this.auth.getCurrentUser();
    console.log('current user uid:', me?.uid);
    if (!me) return;
    await this.load();
    
    this.eventSubscription = this.eventService.events$.subscribe(event => {
      if (event === 'tradesChanged' || event === 'itemsChanged') {
        console.log('[Trades] Evento recebido:', event, '- recarregando trades');
        this.queueReload();
      }
    });
  }

  async load() {
    this.loading = true;
    const me = await this.auth.getCurrentUser();
    if (!me) return;
    try {
      const [rTrades, sTrades] = await Promise.all([
        this.tradeService.getUserReceivedTrades(me.uid, true),
        this.tradeService.getUserSentTrades(me.uid, true)
      ]);

      const receivedDetailed = await Promise.all((rTrades || []).map(async (t: any) => {
        if (t.offeredItems && t.requestedItems) {
          return this.convertTimestamps(t);
        }
        const offered = await Promise.all((t.offeredUserItemIds || []).map((id: string) => this.itemService.getUserItemById(id)));
        const requested = await Promise.all((t.requestedUserItemIds || []).map((id: string) => this.itemService.getUserItemById(id)));
        return this.convertTimestamps({ ...t, offeredItems: offered.filter(Boolean), requestedItems: requested.filter(Boolean) });
      }));

      const sentDetailed = await Promise.all((sTrades || []).map(async (t: any) => {
        if (t.offeredItems && t.requestedItems) {
          return this.convertTimestamps(t);
        }
        const offered = await Promise.all((t.offeredUserItemIds || []).map((id: string) => this.itemService.getUserItemById(id)));
        const requested = await Promise.all((t.requestedUserItemIds || []).map((id: string) => this.itemService.getUserItemById(id)));
        return this.convertTimestamps({ ...t, offeredItems: offered.filter(Boolean), requestedItems: requested.filter(Boolean) });
      }));

      this.received = receivedDetailed.filter(t => t.status === 'PENDING');
      this.sent = sentDetailed.filter(t => t.status === 'PENDING');
      this.history = [...receivedDetailed, ...sentDetailed].filter(t => t.status !== 'PENDING');
    } catch (err) {
      console.error('Erro ao carregar propostas', err);
      this.error = 'Erro ao carregar propostas';
      this.showNotification('❌ Erro ao carregar trocas', 'error');
    } finally { this.loading = false; }

    if (this.reloadQueued) {
      this.reloadQueued = false;
      this.load();
    }
  }

  private queueReload() {
    if (this.loading) {
      this.reloadQueued = true;
      return;
    }
    this.load();
  }

  private convertTimestamps(trade: any): any {
    if (trade.createdAt && typeof trade.createdAt === 'object' && 'seconds' in trade.createdAt) {
      trade.createdAt = new Date(trade.createdAt.seconds * 1000);
    }
    if (trade.updatedAt && typeof trade.updatedAt === 'object' && 'seconds' in trade.updatedAt) {
      trade.updatedAt = new Date(trade.updatedAt.seconds * 1000);
    }
    return trade;
  }

  async accept(tId: string) {
    try {
      if (!confirm('Tem certeza que quer aceitar essa troca?')) return;
      console.log('[Trades] Aceitando troca:', tId);
      await this.tradeService.acceptTrade(tId);
      console.log('[Trades] Troca aceita com sucesso');
      this.showNotification('✅ Troca aceita com sucesso!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      console.error('[Trades] Erro ao aceitar troca:', err);
      const errorMsg = err?.error?.error || err?.message || 'Erro ao aceitar';
      this.showNotification(`❌ ${errorMsg}`, 'error');
    }
  }

  async reject(tId: string) {
    try {
      if (!confirm('Tem certeza que quer rejeitar essa troca?')) return;
      console.log('[Trades] Rejeitando troca:', tId);
      await this.tradeService.rejectTrade(tId);
      console.log('[Trades] Troca rejeitada com sucesso');
      this.showNotification('✅ Troca rejeitada com sucesso!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      console.error('[Trades] Erro ao rejeitar troca:', err);
      const errorMsg = err?.error?.error || err?.message || 'Erro ao rejeitar';
      this.showNotification(`❌ ${errorMsg}`, 'error');
    }
  }

  async cancel(tId: string) {
    try {
      if (!confirm('Tem certeza que quer cancelar essa troca?')) return;
      console.log('[Trades] Cancelando troca:', tId);
      await this.tradeService.cancelTrade(tId);
      console.log('[Trades] Troca cancelada com sucesso');
      this.showNotification('✅ Troca cancelada com sucesso!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      console.error('[Trades] Erro ao cancelar troca:', err);
      const errorMsg = err?.error?.error || err?.message || 'Erro ao cancelar';
      this.showNotification(`❌ ${errorMsg}`, 'error');
    }
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
  
  ngOnDestroy() {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }
}
