import { Component, EventEmitter, Input, OnInit, Output, HostListener } from '@angular/core';
import { ItemService } from '../../services/item.service';
import { AuthService } from '../../services/auth.service';
import { TradeService } from '../../services/trade.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-trade-modal',
  templateUrl: './trade-modal.component.html',
  styleUrls: ['./trade-modal.component.scss']
})
export class TradeModalComponent implements OnInit {
  @Input() targetUserId!: string;
  @Input() targetUsername?: string;
  @Input() targetUserPhoto?: string;
  @Output() closed = new EventEmitter<boolean>();

  myItems: any[] = [];
  targetItems: any[] = [];

  selectedOffered: Set<string> = new Set();
  selectedRequested: Set<string> = new Set();

  hoveredItem: any = null;

  tooltipX: number = 0;
  tooltipY: number = 0;

  readonly maxPerSide = 6;

  loading = false;
  error = '';
  success = '';
  notification = { show: false, message: '', type: 'success' as 'success' | 'error' | 'info' };

  get offeredCount() { return this.selectedOffered.size; }
  get requestedCount() { return this.selectedRequested.size; }

  canSubmit() {
    return this.offeredCount > 0 && this.requestedCount > 0 && this.offeredCount <= this.maxPerSide && this.requestedCount <= this.maxPerSide;
  }

  constructor(private itemService: ItemService, private auth: AuthService, private tradeService: TradeService, private userService: UserService) {}

  async ngOnInit() {
    const me = this.auth.currentUser;
    if (!me || !this.targetUserId) { 
      this.showNotification('❌ Usuário inválido', 'error'); 
      return; 
    }

    try {
      this.myItems = await this.itemService.getUserItems(me.uid);
      this.targetItems = await this.itemService.getUserItems(this.targetUserId);
    } catch (err: any) {
      console.error('Erro ao carregar itens:', err);
      this.showNotification('❌ Erro ao carregar itens', 'error');
    }
  }

  toggleOffer(id: string) {
    if (this.selectedOffered.has(id)) { 
      this.selectedOffered.delete(id); 
      this.error = ''; 
      return; 
    }
    if (this.selectedOffered.size >= this.maxPerSide) { 
      this.showNotification(`❌ Você pode oferecer no máximo ${this.maxPerSide} cartas`, 'error');
      return; 
    }
    this.selectedOffered.add(id); 
    this.error = '';
  }

  toggleRequest(id: string) {
    if (this.selectedRequested.has(id)) { 
      this.selectedRequested.delete(id); 
      this.error = ''; 
      return; 
    }
    if (this.selectedRequested.size >= this.maxPerSide) { 
      this.showNotification(`❌ Você pode solicitar no máximo ${this.maxPerSide} cartas`, 'error');
      return; 
    }
    this.selectedRequested.add(id); 
    this.error = '';
  }

  async submitProposal() {
    this.error = '';
    this.success = '';
    const me = this.auth.currentUser;
    if (!me) { 
      this.showNotification('❌ Usuário não autenticado', 'error'); 
      return; 
    }
    if (!this.targetUserId) { 
      this.showNotification('❌ Destinatário inválido', 'error'); 
      return; 
    }

    if (this.selectedOffered.size === 0 || this.selectedRequested.size === 0) {
      this.showNotification('❌ Selecione ao menos 1 carta oferecida e 1 solicitada', 'error');
      return;
    }

    if (this.selectedOffered.size > this.maxPerSide || this.selectedRequested.size > this.maxPerSide) {
      this.showNotification(`❌ Limite excedido: máximo ${this.maxPerSide} por lado.`, 'error');
      return;
    }

    try {
      this.loading = true;
      
      const meDoc = await this.userService.getUserById(me.uid);
      const fromUsername = meDoc?.username || me.email || '';
      
      const trade = {
        fromUserId: me.uid,
        fromUsername: fromUsername,
        toUserId: this.targetUserId,
        toUsername: this.targetUsername || '',
        offeredUserItemIds: Array.from(this.selectedOffered),
        requestedUserItemIds: Array.from(this.selectedRequested),
      } as any;

      const id = await this.tradeService.createTrade(trade);
      this.showNotification('✅ Proposta enviada com sucesso!', 'success');
      setTimeout(() => {
        this.closed.emit(true);
        window.location.reload();
      }, 1000);
    } catch (err:any) {
      console.error('Erro ao criar proposta de troca', err);
      const errorMsg = err?.error?.error || err?.message || 'Erro ao enviar proposta';
      this.showNotification(`❌ ${errorMsg}`, 'error');
    } finally { this.loading = false; }
  }

  close() {
    this.closed.emit(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(e: any) { this.close(); }

  showHover(it: any, event: MouseEvent) {
    console.log('hover', it);
    this.hoveredItem = it;
    this.tooltipX = event.clientX;
    this.tooltipY = event.clientY;
  }

  hideHover() {
    console.log('leave');
    this.hoveredItem = null;
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    this.notification = { show: true, message, type };
    setTimeout(() => this.notification.show = false, 5000);
  }
}
