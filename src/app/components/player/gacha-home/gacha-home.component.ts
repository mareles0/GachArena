import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { BoxService } from 'src/app/services/box.service';
import { ItemService } from 'src/app/services/item.service';
import { TicketService } from 'src/app/services/ticket.service';
import { Box } from 'src/app/models/box.model';
import { Ticket } from 'src/app/models/ticket.model';
import { Item } from 'src/app/models/item.model';

@Component({
  selector: 'app-gacha-home',
  templateUrl: './gacha-home.component.html',
  styleUrls: ['./gacha-home.component.scss']
})
export class GachaHomeComponent implements OnInit {
  boxes: Box[] = [];
  tickets: Ticket = { normalTickets: 0, premiumTickets: 0 };
  userId: string = '';
  loading: boolean = false;
  selectedBox: Box | null = null;
  drawnItem: Item | null = null;
  drawnRarityLevel: number = 0;
  showResult: boolean = false;
  boxItems: Item[] = [];
  showDropRates: boolean = false;

  // Modo de abertura
  openMode: 'single' | 'multi' = 'single';
  multiResults: Item[] = [];
  isMultiOpening: boolean = false;

  // Sistema de notificações
  notification = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  };

  constructor(
    private authService: AuthService,
    private boxService: BoxService,
    private itemService: ItemService,
    private ticketService: TicketService,
    private router: Router
  ) { }

  async ngOnInit() {
    const user = await this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.userId = user.uid;
    await this.loadData();
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    this.notification = { show: true, message, type };
    setTimeout(() => {
      this.notification.show = false;
    }, 4000);
  }

  async loadData() {
    this.loading = true;
    try {
      console.log('Carregando caixas...');
      this.boxes = await this.boxService.getActiveBoxes();
      console.log('Caixas carregadas:', this.boxes.length, this.boxes);
      this.tickets = await this.ticketService.getUserTickets(this.userId);
      console.log('Tickets carregados:', this.tickets);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.showNotification('❌ Erro ao carregar dados do gacha', 'error');
    } finally {
      this.loading = false;
      console.log('Loading finalizado. Boxes:', this.boxes.length);
    }
  }

  async selectBox(box: Box) {
    this.selectedBox = box;
    this.showResult = false;
    this.drawnItem = null;
    this.drawnRarityLevel = 0;
    this.showDropRates = false;
    this.openMode = 'single';
    this.multiResults = [];
    this.isMultiOpening = false;
    
    // Carregar itens da caixa
    try {
      this.boxItems = await this.itemService.getItemsByBox(box.id);
      console.log('Itens carregados:', this.boxItems);
      console.log('DropRates:', this.boxItems.map(i => ({ name: i.name, dropRate: i.dropRate })));
      
      // Ordenar por raridade e depois por dropRate
      this.boxItems.sort((a, b) => {
        const rarityOrder: any = { 'MITICO': 5, 'LENDARIO': 4, 'EPICO': 3, 'RARO': 2, 'COMUM': 1 };
        const rarityDiff = rarityOrder[b.rarity] - rarityOrder[a.rarity];
        if (rarityDiff !== 0) return rarityDiff;
        return (b.dropRate || 0) - (a.dropRate || 0);
      });
    } catch (error) {
      console.error('Erro ao carregar itens da caixa:', error);
    }
  }

  setOpenMode(mode: 'single' | 'multi') {
    this.openMode = mode;
    this.showResult = false;
    this.drawnItem = null;
    this.multiResults = [];
    this.isMultiOpening = false;
  }

  getRequiredTickets(): { normal: number, premium: number } {
    if (!this.selectedBox) return { normal: 0, premium: 0 };

    if (this.openMode === 'single') {
      return this.selectedBox.type === 'NORMAL' 
        ? { normal: 1, premium: 0 }
        : { normal: 0, premium: 1 };
    } else {
      // Modo multi: depende do tipo da caixa
      if (this.selectedBox.type === 'NORMAL') {
        return { normal: 10, premium: 0 }; // 10 caixas normais
      } else {
        return { normal: 0, premium: 5 }; // 5 caixas premium
      }
    }
  }

  hasEnoughTickets(): boolean {
    const required = this.getRequiredTickets();
    return this.tickets.normalTickets >= required.normal && 
           this.tickets.premiumTickets >= required.premium;
  }

  toggleDropRates() {
    this.showDropRates = !this.showDropRates;
  }

  closeModal() {
    this.selectedBox = null;
    this.showResult = false;
    this.drawnItem = null;
    this.drawnRarityLevel = 0;
  }

  async openBox() {
    if (!this.selectedBox || this.loading) return;

    if (!this.hasEnoughTickets()) {
      const required = this.getRequiredTickets();
      this.showNotification(`❌ Você não tem tickets suficientes! Precisa de ${required.normal} normais e ${required.premium} premium.`, 'error');
      return;
    }

    this.loading = true;
    try {
      if (this.openMode === 'single') {
        await this.openSingleBox();
      } else {
        await this.openMultiBox();
      }
    } catch (error) {
      console.error('Erro ao abrir caixa:', error);
      this.showNotification('❌ Erro ao abrir caixa', 'error');
    } finally {
      this.loading = false;
    }
  }

  async openSingleBox() {
    if (!this.selectedBox) return;

    const boxType = this.selectedBox.type;
    const used = await this.ticketService.useTicket(this.userId, boxType);
    if (!used) {
      this.showNotification('❌ Erro ao usar ticket', 'error');
      return;
    }

    this.drawnItem = await this.itemService.drawRandomItem(this.selectedBox.id);
    this.drawnRarityLevel = await this.itemService.addItemToUser(this.userId, this.drawnItem.id);
    await this.ticketService.refreshTickets(this.userId); // Atualizar tickets na navbar
    this.showResult = true;
  }

  async openMultiBox() {
    if (!this.selectedBox) return;

    this.isMultiOpening = true;
    this.multiResults = [];
    const required = this.getRequiredTickets();
    const totalOpens = required.normal + required.premium;

    try {
      // Abrir caixas baseado no tipo selecionado
      if (this.selectedBox.type === 'NORMAL') {
        // Abrir 10 caixas normais
        for (let i = 0; i < required.normal; i++) {
          const used = await this.ticketService.useTicket(this.userId, 'NORMAL');
          if (used) {
            const item = await this.itemService.drawRandomItem(this.selectedBox.id);
            await this.itemService.addItemToUser(this.userId, item.id);
            this.multiResults.push(item);
          }
        }
      } else {
        // Abrir 5 caixas premium
        for (let i = 0; i < required.premium; i++) {
          const used = await this.ticketService.useTicket(this.userId, 'PREMIUM');
          if (used) {
            const item = await this.itemService.drawRandomItem(this.selectedBox.id);
            await this.itemService.addItemToUser(this.userId, item.id);
            this.multiResults.push(item);
          }
        }
      }

      this.tickets = await this.ticketService.getUserTickets(this.userId);
      this.showResult = true;
      this.showNotification(`🎉 Você abriu ${totalOpens} caixas e ganhou ${this.multiResults.length} itens!`, 'success');

    } catch (error) {
      console.error('Erro na abertura múltipla:', error);
      this.showNotification('❌ Erro durante abertura múltipla', 'error');
    } finally {
      this.isMultiOpening = false;
    }
  }

  getRarityClass(rarity: string): string {
    const classes: any = {
      'COMUM': 'rarity-comum',
      'RARO': 'rarity-raro',
      'EPICO': 'rarity-epico',
      'LENDARIO': 'rarity-lendario',
      'MITICO': 'rarity-mitico'
    };
    return classes[rarity] || '';
  }

  getRarityColor(rarity: string): string {
    const colors: any = {
      'COMUM': '#9e9e9e',
      'RARO': '#4fc3f7',
      'EPICO': '#ba68c8',
      'LENDARIO': '#ffd54f',
      'MITICO': '#ff6f00'
    };
    return colors[rarity] || '#fff';
  }
}
