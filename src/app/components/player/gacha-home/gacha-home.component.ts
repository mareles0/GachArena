import { Component, OnInit, ViewChild, ChangeDetectorRef, ElementRef } from '@angular/core';
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
  revealedMultiResults: Item[] = [];
  private revealTimers: any[] = [];
  isMultiOpening: boolean = false;
  isAnimating: boolean = false;
  resultsReady: boolean = false;

  @ViewChild('multiGrid') multiGrid?: ElementRef<HTMLDivElement>;
  
  openingAnimationType: 'video' | 'gif' | 'auto' = 'auto'; // 'auto' detecta pela extensão
  openingAnimationSrc: string = 'assets/backgrounds/1bb90899170e8e1c2a8888dce944bd99.gif'; // caminho para o vídeo/gif

  // Getter que determina o tipo de animação a ser usado (da caixa ou fallback global)
  get currentAnimationType(): 'video' | 'gif' | null {
    // Só usa animação se a caixa específica tiver uma configurada
    const animationType = this.selectedBox?.openingAnimationType;
    const animationSrc = this.selectedBox?.openingAnimationSrc;

    // Se não há animação específica da caixa, retorna null
    if (!animationSrc) {
      return null;
    }

    if (animationType === 'auto') {
      // Detecta automaticamente pela extensão do arquivo ou pelo tipo MIME
      const extension = animationSrc.split('.').pop()?.toLowerCase();
      const fileName = animationSrc.split('/').pop()?.toLowerCase() || '';

      // Verifica extensão
      if (extension === 'gif' || fileName.includes('.gif')) {
        return 'gif';
      }

      // Verifica se é uma URL do Firebase Storage (geralmente sem extensão clara)
      if (animationSrc.includes('firebasestorage.googleapis.com')) {
        // Para Firebase Storage, tenta detectar pelo nome do arquivo
        if (fileName.includes('gif') || fileName.includes('animation') && !fileName.includes('mp4') && !fileName.includes('webm')) {
          return 'gif';
        }
        return 'video'; // assume vídeo por padrão no Firebase
      }

      // Assume vídeo para outras extensões (mp4, webm, avi, mov, etc.)
      return 'video';
    } else if (animationType === 'video') {
      return 'video';
    } else if (animationType === 'gif') {
      return 'gif';
    } else {
      return null;
    }
  }

  // Getter que retorna o caminho da animação atual (da caixa ou fallback global)
  get currentAnimationSrc(): string | null {
    // Só retorna animação se a caixa específica tiver uma configurada
    return this.selectedBox?.openingAnimationSrc || null;
  }
  
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
    this.isAnimating = false;
    this.resultsReady = false;
    this.multiResults = [];
    this.revealedMultiResults = [];
    // limpar reveals pendentes
    this.revealTimers.forEach(t => clearTimeout(t));
    this.revealTimers = [];
    this.clearAnimationTimeout();
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

    // Verificar se há animação específica da caixa
    const hasAnimation = !!this.selectedBox?.openingAnimationSrc;

    if (hasAnimation) {
      // Iniciar animação imediatamente como loading
      this.isAnimating = true;
      this.startAnimationTimeout(); // Inicia timeout de segurança
      this.cd.detectChanges();
    }

    // Fazer o processamento em paralelo ou depois
    const boxType = this.selectedBox.type;
    const used = await this.ticketService.useTicket(this.userId, boxType);
    if (!used) {
      this.showNotification('❌ Erro ao usar ticket', 'error');
      this.isAnimating = false; // Parar animação se erro
      return;
    }

    this.drawnItem = await this.itemService.drawRandomItem(this.selectedBox.id);
    this.drawnRarityLevel = await this.itemService.addItemToUser(this.userId, this.drawnItem.id);
    await this.ticketService.refreshTickets(this.userId); // Atualizar tickets na navbar
    console.log('[GachaHome] openSingleBox: drawnItem=', this.drawnItem);

    if (hasAnimation) {
      // Marcar que os resultados estão prontos
      this.resultsReady = true;
      // A animação continuará e chamará onAnimationComplete quando terminar
    } else {
      // Não há animação, mostrar resultados imediatamente
      setTimeout(() => {
        this.showResult = true;
        this.loading = false;
      }, 500);
    }
  }

  async openMultiBox() {
    if (!this.selectedBox) return;

    this.isMultiOpening = true;
    this.multiResults = [];
    const required = this.getRequiredTickets();
    const totalOpens = required.normal + required.premium;

    // Verificar se há animação específica da caixa
    const hasAnimation = !!this.selectedBox?.openingAnimationSrc;

    if (hasAnimation) {
      // Iniciar animação imediatamente como loading
      this.isAnimating = true;
      this.startAnimationTimeout(); // Inicia timeout de segurança
      this.cd.detectChanges();
    }

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
      this.showNotification(`🎉 Você abriu ${totalOpens} caixas e ganhou ${this.multiResults.length} itens!`, 'success');

      if (hasAnimation) {
        // Marcar que os resultados estão prontos
        this.resultsReady = true;
        // A animação continuará e chamará onAnimationComplete quando terminar
      } else {
        // Não há animação específica, mostrar resultados imediatamente
        setTimeout(() => {
          this.showResult = true;
          this.loading = false;
          // Iniciar reveal sequencial dos itens
          this.revealMultiResults();
        }, 500);
      }

    } catch (error) {
      console.error('Erro na abertura múltipla:', error);
      this.showNotification('❌ Erro durante abertura múltipla', 'error');
      this.isAnimating = false; // Parar animação se erro
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
    // Animação completa, verificar se resultados estão prontos
    console.log('[GachaHome] Animação de abertura completa');
    this.clearAnimationTimeout();
    
    if (this.resultsReady) {
      // Resultados prontos, mostrar
      this.showResult = true;
      this.loading = false;
      this.isAnimating = false;
      this.resultsReady = false; // Resetar para próximas aberturas
      // Iniciar reveal sequencial dos itens **somente se ainda não começou**
      if (!this.revealedMultiResults || this.revealedMultiResults.length === 0) {
        this.revealMultiResults();
      }
    } else {
      // Resultados ainda não prontos, esperar um pouco
      console.log('[GachaHome] Resultados ainda não prontos, esperando...');
      setTimeout(() => {
        if (this.resultsReady) {
          this.showResult = true;
          this.loading = false;
          this.isAnimating = false;
          this.resultsReady = false;
          if (!this.revealedMultiResults || this.revealedMultiResults.length === 0) {
            this.revealMultiResults();
          }
        } else {
          // Se ainda não estiver pronto, forçar mostrar (fallback)
          console.warn('[GachaHome] Forçando mostrar resultados após timeout');
          this.showResult = true;
          this.loading = false;
          this.isAnimating = false;
          this.resultsReady = false;
          if (!this.revealedMultiResults || this.revealedMultiResults.length === 0) {
            this.revealMultiResults();
          }
        }
      }, 500);
    }
  }

  onVideoError() {
    console.warn('[GachaHome] Erro ao carregar vídeo, tentando fallback...');
    // Se o vídeo falhar, tenta usar GIF ou animação padrão
    if (this.currentAnimationType === 'video' && this.currentAnimationSrc) {
      // Tenta converter para GIF se possível
      const gifSrc = this.currentAnimationSrc.replace(/\.(mp4|webm|avi|mov)$/i, '.gif');
      if (gifSrc !== this.currentAnimationSrc) {
        console.log('[GachaHome] Tentando fallback para GIF:', gifSrc);
        // Força mudança temporária para GIF
        this.forceAnimationType = 'gif';
        this.forceAnimationSrc = gifSrc;
        this.cd.detectChanges();
        return;
      }
    }
    // Se não conseguir fallback, força completar em 3 segundos
    this.forceCompleteAnimation();
  }

  onGifError() {
    console.warn('[GachaHome] Erro ao carregar GIF, usando animação padrão...');
    this.forceCompleteAnimation();
  }

  onGifLoaded() {
    console.log('[GachaHome] GIF carregado, iniciando timeout');
    this.startAnimationTimeout();
    
    // Para GIFs, definir um timeout menor (3 segundos) já que não temos evento de fim
    setTimeout(() => {
      if (this.isAnimating) {
        console.log('[GachaHome] Timeout do GIF atingido, completando animação');
        this.onAnimationComplete();
      }
    }, 3000);
  }

  ensureMuted(event: Event) {
    const video = event.target as HTMLVideoElement;
    if (video) {
      video.muted = true;
      video.volume = 0;
      console.log('[GachaHome] Vídeo garantido como mudo');
    }
  }

  private animationTimeout: any;
  private forceAnimationType: 'video' | 'gif' | null = null;
  private forceAnimationSrc: string | null = null;

  startAnimationTimeout() {
    // Timeout de segurança: força completar após 10 segundos
    this.clearAnimationTimeout();
    this.animationTimeout = setTimeout(() => {
      console.warn('[GachaHome] Timeout da animação excedido, forçando conclusão...');
      this.forceCompleteAnimation();
    }, 10000);
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

  // Override dos getters para forçar tipo quando necessário
  get effectiveAnimationType(): 'video' | 'gif' | null {
    return this.forceAnimationType || this.currentAnimationType;
  }

  get effectiveAnimationSrc(): string | null {
    return this.forceAnimationSrc || this.currentAnimationSrc;
  }

  // Revela os itens do multi-results de forma sequencial (stagger)
  revealMultiResults(delayBetween = 180, startIndex?: number) {
    if (!this.multiResults || this.multiResults.length === 0) return;

    // Adicionar todos os itens de uma vez para animação staggered
    this.revealedMultiResults = [...this.multiResults];
    console.debug('[GachaHome] revealed all', this.multiResults.length, 'items');
    this.cd.detectChanges();

    // Rolar para o fim após a última animação
    const lastAnimationDelay = (this.multiResults.length - 1) * 80 + 480; // delay 0.08s + duration 0.48s
    setTimeout(() => {
      try {
        if (this.multiGrid && this.multiGrid.nativeElement) {
          const el = this.multiGrid.nativeElement as HTMLElement;
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
      } catch (e) { /* ignore */ }
    }, lastAnimationDelay);
  }

  // Método removido - getCardGachaConfig não é mais necessário
  // getCardGachaConfig(): CardGachaConfig {
  //   const results: CardGachaResult[] = [];
  //   if (this.openMode === 'single' && this.drawnItem) {
  //     results.push({
  //       rarity: this.drawnItem.rarity.toLowerCase() as any,
  //       color: this.getRarityColor(this.drawnItem.rarity)
  //     });
  //   } else if (this.openMode === 'multi' && this.multiResults.length > 0) {
  //     this.multiResults.forEach(item => {
  //       results.push({
  //         rarity: item.rarity.toLowerCase() as any,
  //         color: this.getRarityColor(item.rarity)
  //       });
  //     });
  //   }
  //   return {
  //     mode: this.openMode === 'single' ? 'x1' : (this.openMode === 'multi' ? (this.selectedBox?.type === 'NORMAL' ? 'x10' : 'x5') : 'x1'),
  //     results: results
  //   };
  // }
}
