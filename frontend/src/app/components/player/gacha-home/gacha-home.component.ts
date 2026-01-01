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
  canSkipAnimation: boolean = false;
  currentMultiIndex: number = 0;
  isItemTransitioning: boolean = false;

  @ViewChild('multiGrid') multiGrid?: ElementRef<HTMLDivElement>;
  @ViewChild('openingVideo') openingVideo?: ElementRef<HTMLVideoElement>;
  
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
    this.canSkipAnimation = false;
    this.resultsReady = false;
    this.multiResults = [];
    this.revealedMultiResults = [];
    this.currentMultiIndex = 0;
    this.isItemTransitioning = false;
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
      this.canSkipAnimation = true;
      this.startAnimationTimeout(); // Inicia timeout de segurança
      this.cd.detectChanges();
    }

    // Fazer o processamento em paralelo ou depois
    const boxType = this.selectedBox.type;
    const used = await this.ticketService.useTicket(this.userId, boxType);
    if (!used) {
      this.showNotification('❌ Erro ao usar ticket', 'error');
      this.isAnimating = false; // Parar animação se erro
      this.canSkipAnimation = false;
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

    // Validar tickets ANTES de começar
    const required = this.getRequiredTickets();
    if (!this.hasEnoughTickets()) {
      this.showNotification(`❌ Tickets insuficientes! Você precisa de ${required.normal || required.premium} tickets para abrir ${required.normal || required.premium} caixas.`, 'error');
      return;
    }

    this.isMultiOpening = true;
    this.multiResults = [];
    const totalOpens = required.normal + required.premium;

    // Verificar se há animação específica da caixa
    const hasAnimation = !!this.selectedBox?.openingAnimationSrc;

    if (hasAnimation) {
      // Iniciar animação imediatamente como loading
      this.isAnimating = true;
      this.canSkipAnimation = true;
      this.startAnimationTimeout(); // Inicia timeout de segurança
      this.cd.detectChanges();
    }

    try {
      // Abrir caixas baseado no tipo selecionado - PROCESSAMENTO EM PARALELO
      if (this.selectedBox.type === 'NORMAL') {
        // Abrir 10 caixas normais em paralelo
        const promises = Array.from({ length: required.normal }, async (_, i) => {
          try {
            const used = await this.ticketService.useTicket(this.userId, 'NORMAL');
            if (!used) {
              console.error(`[GachaHome] Falha ao usar ticket ${i+1}`);
              return null;
            }
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
        // Abrir 5 caixas premium em paralelo
        const promises = Array.from({ length: required.premium }, async (_, i) => {
          try {
            const used = await this.ticketService.useTicket(this.userId, 'PREMIUM');
            if (!used) {
              console.error(`[GachaHome] Falha ao usar ticket premium ${i+1}`);
              return null;
            }
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
    // Animação completa, verificar se resultados estão prontos
    console.log('[GachaHome] Animação de abertura completa');
    this.clearAnimationTimeout();
    
    if (this.resultsReady) {
      // Resultados prontos, mostrar
      this.showResult = true;
      this.loading = false;
      this.isAnimating = false;
      this.canSkipAnimation = false;
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
          this.canSkipAnimation = false;
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
    // Se não conseguir fallback, força completar em 3 segundos com animação padrão
    this.forceAnimationType = null;
    this.forceAnimationSrc = null;
    this.cd.detectChanges();
    this.forceCompleteAnimation();
  }

  onGifError() {
    console.log('[GachaHome] GIF não encontrado ou erro ao carregar. Usando animação padrão.');
    // Usar animação fallback
    this.forceAnimationType = null;
    this.forceAnimationSrc = null;
    this.cd.detectChanges();
    this.forceCompleteAnimation();
  }

  onGifLoaded() {
    console.log('[GachaHome] GIF carregado, definindo duração padrão de 8 segundos');
    // Para GIFs (ou enquanto estiver convertendo GIFs para vídeos), usar duração padrão de 8s
    this.startAnimationTimeout(8000);
    // O próprio timeout chamará forceCompleteAnimation() que executará onAnimationComplete()
  }

  ensureMuted(event: Event) {
    const video = event.target as HTMLVideoElement;
    if (video) {
      video.muted = true;
      video.volume = 0;
      console.log('[GachaHome] Vídeo garantido como mudo');
    }
  }

  // Quando o metadado do vídeo carrega, usamos a duração real para o timeout
  onVideoMetadata(event: Event) {
    const video = event.target as HTMLVideoElement;
    if (video && !isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
      const ms = Math.ceil(video.duration * 1000) + 300; // pequeno buffer
      console.log('[GachaHome] Duração do vídeo detectada:', video.duration, 's => timeout', ms, 'ms');
      this.startAnimationTimeout(ms);
    } else {
      // fallback para 10s se não for possível detectar
      this.startAnimationTimeout(10000);
    }
    // Garante mudo também
    this.ensureMuted(event);
  }

  private animationTimeout: any;
  private forceAnimationType: 'video' | 'gif' | null = null;
  private forceAnimationSrc: string | null = null;

  startAnimationTimeout(durationMs?: number) {
    // Timeout de segurança: força completar após durationMs (ms) ou 10 segundos por padrão
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

    const start = startIndex ?? 0;
    this.currentMultiIndex = start;
    this.revealedMultiResults = [this.multiResults[start]];
    this.isItemTransitioning = false; // Garante que o primeiro item apareça com animação de entrada
    console.debug('[GachaHome] revealed first item of', this.multiResults.length, 'items');
    this.cd.detectChanges();
  }

  nextMultiItem() {
    if (this.currentMultiIndex < this.multiResults.length - 1 && !this.isItemTransitioning) {
      this.isItemTransitioning = true;
      
      // Animação de saída do item atual
      this.cd.detectChanges();
      
      setTimeout(() => {
        this.currentMultiIndex++;
        // Mostra apenas o item atual (não acumula)
        this.revealedMultiResults = [this.multiResults[this.currentMultiIndex]];
        
        // Pequeno delay antes de permitir a revelação para evitar conflitos visuais
        setTimeout(() => {
          this.isItemTransitioning = false; // Permite que a revelação comece
          console.debug('[GachaHome] showing item', this.currentMultiIndex + 1, 'of', this.multiResults.length);
          this.cd.detectChanges();
        }, 100); // Delay adicional para estabilizar
        
        this.cd.detectChanges();
      }, 600); // Tempo da animação de saída (aumentado para sincronizar com CSS)
    } else if (this.currentMultiIndex >= this.multiResults.length - 1) {
      // Já está no último item, não faz nada
      console.debug('[GachaHome] already at last item');
    }
  }

  skipMultiReveal() {
    // Quando pular, mostra todos os itens de uma vez
    this.revealedMultiResults = [...this.multiResults];
    this.currentMultiIndex = this.multiResults.length - 1;
    console.debug('[GachaHome] skipped to show all', this.multiResults.length, 'items');
    this.cd.detectChanges();
  }

  skipToAllItems() {
    // Método alternativo para pular revelação
    this.skipMultiReveal();
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
