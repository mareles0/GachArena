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
  showResult: boolean = false;

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
      alert('Erro ao carregar dados do gacha: ' + error);
    } finally {
      this.loading = false;
      console.log('Loading finalizado. Boxes:', this.boxes.length);
    }
  }

  selectBox(box: Box) {
    this.selectedBox = box;
    this.showResult = false;
    this.drawnItem = null;
  }

  closeModal() {
    this.selectedBox = null;
    this.showResult = false;
    this.drawnItem = null;
  }

  async openBox() {
    if (!this.selectedBox || this.loading) return;

    const boxType = this.selectedBox.type;
    const hasTicket = boxType === 'NORMAL' 
      ? this.tickets.normalTickets > 0 
      : this.tickets.premiumTickets > 0;

    if (!hasTicket) {
      alert(`Você não tem tickets ${boxType === 'NORMAL' ? 'normais' : 'premium'} suficientes!`);
      return;
    }

    this.loading = true;
    try {
      const used = await this.ticketService.useTicket(this.userId, boxType);
      if (!used) {
        alert('Erro ao usar ticket');
        return;
      }

      this.drawnItem = await this.itemService.drawRandomItem(this.selectedBox.id);
      await this.itemService.addItemToUser(this.userId, this.drawnItem.id);
      this.tickets = await this.ticketService.getUserTickets(this.userId);
      this.showResult = true;

    } catch (error) {
      console.error('Erro ao abrir caixa:', error);
      alert('Erro ao abrir caixa: ' + error);
    } finally {
      this.loading = false;
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
