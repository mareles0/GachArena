import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ItemService } from '../../services/item.service';
import { TradeUpService } from '../../services/trade-up.service';
import { EventService } from '../../services/event.service';
import { TicketService } from '../../services/ticket.service';
import { UserItem } from '../../models/item.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-trade-up',
  templateUrl: './trade-up.component.html',
  styleUrls: ['./trade-up.component.scss']
})
export class TradeUpComponent implements OnInit, OnDestroy {
  userItems: UserItem[] = [];
  selectedItems: { userItem: UserItem, quantity: number }[] = [];
  loading = false;
  error = '';
  notification = { show: false, message: '', type: 'success' as 'success' | 'error' | 'info' };

  private eventSubscription?: Subscription;

  constructor(
    private auth: AuthService,
    private itemService: ItemService,
    private tradeUpService: TradeUpService,
    private eventService: EventService,
    private ticketService: TicketService
  ) {}

  async ngOnInit() {
    await this.loadUserItems();
    this.eventSubscription = this.eventService.events$.subscribe(event => {
      if (event === 'itemsChanged' || event === 'userDataChanged') {
        this.loadUserItems();
      }
    });
  }

  ngOnDestroy() {
    this.eventSubscription?.unsubscribe();
  }

  async loadUserItems() {
    try {
      const user = await this.auth.getCurrentUser();
      if (!user) return;
      this.userItems = await this.itemService.getUserItems(user.uid);
      // Filtrar apenas itens trocáveis
      this.userItems = this.userItems.filter(ui =>
        ui.item && ['COMUM', 'RARO', 'EPICO'].includes(ui.item.rarity)
      );
    } catch (err: any) {
      this.error = err.message;
    }
  }

  addToSelection(userItem: UserItem) {
    const existing = this.selectedItems.find(s => s.userItem.id === userItem.id);
    if (existing) {
      if (existing.quantity < userItem.quantity) {
        existing.quantity++;
      }
    } else {
      this.selectedItems.push({ userItem, quantity: 1 });
    }
  }

  isSelected(userItemId: string): boolean {
    return !!this.selectedItems.find(s => s.userItem.id === userItemId);
  }

  selectedQuantity(userItemId: string): number {
    const s = this.selectedItems.find(x => x.userItem.id === userItemId);
    return s ? s.quantity : 0;
  }

  removeFromSelection(index: number) {
    this.selectedItems.splice(index, 1);
  }

  updateQuantity(index: number, value: number | Event) {
    let quantity: number;
    if (typeof value === 'number') {
      quantity = value;
    } else {
      const target = value.target as HTMLInputElement;
      quantity = +target.value;
    }
    if (quantity <= 0) {
      this.removeFromSelection(index);
    } else if (quantity <= this.selectedItems[index].userItem.quantity) {
      this.selectedItems[index].quantity = quantity;
    }
  }

  getTotalTickets(): { normal: number, premium: number } {
    let normal = 0;
    let premium = 0;
    for (const sel of this.selectedItems) {
      const rarity = sel.userItem.item!.rarity;
      const qty = sel.quantity;
      if (rarity === 'COMUM') {
        normal += qty * 0.5;
      } else if (rarity === 'RARO') {
        normal += qty * 1;
      } else if (rarity === 'EPICO') {
        premium += qty * 0.5;
      }
    }
    return { normal: Math.floor(normal), premium: Math.floor(premium) };
  }

  getTotalItemsSelected(): number {
    return this.selectedItems.reduce((s, it) => s + it.quantity, 0);
  }

  async performTradeUp() {
    if (this.selectedItems.length === 0) return;

    if (this.getTotalItemsSelected() < 10) {
      this.error = 'Selecione ao menos 10 itens para realizar a troca';
      setTimeout(() => this.error = '', 5000);
      return;
    }

    const tickets = this.getTotalTickets();
    if (tickets.normal === 0 && tickets.premium === 0) {
      this.error = 'Combinação não gera tickets';
      setTimeout(() => this.error = '', 5000);
      return;
    }

    try {
      this.loading = true;
      const user = await this.auth.getCurrentUser();
      if (!user) return;

      const itemsToTrade = this.selectedItems.map(s => ({
        userItemId: s.userItem.id,
        quantity: s.quantity
      }));

      const result = await this.tradeUpService.performTradeUp(user.uid, itemsToTrade);
      // limpar erros existentes e notificar somente sucesso
      this.error = '';
      this.showNotification('Troca realizada com sucesso', 'success');
      this.selectedItems = [];
      await this.loadUserItems();
      // Atualizar tickets e forçar atualização da navbar/inventário
      await this.ticketService.refreshTickets(user.uid);
      this.eventService.ticketsChanged();
      // Recarregar a página como fallback para garantir consistência imediata no cliente.
      setTimeout(() => {
        try { window.location.reload(); } catch (e) { location.reload(); }
      }, 1200);
    } catch (err: any) {
      console.error('TradeUp error:', err);
      const serverMsg = err?.error?.error || err?.message || 'Erro na troca';
      this.error = serverMsg;
      setTimeout(() => this.error = '', 5000);
    } finally {
      this.loading = false;
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => this.notification.show = false, 5000);
  }
}
