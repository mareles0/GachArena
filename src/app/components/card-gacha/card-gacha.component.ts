import { Component, ElementRef, ViewChild, Output, EventEmitter, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { gsap } from 'gsap';

export interface CardGachaResult {
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  color: string;
  item?: any; // Para compatibilidade futura
}

export interface CardGachaConfig {
  mode: 'x1' | 'x5' | 'x10';
  results: CardGachaResult[];
}

@Component({
  selector: 'app-card-gacha',
  templateUrl: './card-gacha.component.html',
  styleUrls: ['./card-gacha.component.scss']
})
export class CardGachaComponent implements OnInit, OnChanges {
  @Input() config!: CardGachaConfig;
  @Input() debug: boolean = false;
  @Output() animationComplete = new EventEmitter<CardGachaResult[]>();
  @Output() itemRevealed = new EventEmitter<{ item: CardGachaResult; index: number }>();

  @ViewChild('background', { static: true }) background!: ElementRef;
  @ViewChild('cardsContainer', { static: true }) cardsContainer!: ElementRef;
  @ViewChild('flipAudio', { static: true }) flipAudio!: ElementRef;
  @ViewChild('epicAudio', { static: true }) epicAudio!: ElementRef;

  private cards: HTMLElement[] = [];
  private mainTimeline!: gsap.core.Timeline;
  private isPlaying: boolean = false;
  private allRarities: Array<{ key: string, label: string, color: string }> = [
    { key: 'common', label: 'COMUM', color: '#9e9e9e' },
    { key: 'rare', label: 'RARO', color: '#4fc3f7' },
    { key: 'epic', label: 'ÉPICO', color: '#ba68c8' },
    { key: 'legendary', label: 'LENDÁRIO', color: '#ffd54f' },
    { key: 'mythic', label: 'MÍTICO', color: '#ff6f00' }
  ];
  // Estado visível para debug / UX
  statusMessage: string = '';
  createdCount: number = 0;
  resultsPreview: string[] = [];

  ngOnInit() {
    this.initializeAnimation();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && this.config && this.config.results && this.config.results.length > 0) {
      console.log('[CardGacha] ngOnChanges: new config received, results =', this.config.results.length);
      // Se já estivermos tocando, só atualiza o status e ignora
      if (this.isPlaying) {
        this.statusMessage = 'Nova configuração recebida durante animação — será aplicada depois.';
        return;
      }

      // Apenas preparar o estado (não iniciar automaticamente). O parent deve chamar play()/setConfig().
      this.resetAnimationState();
      this.resultsPreview = this.config.results.map(r => r.rarity);
      this.statusMessage = `Pronto: ${this.resultsPreview.length} resultados preparados`;
    }
  }

  private initializeAnimation() {
    // Fundo escurece suavemente
    gsap.set(this.background.nativeElement, {
      opacity: 0,
      backdropFilter: 'blur(0px)'
    });

    // Container dos cards invisível inicialmente
    gsap.set(this.cardsContainer.nativeElement, {
      opacity: 0,
      scale: 0.8
    });
  }

  startAnimation() {
    if (this.isPlaying) {
      console.warn('[CardGacha] startAnimation called while already playing - ignoring');
      return;
    }
    this.isPlaying = true;
    // Garantir que qualquer timeline anterior seja parada
    if (this.mainTimeline) {
      this.mainTimeline.kill();
    }

    this.mainTimeline = gsap.timeline({
      onComplete: () => {
        console.log('[CardGacha] mainTimeline complete, emitting animationComplete');
        this.statusMessage = 'Animação finalizada.';
        this.isPlaying = false;
        this.animationComplete.emit(this.config.results);
      }
    });
    console.log('[CardGacha] startAnimation called');
    this.statusMessage = 'Iniciando animação...';

    // Garantir que os cards sejam criados imediatamente (fallback)
    this.createCards();
    // Garantir estado inicial dos cards (sem rotação) para evitar que apareçam na aresta
    this.cards.forEach(c => {
      gsap.set(c, { rotateY: 0, scale: 1 });
      const back = c.querySelector('.card-back') as HTMLElement;
      const front = c.querySelector('.card-front') as HTMLElement;
      if (back) gsap.set(back, { rotationY: 0, zIndex: 2 });
      if (front) gsap.set(front, { rotationY: 180, zIndex: 1 });
    });
    this.statusMessage = 'Cards criados, preparando preview...';

    // 1. Fundo escurece e desfoca lentamente
    this.mainTimeline.to(this.background.nativeElement, {
      duration: 1.5,
      opacity: 0.8,
      backdropFilter: 'blur(5px)',
      ease: 'power2.out'
    });

    // 2. Cards aparecem no centro com efeito dramático
    this.mainTimeline.to(this.cardsContainer.nativeElement, {
      duration: 1.2,
      opacity: 1,
      scale: 1,
      ease: 'back.out(1.7)'
    }, '-=0.8');

    // 3. Pausa prolongada mostrando as cores dos versos para que o efeito seja bem visível
    this.mainTimeline.add(() => {}, '+=2.4');

    // 4. Adicionar a timeline completa de preview + flips ao timeline principal
    const previewAndFlips = this.createPreviewAndFlips();
    console.log('[CardGacha] previewAndFlips timeline created, cards =', this.cards.length);
    this.statusMessage = `Preview timeline criada para ${this.cards.length} cards`;
    this.createdCount = this.cards.length;
    this.mainTimeline.add(previewAndFlips, '+=0');

    // Segurança: se nada acontecer até 2s, forçar criação e início
    setTimeout(() => {
      if (this.cards.length === 0) {
        console.warn('[CardGacha] Timeout: no cards created, forcing createCards()');
        this.statusMessage = 'Timeout: forçando criação de cards';
        this.createCards();
        this.mainTimeline.add(this.createPreviewAndFlips(), '+=0');
      }
    }, 2000);
  }

  private createCards() {
    const container = this.cardsContainer.nativeElement;
    container.innerHTML = '';
    // Resetar array para evitar duplicação se chamado novamente
    this.cards = [];

    if (!this.config || !this.config.results || this.config.results.length === 0) {
      console.warn('[CardGacha] createCards: config.results empty or missing', this.config);
      this.statusMessage = 'Nenhum resultado disponível para criar cards.';
      return;
    }

    console.log('[CardGacha] createCards: config.results length =', this.config.results.length);
    this.config.results.forEach((result, index) => {
      console.log('[CardGacha] creating card', index, result);
      const cardElement = this.createCardElement(result, index);
      container.appendChild(cardElement);
      this.cards.push(cardElement);
    });

    console.log('[CardGacha] createCards: created', this.cards.length, 'cards');
    this.statusMessage = `Cards criados: ${this.cards.length}`;
    this.createdCount = this.cards.length;

    // Aplicar layout baseado no modo
    this.applyLayout();
  }

  private createCardElement(result: CardGachaResult, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = `gacha-card rarity-${result.rarity}`;
    card.setAttribute('data-index', index.toString());

    // Verso do card (inicialmente visível) - agora com 'reel' (caça-níquel)
    const cardBack = document.createElement('div');
    cardBack.className = 'card-back';

    const reel = document.createElement('div');
    reel.className = 'reel';
    const reelInner = document.createElement('div');
    reelInner.className = 'reel-inner';

    // Build repeated sequence to simulate spinning
    const cycles = 6; // number of loops
    for (let c = 0; c < cycles; c++) {
      this.allRarities.forEach(r => {
        const item = document.createElement('div');
        item.className = `reel-item rarity-${r.key}`;
        item.innerHTML = `<div class="reel-label">${r.label}</div>`;
        // set color inline for safety
        item.style.setProperty('--rarity-color', r.color);
        reelInner.appendChild(item);
      });
    }

    reel.appendChild(reelInner);
    cardBack.appendChild(reel);

    // Frente do card (inicialmente oculta)
    const cardFront = document.createElement('div');
    cardFront.className = 'card-front';
    cardFront.innerHTML = `
      <div class="rarity-icon">${this.getRarityIcon(result.rarity)}</div>
      <div class="rarity-label">${this.getRarityLabel(result.rarity)}</div>
    `;

    card.appendChild(cardBack);
    card.appendChild(cardFront);

    // Estado inicial: verso visível
    gsap.set(card, {
      rotateY: 0,
      transformStyle: 'preserve-3d'
    });

    gsap.set(cardBack, {
      rotationY: 0,
      zIndex: 2
    });

    gsap.set(cardFront, {
      rotationY: 180,
      zIndex: 1
    });

    return card;
  }

  private applyLayout() {
    const container = this.cardsContainer.nativeElement;

    switch (this.config.mode) {
      case 'x1':
        container.className = 'cards-container mode-x1';
        break;
      case 'x5':
        container.className = 'cards-container mode-x5';
        break;
      case 'x10':
        container.className = 'cards-container mode-x10';
        break;
    }
  }

  private createPreviewAndFlips(): gsap.core.Timeline {
    const t = gsap.timeline();
    const flipDelay = this.config.mode === 'x1' ? 0 :
                      this.config.mode === 'x5' ? 1.0 : 0.8;

    this.cards.forEach((card, index) => {
      const delay = index * flipDelay;
      const rarityColor = this.config.results[index].color;

      const cardTimeline = gsap.timeline();

      // Reel spin animation (slot-machine style)
      const reelInner = card.querySelector('.reel-inner') as HTMLElement;
      if (reelInner) {
        const items = Array.from(reelInner.querySelectorAll('.reel-item')) as HTMLElement[];
        const itemHeight = items[0]?.offsetHeight || 60;
        // find a target index in the repeated sequence (pick cycles-2 to leave room)
        const cycleLen = this.allRarities.length;
        const targetRarityKey = this.config.results[index].rarity;
        // find first index of that rarity in one cycle
        const posInCycle = this.allRarities.findIndex(r => r.key === targetRarityKey);
        const cyclesToSpin = 4 + Math.floor(Math.random() * 2); // 4..5 cycles
        const targetIndex = cyclesToSpin * cycleLen + posInCycle;
        const targetY = -targetIndex * itemHeight;

        // spin with easing
        cardTimeline.to(reelInner, {
          duration: 2.8 + (index * 0.15),
          y: targetY,
          ease: 'power4.inOut',
          onStart: () => {
            this.playFlipSound(this.config.results[index].rarity);
          }
        });

        // small bounce to mimic mechanical stop
        cardTimeline.to(reelInner, {
          duration: 0.35,
          y: targetY + 12,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1
        });
      }

      // Flip to reveal final front card
      cardTimeline.to(card, {
        duration: 1.6,
        rotateY: 180,
        scale: 1.05,
        ease: 'power2.inOut',
        onComplete: () => {
          this.itemRevealed.emit({ item: this.config.results[index], index: index });
        }
      });

      // Glow sutil após revelação
      cardTimeline.to(card, {
        duration: 1.2,
        boxShadow: `0 0 30px ${rarityColor}60`,
        scale: 1.0,
        ease: 'power2.out'
      });

      t.add(cardTimeline, `+=${delay}`);
    });

    return t;
  }

  private resetAnimationState() {
    // Se a animação está tocando, não resetar o estado agora
    if (this.isPlaying) {
      console.warn('[CardGacha] resetAnimationState called enquanto tocando - ignorando');
      return;
    }

    // Parar timeline atual
    if (this.mainTimeline) {
      this.mainTimeline.kill();
    }

    // Limpar cards e container
    this.cards = [];
    const container = this.cardsContainer?.nativeElement;
    if (container) container.innerHTML = '';

    // Reset visual do fundo e container
    if (this.background && this.background.nativeElement) {
      gsap.set(this.background.nativeElement, { opacity: 0, backdropFilter: 'blur(0px)' });
    }
    if (this.cardsContainer && this.cardsContainer.nativeElement) {
      gsap.set(this.cardsContainer.nativeElement, { opacity: 0, scale: 0.8 });
    }
    this.statusMessage = '';
    this.createdCount = 0;
    this.resultsPreview = [];
  }

  private playFlipSound(rarity: string) {
    const audio = (rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic')
      ? this.epicAudio.nativeElement
      : this.flipAudio.nativeElement;

    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Silenciar erro se áudio não estiver disponível
      });
    }
  }

  private getRarityIcon(rarity: string): string {
    const icons = {
      common: '⭐',
      rare: '💎',
      epic: '🔮',
      legendary: '👑',
      mythic: '🌟'
    };
    return icons[rarity as keyof typeof icons] || '⭐';
  }

  private getRarityLabel(rarity: string): string {
    const labels = {
      common: 'COMUM',
      rare: 'RARO',
      epic: 'ÉPICO',
      legendary: 'LENDÁRIO',
      mythic: 'MÍTICO'
    };
    return labels[rarity as keyof typeof labels] || 'COMUM';
  }

  // Método público para iniciar a animação
  // Permite setar a config diretamente e iniciar a animação de forma robusta
  public setConfig(config: CardGachaConfig) {
    this.config = config;
    this.resultsPreview = config.results ? config.results.map(r => r.rarity) : [];
    this.statusMessage = `Config set com ${this.resultsPreview.length} results`;
  }

  public play(config?: CardGachaConfig) {
    if (config) this.setConfig(config);

    // Se não houver resultados, emitir complete imediatamente para evitar loading infinito
    if (!this.config || !this.config.results || this.config.results.length === 0) {
      console.warn('[CardGacha] play called but config.results empty, emitting complete');
      this.statusMessage = 'Nenhum resultado para animar. Encerrando.';
      // emitir um array vazio para notificar o parent
      setTimeout(() => this.animationComplete.emit([]), 50);
      return;
    }

    this.startAnimation();
  }
}