import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ItemService } from 'src/app/services/item.service';
import { EventService } from 'src/app/services/event.service';
import { UserItem } from 'src/app/models/item.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit, OnDestroy {
  userItems: UserItem[] = [];
  filteredItems: UserItem[] = [];
  loading: boolean = false;
  selectedRarity: string = 'ALL';
  userId: string = '';
  
  private eventSubscription?: Subscription;

  rarities = ['ALL', 'COMUM', 'RARO', 'EPICO', 'LENDARIO', 'MITICO'];

  showItemDetails: boolean = false;
  selectedItemForDetails: any = null;

  notification = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  };

  constructor(
    private authService: AuthService,
    private itemService: ItemService,
    private router: Router,
    private eventService: EventService
  ) { }

  async ngOnInit() {
    const user = await this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.userId = user.uid;
    await this.loadInventory();
    
    this.eventSubscription = this.eventService.events$.subscribe(event => {
      if (event === 'itemsChanged') {
        console.log('[Inventory] Evento itemsChanged recebido - recarregando inventário');
        this.loadInventory();
      }
    });
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    this.notification = { show: true, message, type };
    setTimeout(() => {
      this.notification.show = false;
    }, 4000);
  }

  async loadInventory() {
    this.loading = true;
    try {
      this.userItems = await this.itemService.getUserItems(this.userId);
      this.filteredItems = [...this.userItems];
      this.sortByRarity();
    } catch (error) {
      console.error('Erro ao carregar inventário:', error);
      this.showNotification('❌ Erro ao carregar inventário', 'error');
    } finally {
      this.loading = false;
    }
  }

  filterByRarity(rarity: string) {
    this.selectedRarity = rarity;
    if (rarity === 'ALL') {
      this.filteredItems = [...this.userItems];
    } else {
      this.filteredItems = this.userItems.filter(ui => ui.item.rarity === rarity);
    }
    this.sortByRarity();
  }

  sortByRarity() {
    this.filteredItems.sort((a, b) => {
      let scoreA = a.item.points || 0;
      let scoreB = b.item.points || 0;
      
      if ((a.item.rarity === 'LENDARIO' || a.item.rarity === 'MITICO') && a.rarityLevel) {
        const rarityMultiplierA = 1 + ((1000 - a.rarityLevel) / 1000);
        scoreA = scoreA * rarityMultiplierA;
      }
      
      if ((b.item.rarity === 'LENDARIO' || b.item.rarity === 'MITICO') && b.rarityLevel) {
        const rarityMultiplierB = 1 + ((1000 - b.rarityLevel) / 1000);
        scoreB = scoreB * rarityMultiplierB;
      }
      
      return scoreB - scoreA;
    });
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

  getTotalPower(): number {
    return this.userItems.reduce((sum, ui) => sum + ui.item.power, 0);
  }

  showItemDetailsModal(item: any) {
    this.selectedItemForDetails = item;
    this.showItemDetails = true;
  }

  closeItemDetailsModal() {
    this.showItemDetails = false;
    this.selectedItemForDetails = null;
  }
  
  ngOnDestroy() {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }
}
