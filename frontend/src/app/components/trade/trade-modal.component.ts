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

  readonly maxPerSide = 6; // limite UX

  loading = false;
  error = '';
  success = '';

  get offeredCount() { return this.selectedOffered.size; }
  get requestedCount() { return this.selectedRequested.size; }

  canSubmit() {
    return this.offeredCount > 0 && this.requestedCount > 0 && this.offeredCount <= this.maxPerSide && this.requestedCount <= this.maxPerSide;
  }

  constructor(private itemService: ItemService, private auth: AuthService, private tradeService: TradeService, private userService: UserService) {}

  async ngOnInit() {
    const me = this.auth.currentUser;
    if (!me || !this.targetUserId) { this.error = 'Usuário inválido'; return; }

    this.myItems = await this.itemService.getUserItems(me.uid);
    this.targetItems = await this.itemService.getUserItems(this.targetUserId);
  }

  toggleOffer(id: string) {
    if (this.selectedOffered.has(id)) { 
      this.selectedOffered.delete(id); 
      this.error = ''; 
      return; 
    }
    if (this.selectedOffered.size >= this.maxPerSide) { 
      this.error = `Você pode oferecer no máximo ${this.maxPerSide} cartas`; 
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
      this.error = `Você pode solicitar no máximo ${this.maxPerSide} cartas`; 
      return; 
    }
    this.selectedRequested.add(id); 
    this.error = '';
  }

  async submitProposal() {
    this.error = '';
    this.success = '';
    const me = this.auth.currentUser;
    if (!me) { this.error = 'Usuário não autenticado'; return; }
    if (!this.targetUserId) { this.error = 'Destinatário inválido'; return; }

    if (this.selectedOffered.size === 0 || this.selectedRequested.size === 0) {
      this.error = 'Selecione ao menos 1 carta oferecida e 1 solicitada';
      return;
    }

    if (this.selectedOffered.size > this.maxPerSide || this.selectedRequested.size > this.maxPerSide) {
      this.error = `Limite excedido: máximo ${this.maxPerSide} por lado.`;
      return;
    }

    try {
      this.loading = true;
      
      // Buscar username do usuário atual
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
      this.success = 'Proposta enviada!';
      setTimeout(() => this.closed.emit(true), 900);
    } catch (err:any) {
      console.error('Erro ao criar proposta de troca', err);
      this.error = err?.message || 'Erro ao enviar proposta';
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
}
