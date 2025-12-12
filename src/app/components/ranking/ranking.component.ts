import { Component, OnInit } from '@angular/core';
import { RankingService, RankingEntry } from '../../services/ranking.service';
import { BoxService } from '../../services/box.service';
import { Box } from '../../models/box.model';

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.scss']
})
export class RankingComponent implements OnInit {
  globalRanking: RankingEntry[] = [];
  boxRanking: RankingEntry[] = [];
  boxes: Box[] = [];
  selectedBoxId: string = '';
  viewMode: 'global' | 'box' = 'global';
  isLoading = false;

  // Modal de detalhes do item
  showItemDetails: boolean = false;
  selectedItemForDetails: any = null;

  notification = {
    show: false,
    message: '',
    type: 'success'
  };

  constructor(
    private rankingService: RankingService,
    private boxService: BoxService
  ) { }

  async ngOnInit() {
    await this.loadBoxes();
    await this.loadGlobalRanking();
  }

  async loadBoxes() {
    try {
      this.boxes = await this.boxService.getActiveBoxes();
    } catch (error) {
      this.showNotification('Erro ao carregar caixas', 'error');
    }
  }

  async loadGlobalRanking() {
    this.isLoading = true;
    try {
      this.globalRanking = await this.rankingService.getGlobalRanking(50);
    } catch (error) {
      this.showNotification('Erro ao carregar ranking global', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async loadBoxRanking() {
    if (!this.selectedBoxId) return;
    
    this.isLoading = true;
    try {
      this.boxRanking = await this.rankingService.getRankingByBox(this.selectedBoxId, 20);
    } catch (error) {
      this.showNotification('Erro ao carregar ranking da caixa', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  onBoxChange() {
    this.loadBoxRanking();
  }

  showItemDetailsModal(item: any) {
    this.selectedItemForDetails = item;
    this.showItemDetails = true;
  }

  closeItemDetailsModal() {
    this.showItemDetails = false;
    this.selectedItemForDetails = null;
  }

  getRarityColor(rarity: string): string {
    const colors: any = {
      'COMUM': '#9CA3AF',
      'RARO': '#3B82F6',
      'EPICO': '#8B5CF6',
      'LENDARIO': '#F59E0B',
      'MITICO': '#EF4444'
    };
    return colors[rarity] || '#9CA3AF';
  }

  getMedalIcon(position: number): string {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '';
  }

  showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => {
      this.notification.show = false;
    }, 4000);
  }
}
