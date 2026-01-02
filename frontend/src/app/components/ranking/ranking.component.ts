import { Component, OnInit, OnDestroy } from '@angular/core';
import { RankingService, RankingEntry } from '../../services/ranking.service';
import { BoxService } from '../../services/box.service';
import { Box } from '../../models/box.model';
import { EventService } from '../../services/event.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.scss']
})
export class RankingComponent implements OnInit, OnDestroy {
  globalRanking: RankingEntry[] = [];
  boxRanking: RankingEntry[] = [];
  boxes: Box[] = [];
  selectedBoxId: string = '';
  viewMode: 'global' | 'box' = 'global';
  isLoading = false;
  
  private eventSubscription?: Subscription;

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
    private boxService: BoxService,
    private eventService: EventService
  ) { }

  async ngOnInit() {
    await this.loadBoxes();
    await this.loadGlobalRanking();
    
    // Escutar eventos para atualizar ranking em tempo real
    this.eventSubscription = this.eventService.events$.subscribe(event => {
      if (event === 'userDataChanged' || event === 'itemsChanged') {
        console.log('[Ranking] Evento recebido:', event, '- recarregando ranking');
        if (this.viewMode === 'global') {
          this.loadGlobalRanking();
        } else if (this.selectedBoxId) {
          this.loadBoxRanking();
        }
      }
    });
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
      console.log('[Ranking] Loading box ranking for boxId:', this.selectedBoxId);
      this.boxRanking = await this.rankingService.getRankingByBox(this.selectedBoxId, 20);
      console.log('[Ranking] Loaded box ranking count:', this.boxRanking.length);
    } catch (error) {
      this.showNotification('Erro ao carregar ranking da caixa', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  onBoxChange() {
    this.loadBoxRanking();
  }

  async selectView(mode: 'global' | 'box') {
    this.viewMode = mode;
    if (mode === 'global') {
      await this.loadGlobalRanking();
    } else if (mode === 'box' && this.selectedBoxId) {
      await this.loadBoxRanking();
    } else if (mode === 'box' && !this.selectedBoxId && this.boxes.length > 0) {
      // auto-select first box when switching to box view if none selected
      this.selectedBoxId = this.boxes[0].id;
      await this.loadBoxRanking();
    }
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

  isVideoUrl(url?: string | null): boolean {
    if (!url) return false;
    return /\.(webm|mp4)$/i.test(url);
  }

  isGifUrl(url?: string | null): boolean {
    if (!url) return false;
    return /\.(gif)$/i.test(url);
  }

  showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => {
      this.notification.show = false;
    }, 4000);
  }
  
  ngOnDestroy() {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }
}
