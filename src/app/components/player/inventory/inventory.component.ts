import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ItemService } from 'src/app/services/item.service';
import { UserItem } from 'src/app/models/item.model';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  userItems: UserItem[] = [];
  filteredItems: UserItem[] = [];
  loading: boolean = false;
  selectedRarity: string = 'ALL';
  userId: string = '';

  rarities = ['ALL', 'COMUM', 'RARO', 'EPICO', 'LENDARIO', 'MITICO'];

  // Modal de detalhes do item
  showItemDetails: boolean = false;
  selectedItemForDetails: any = null;

  // Sistema de notificações
  notification = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  };

  constructor(
    private authService: AuthService,
    private itemService: ItemService,
    private router: Router
  ) { }

  async ngOnInit() {
    const user = await this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.userId = user.uid;
    await this.loadInventory();
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
    const rarityOrder: any = { 'MITICO': 5, 'LENDARIO': 4, 'EPICO': 3, 'RARO': 2, 'COMUM': 1 };
    this.filteredItems.sort((a, b) => {
      const rarityDiff = rarityOrder[b.item.rarity] - rarityOrder[a.item.rarity];
      if (rarityDiff !== 0) return rarityDiff;
      return b.item.power - a.item.power;
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
}
