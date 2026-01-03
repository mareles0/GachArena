import { Component, OnInit, ViewChild, ChangeDetectorRef, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { BoxService } from 'src/app/services/box.service';
import { ItemService } from 'src/app/services/item.service';
import { TicketService } from 'src/app/services/ticket.service';
import { EventService } from 'src/app/services/event.service';
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

  openMode: 'single' | 'multi' = 'single';
  multiResults: Item[] = [];
  revealedMultiResults: Item[] = [];
  private revealTimers: any[] = [];
  isMultiOpening: boolean = false;
  isAnimating: boolean = false;
  resultsReady: boolean = false;
  canSkipAnimation: boolean = false;
  currentMultiIndex: number = 0;
  isItemTransitioning: boolean = false;

  @ViewChild('multiGrid') multiGrid?: ElementRef<HTMLDivElement>;
  @ViewChild('openingVideo') openingVideo?: ElementRef<HTMLVideoElement>;
  
  openingAnimationType: 'video' | 'gif' | 'auto' = 'auto';
  openingAnimationSrc: string = 'assets/backgrounds/1bb90899170e8e1c2a8888dce944bd99.gif';

  get currentAnimationType(): 'video' | 'gif' | null {
    const animationType = this.selectedBox?.openingAnimationType;
    const animationSrc = this.selectedBox?.openingAnimationSrc;

    if (!animationSrc) {
      return null;
    }

    if (animationType === 'auto') {
      const extension = animationSrc.split('.').pop()?.toLowerCase();
      const fileName = animationSrc.split('/').pop()?.toLowerCase() || '';

      if (extension === 'gif' || fileName.includes('.gif')) {
        return 'gif';
      }

      if (animationSrc.includes('firebasestorage.googleapis.com')) {
        if (fileName.includes('gif') || fileName.includes('animation') && !fileName.includes('mp4') && !fileName.includes('webm')) {
          return 'gif';
        }
        return 'video';
      }

      return 'video';
    } else if (animationType === 'video') {
      return 'video';
    } else if (animationType === 'gif') {
      return 'gif';
    } else {
      return null;
    }
  }

  get currentAnimationSrc(): string | null {
    return this.selectedBox?.openingAnimationSrc || null;
  }
  
  notification = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  };

  constructor(
    private authService: AuthService,
    private boxService: BoxService,
    private itemService: ItemService,
    private ticketService: TicketService,    private eventService: EventService,    private router: Router
    , private cd: ChangeDetectorRef
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
    
    try {
      this.boxItems = await this.itemService.getItemsByBox(box.id);
      console.log('Itens carregados:', this.boxItems);
      console.log('DropRates:', this.boxItems.map(i => ({ name: i.name, dropRate: i.dropRate })));
      
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
      if (this.selectedBox.type === 'NORMAL') {
        return { normal: 10, premium: 0 };
      } else {
        return { normal: 0, premium: 5 };
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
    this.isAnimating = false;
    this.canSkipAnimation = false;
    this.resultsReady = false;
    this.multiResults = [];
    this.revealedMultiResults = [];
    this.currentMultiIndex = 0;
    this.isItemTransitioning = false;
    this.revealTimers.forEach(t => clearTimeout(t));
    this.revealTimers = [];
    this.clearAnimationTimeout();
    setTimeout(() => window.location.reload(), 500);
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
    }
  }

  async openSingleBox() {
    if (!this.selectedBox) return;

    const hasAnimation = !!this.selectedBox?.openingAnimationSrc;

    if (hasAnimation) {
      this.isAnimating = true;
      this.canSkipAnimation = true;
      this.startAnimationTimeout();
      this.cd.detectChanges();
    }

    const boxType = this.selectedBox.type;
    const used = await this.ticketService.useTicket(this.userId, boxType);
    if (!used) {
      this.showNotification('❌ Erro ao usar ticket', 'error');
      this.isAnimating = false;
      this.canSkipAnimation = false;
      return;
    }

    this.drawnItem = await this.itemService.drawRandomItem(this.selectedBox.id);
    this.drawnRarityLevel = await this.itemService.addItemToUser(this.userId, this.drawnItem.id);
    await this.ticketService.refreshTickets(this.userId);
    console.log('[GachaHome] openSingleBox: drawnItem=', this.drawnItem);
    
    this.eventService.boxesOpened();
    this.eventService.itemsChanged();
    this.eventService.ticketsChanged();

    if (hasAnimation) {
      this.resultsReady = true;
    } else {
      setTimeout(() => {
        this.showResult = true;
        this.loading = false;
      }, 500);
    }
  }

  async openMultiBox() {
    if (!this.selectedBox) return;

    const required = this.getRequiredTickets();
    if (!this.hasEnoughTickets()) {
      this.showNotification(`❌ Tickets insuficientes! Você precisa de ${required.normal || required.premium} tickets para abrir ${required.normal || required.premium} caixas.`, 'error');
      return;
    }

    this.isMultiOpening = true;
    this.multiResults = [];
    const totalOpens = required.normal + required.premium;

    const hasAnimation = !!this.selectedBox?.openingAnimationSrc;

    if (hasAnimation) {
      this.isAnimating = true;
      this.canSkipAnimation = true;
      this.startAnimationTimeout();
      this.cd.detectChanges();
    }

    try {
      if (this.selectedBox.type === 'NORMAL') {
        const used = await this.ticketService.useTicket(this.userId, 'NORMAL', required.normal);
        if (!used) {
          throw new Error('Falha ao usar tickets normais');
        }
        
        const promises = Array.from({ length: required.normal }, async (_, i) => {
          try {
            const item = await this.itemService.drawRandomItem(this.selectedBox!.id);
            await this.itemService.addItemToUser(this.userId, item.id);
            console.log(`[GachaHome] Item ${i+1} obtido:`, item.name);
            return item;
          } catch (itemError) {
            console.error(`[GachaHome] Erro ao processar item ${i+1}:`, itemError);
            return null;
          }
        });

        const results = await Promise.all(promises);
        this.multiResults = results.filter((item): item is Item => item !== null);
      } else {
        const used = await this.ticketService.useTicket(this.userId, 'PREMIUM', required.premium);
        if (!used) {
          throw new Error('Falha ao usar tickets premium');
        }
        
        const promises = Array.from({ length: required.premium }, async (_, i) => {
          try {
            const item = await this.itemService.drawRandomItem(this.selectedBox!.id);
            await this.itemService.addItemToUser(this.userId, item.id);
            console.log(`[GachaHome] Item ${i+1} obtido:`, item.name);
            return item;
          } catch (itemError) {
            console.error(`[GachaHome] Erro ao processar item premium ${i+1}:`, itemError);
            return null;
          }
        });

        const results = await Promise.all(promises);
        this.multiResults = results.filter((item): item is Item => item !== null);
      }

      this.tickets = await this.ticketService.getUserTickets(this.userId);
      this.showNotification(`🎉 Você abriu ${totalOpens} caixas e ganhou ${this.multiResults.length} itens!`, 'success');
      
      this.eventService.boxesOpened();
      this.eventService.itemsChanged();
      this.eventService.ticketsChanged();

      if (hasAnimation) {
        this.resultsReady = true;
      } else {
        setTimeout(() => {
          this.showResult = true;
          this.loading = false;
          this.revealMultiResults();
        }, 500);
      }

    } catch (error) {
      console.error('Erro na abertura múltipla:', error);
      this.showNotification('❌ Erro durante abertura múltipla', 'error');
      this.isAnimating = false;
      this.canSkipAnimation = false;
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

  onAnimationComplete() {
    console.log('[GachaHome] Animação de abertura completa');
    this.clearAnimationTimeout();
    
    if (this.resultsReady) {
      this.showResult = true;
      this.loading = false;
      this.isAnimating = false;
      this.canSkipAnimation = false;
      this.resultsReady = false;
      if (!this.revealedMultiResults || this.revealedMultiResults.length === 0) {
        this.revealMultiResults();
      }
    } else {
      console.log('[GachaHome] Resultados ainda não prontos, esperando...');
      setTimeout(() => {
        if (this.resultsReady) {
          this.showResult = true;
          this.loading = false;
          this.isAnimating = false;
          this.canSkipAnimation = false;
          this.resultsReady = false;
          if (!this.revealedMultiResults || this.revealedMultiResults.length === 0) {
            this.revealMultiResults();
          }
        } else {
          console.warn('[GachaHome] Forçando mostrar resultados após timeout');
          this.showResult = true;
          this.loading = false;
          this.isAnimating = false;
          this.canSkipAnimation = false;
          this.resultsReady = false;
          if (!this.revealedMultiResults || this.revealedMultiResults.length === 0) {
            this.revealMultiResults();
          }
        }
      }, 500);
    }
  }

  skipAnimation() {
    console.log('[GachaHome] Usuário pulou a animação');
    this.clearAnimationTimeout();
    this.onAnimationComplete();
  }

  onVideoError() {
    console.log('[GachaHome] Vídeo não encontrado ou erro ao carregar. Usando animação fallback.');
    if (this.currentAnimationType === 'video' && this.currentAnimationSrc) {
      const gifSrc = this.currentAnimationSrc.replace(/\.(mp4|webm|avi|mov)$/i, '.gif');
      if (gifSrc !== this.currentAnimationSrc) {
        console.log('[GachaHome] Tentando fallback para GIF:', gifSrc);
        this.forceAnimationType = 'gif';
        this.forceAnimationSrc = gifSrc;
        this.cd.detectChanges();
        return;
      }
    }
    this.forceAnimationType = null;
    this.forceAnimationSrc = null;
    this.cd.detectChanges();
    this.forceCompleteAnimation();
  }

  onGifError() {
    console.log('[GachaHome] GIF não encontrado ou erro ao carregar. Usando animação padrão.');
    this.forceAnimationType = null;
    this.forceAnimationSrc = null;
    this.cd.detectChanges();
    this.forceCompleteAnimation();
  }

  onGifLoaded() {
    console.log('[GachaHome] GIF carregado, definindo duração padrão de 8 segundos');
    this.startAnimationTimeout(8000);
  }

  ensureMuted(event: Event) {
    const video = event.target as HTMLVideoElement;
    if (video) {
      video.muted = true;
      video.volume = 0;
      console.log('[GachaHome] Vídeo garantido como mudo');
    }
  }

  onVideoMetadata(event: Event) {
    const video = event.target as HTMLVideoElement;
    if (video && !isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
      const ms = Math.ceil(video.duration * 1000) + 300;
      console.log('[GachaHome] Duração do vídeo detectada:', video.duration, 's => timeout', ms, 'ms');
      this.startAnimationTimeout(ms);
    } else {
      this.startAnimationTimeout(10000);
    }
    this.ensureMuted(event);
  }

  private animationTimeout: any;
  private forceAnimationType: 'video' | 'gif' | null = null;
  private forceAnimationSrc: string | null = null;

  startAnimationTimeout(durationMs?: number) {
    this.clearAnimationTimeout();
    const timeout = typeof durationMs === 'number' ? durationMs : 10000;
    this.animationTimeout = setTimeout(() => {
      console.warn('[GachaHome] Timeout da animação excedido, forçando conclusão...');
      this.forceCompleteAnimation();
    }, timeout);
  }

  clearAnimationTimeout() {
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
      this.animationTimeout = null;
    }
  }

  forceCompleteAnimation() {
    this.clearAnimationTimeout();
    this.forceAnimationType = null;
    this.forceAnimationSrc = null;
    this.onAnimationComplete();
  }

  get effectiveAnimationType(): 'video' | 'gif' | null {
    return this.forceAnimationType || this.currentAnimationType;
  }

  get effectiveAnimationSrc(): string | null {
    return this.forceAnimationSrc || this.currentAnimationSrc;
  }

  revealMultiResults(delayBetween = 180, startIndex?: number) {
    if (!this.multiResults || this.multiResults.length === 0) return;

    const start = startIndex ?? 0;
    this.currentMultiIndex = start;
    this.revealedMultiResults = [this.multiResults[start]];
    this.isItemTransitioning = false;
    console.debug('[GachaHome] revealed first item of', this.multiResults.length, 'items');
    this.cd.detectChanges();
  }

  nextMultiItem() {
    if (this.currentMultiIndex < this.multiResults.length - 1 && !this.isItemTransitioning) {
      this.isItemTransitioning = true;
      
      this.cd.detectChanges();
      
      setTimeout(() => {
        this.currentMultiIndex++;
        this.revealedMultiResults = [this.multiResults[this.currentMultiIndex]];
        
        setTimeout(() => {
          this.isItemTransitioning = false;
          console.debug('[GachaHome] showing item', this.currentMultiIndex + 1, 'of', this.multiResults.length);
          this.cd.detectChanges();
        }, 100);
        
        this.cd.detectChanges();
      }, 600);
    } else if (this.currentMultiIndex >= this.multiResults.length - 1) {
      console.debug('[GachaHome] already at last item');
    }
  }

  skipMultiReveal() {
    this.revealedMultiResults = [...this.multiResults];
    this.currentMultiIndex = this.multiResults.length - 1;
    console.debug('[GachaHome] skipped to show all', this.multiResults.length, 'items');
    this.cd.detectChanges();
  }

  skipToAllItems() {
    this.skipMultiReveal();
  }

}
