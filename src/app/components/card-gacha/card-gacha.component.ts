import { Component, ElementRef, ViewChild, Output, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { gsap } from 'gsap';

export interface CardGachaResult {
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  color: string;
  item?: any;
}

export interface CardGachaConfig {
  mode: 'x1' | 'x5' | 'x10';
  results: CardGachaResult[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

@Component({
  selector: 'app-card-gacha',
  templateUrl: './card-gacha.component.html',
  styleUrls: ['./card-gacha.component.scss']
})
export class CardGachaComponent implements OnInit, OnChanges, OnDestroy {
  @Input() config!: CardGachaConfig;
  @Input() debug: boolean = false;
  @Output() animationComplete = new EventEmitter<CardGachaResult[]>();
  @Output() itemRevealed = new EventEmitter<{ item: CardGachaResult; index: number }>();

  @ViewChild('background', { static: true }) background!: ElementRef;
  @ViewChild('cardsContainer', { static: true }) cardsContainer!: ElementRef;
  @ViewChild('particleCanvas', { static: true }) particleCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('flipAudio', { static: true }) flipAudio!: ElementRef;
  @ViewChild('epicAudio', { static: true }) epicAudio!: ElementRef;

  private cards: HTMLElement[] = [];
  private mainTimeline!: gsap.core.Timeline;
  private isPlaying: boolean = false;
  private particles: Particle[] = [];
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  
  private allRarities: Array<{ key: string, label: string, color: string, emoji: string }> = [
    { key: 'common', label: 'COMUM', color: '#9e9e9e', emoji: '⭐' },
    { key: 'rare', label: 'RARO', color: '#4fc3f7', emoji: '💎' },
    { key: 'epic', label: 'ÉPICO', color: '#ba68c8', emoji: '🔮' },
    { key: 'legendary', label: 'LENDÁRIO', color: '#ffd54f', emoji: '👑' },
    { key: 'mythic', label: 'MÍTICO', color: '#ff6f00', emoji: '🌟' }
  ];

  statusMessage: string = '';
  createdCount: number = 0;
  resultsPreview: string[] = [];

  ngOnInit() {
    this.initializeAnimation();
    this.initParticleSystem();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && this.config?.results?.length > 0) {
      if (this.isPlaying) {
        this.statusMessage = 'Nova configuração recebida durante animação';
        return;
      }
      this.resetAnimationState();
      this.resultsPreview = this.config.results.map(r => r.rarity);
      this.statusMessage = `Pronto: ${this.resultsPreview.length} resultados preparados`;
    }
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.mainTimeline) {
      this.mainTimeline.kill();
    }
  }

  private initParticleSystem() {
    const canvas = this.particleCanvas.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.startParticleLoop();
  }

  private resizeCanvas() {
    const canvas = this.particleCanvas.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private startParticleLoop() {
    const animate = () => {
      this.updateParticles();
      this.renderParticles();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private createParticleBurst(x: number, y: number, color: string, count: number = 30) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const velocity = 2 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 1,
        maxLife: 1,
        size: 3 + Math.random() * 5,
        color,
        alpha: 1
      });
    }
  }

  private createConfetti(x: number, y: number, color: string) {
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: -Math.random() * 15 - 5,
        life: 1,
        maxLife: 1,
        size: 4 + Math.random() * 6,
        color: i % 3 === 0 ? color : '#ffffff',
        alpha: 1
      });
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3; // gravity
      p.vx *= 0.98; // friction
      p.life -= 0.016;
      p.alpha = p.life / p.maxLife;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private renderParticles() {
    this.ctx.clearRect(0, 0, this.particleCanvas.nativeElement.width, this.particleCanvas.nativeElement.height);
    
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Glow effect
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = p.color;
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  private initializeAnimation() {
    gsap.set(this.background.nativeElement, {
      opacity: 0,
      backdropFilter: 'blur(0px)'
    });

    gsap.set(this.cardsContainer.nativeElement, {
      opacity: 0,
      scale: 0.5,
      rotationX: -15
    });
  }

  startAnimation() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (this.mainTimeline) this.mainTimeline.kill();

    this.mainTimeline = gsap.timeline({
      onComplete: () => {
        this.statusMessage = 'Animação finalizada!';
        this.isPlaying = false;
        this.animationComplete.emit(this.config.results);
      }
    });

    this.createCards();
    this.statusMessage = 'Iniciando experiência épica...';

    // Ajustar durações dependendo do modo (x1 mais dramático / lento)
    const introFactor = this.config.mode === 'x1' ? 1.4 : this.config.mode === 'x5' ? 1.2 : 1.0;

    // Dramatic entrance with camera shake (longer on x1)
    this.mainTimeline
      .to(this.background.nativeElement, {
        duration: 2 * introFactor,
        opacity: 1,
        backdropFilter: 'blur(10px)',
        ease: 'power2.inOut'
      })
      .to(this.cardsContainer.nativeElement, {
        duration: 1.8 * introFactor,
        opacity: 1,
        scale: 1,
        rotationX: 0,
        ease: 'elastic.out(1, 0.5)',
        onStart: () => {
          // Screen shake effect
          gsap.to(this.cardsContainer.nativeElement, {
            duration: 0.12 * introFactor,
            x: '+=10',
            yoyo: true,
            repeat: 6,
            ease: 'power2.inOut'
          });
        }
      }, `-=${0.9 * introFactor}`)
      .add(() => {
        // Initial particle burst
        const rect = this.cardsContainer.nativeElement.getBoundingClientRect();
        this.createParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, '#ffffff', 60);
      })
      .add(() => {}, `+=${1.8 * introFactor}`)
      .add(this.createUltraPreviewAndFlips(), '+=0');
  }

  private createCards() {
    const container = this.cardsContainer.nativeElement;
    container.innerHTML = '';
    this.cards = [];

    if (!this.config?.results?.length) {
      this.statusMessage = 'Nenhum resultado disponível';
      return;
    }

    this.config.results.forEach((result, index) => {
      const cardElement = this.createCardElement(result, index);
      container.appendChild(cardElement);
      this.cards.push(cardElement);
    });

    this.createdCount = this.cards.length;
    this.applyLayout();
  }

  private createCardElement(result: CardGachaResult, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = `gacha-card rarity-${result.rarity}`;
    card.setAttribute('data-index', index.toString());

    // Enhanced back with holographic effect
    const cardBack = document.createElement('div');
    cardBack.className = 'card-back';
    
    // Add holographic layer
    const holoLayer = document.createElement('div');
    holoLayer.className = 'holo-layer';
    cardBack.appendChild(holoLayer);

    // Reel system
    const reel = document.createElement('div');
    reel.className = 'reel';
    const reelInner = document.createElement('div');
    reelInner.className = 'reel-inner';

    const cycles = 8;
    for (let c = 0; c < cycles; c++) {
      this.allRarities.forEach(r => {
        const item = document.createElement('div');
        item.className = `reel-item rarity-${r.key}`;
        item.innerHTML = `
          <div class="reel-row">
            <div class="reel-swatch" style="background:${r.color}"></div>
            <div class="reel-icon">${r.emoji}</div>
            <div class="reel-label">${r.label}</div>
          </div>
        `;
        item.style.setProperty('--rarity-color', r.color);
        reelInner.appendChild(item);
      });
    }

    reel.appendChild(reelInner);
    cardBack.appendChild(reel);

    // Enhanced front with 3D effects
    const cardFront = document.createElement('div');
    cardFront.className = 'card-front';
    
    const rarityInfo = this.allRarities.find(r => r.key === result.rarity)!;
    
    cardFront.innerHTML = `
      <div class="card-glow"></div>
      <div class="card-shine"></div>
      <div class="card-content">
        <div class="rarity-icon-large">${rarityInfo.emoji}</div>
        <div class="rarity-label-main">${rarityInfo.label}</div>
        <div class="rarity-stars">
          ${'★'.repeat(this.getStarCount(result.rarity))}
        </div>
      </div>
      <div class="card-particles"></div>
    `;

    card.appendChild(cardBack);
    card.appendChild(cardFront);

    gsap.set(card, {
      rotateY: 0,
      transformStyle: 'preserve-3d'
    });

    return card;
  }

  private getStarCount(rarity: string): number {
    const stars = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    return stars[rarity as keyof typeof stars] || 1;
  }

  private applyLayout() {
    const container = this.cardsContainer.nativeElement;
    container.className = `cards-container mode-${this.config.mode}`;
  }

  private createUltraPreviewAndFlips(): gsap.core.Timeline {
    const t = gsap.timeline();
    // Tornar animações mais longas por modo
    const modeFactor = this.config.mode === 'x1' ? 1.6 : this.config.mode === 'x5' ? 1.25 : 1.0;
    const flipDelay = this.config.mode === 'x1' ? 0 : this.config.mode === 'x5' ? 0.5 : 0.35;

    this.cards.forEach((card, index) => {
      const delay = index * flipDelay;
      const result = this.config.results[index];
      const rarityInfo = this.allRarities.find(r => r.key === result.rarity)!;

      const cardTimeline = gsap.timeline();

      // Pre-flip anticipation (mais longo em x1)
      cardTimeline.to(card, {
        duration: 0.3 * modeFactor,
        scale: 1.1,
        y: -20,
        ease: 'power2.out'
      });

      // Reel spin with dynamic easing
      const reelInner = card.querySelector('.reel-inner') as HTMLElement;
      if (reelInner) {
        const items = Array.from(reelInner.querySelectorAll('.reel-item')) as HTMLElement[];
        const itemHeight = items[0]?.offsetHeight || 80;
        const posInCycle = this.allRarities.findIndex(r => r.key === result.rarity);
        const cyclesToSpin = 7 + Math.floor(Math.random() * 3); // mais ciclos para spin mais longo
        const targetIndex = cyclesToSpin * this.allRarities.length + posInCycle;
        const targetY = -targetIndex * itemHeight;

        cardTimeline.to(reelInner, {
          duration: (6.5 + (index * 0.3)) * modeFactor, // base maior para tempo ainda mais longo
          y: targetY,
          ease: 'power4.inOut',
          onStart: () => {
            this.playFlipSound(result.rarity);
            // Add motion blur effect
            card.style.filter = 'blur(3px)';
          },
          onUpdate: function() {
            const progress = this.progress();
            if (progress > 0.6) {
              card.style.filter = `blur(${(1 - progress) * 8}px)`;
            }
          },
          onComplete: () => {
            card.style.filter = 'none';
          }
        });

        // Mechanical bounce (mais notório)
        cardTimeline.to(reelInner, {
          duration: 0.35 * modeFactor,
          y: targetY + 18,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1
        });
      }

      // Epic card flip with 3D rotation (mais longo para impacto)
      cardTimeline.to(card, {
        duration: 1.6 * modeFactor,
        rotateY: 180,
        scale: this.config.mode === 'x1' ? 1.18 : 1.06,
        ease: 'back.out(2)',
        onStart: () => {
          const rect = card.getBoundingClientRect();
          this.createParticleBurst(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            rarityInfo.color,
            result.rarity === 'mythic' ? 120 : result.rarity === 'legendary' ? 80 : 50
          );
        },
        onComplete: () => {
          this.itemRevealed.emit({ item: result, index });
          
          // Legendary+ gets confetti (mais abundante)
          if (result.rarity === 'legendary' || result.rarity === 'mythic') {
            const rect = card.getBoundingClientRect();
            this.createConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, rarityInfo.color);
          }
        }
      });

      // Post-reveal effects (prolongados)
      cardTimeline
        .to(card, {
          duration: 1.0 * modeFactor,
          scale: 1,
          ease: 'elastic.out(1, 0.5)'
        })
        .to(card, {
          duration: 2.4 * modeFactor,
          boxShadow: `0 0 80px ${rarityInfo.color}, 0 26px 60px rgba(0,0,0,0.55)`,
          ease: 'power2.out'
        }, `-=${1.0 * modeFactor}`)
        // Floating animation (mais suave e lento)
        .to(card, {
          duration: 3 * modeFactor,
          y: '+=12',
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1
        });

      t.add(cardTimeline, `+=${delay}`);
    });

    return t;
  }

  private resetAnimationState() {
    if (this.isPlaying) return;
    if (this.mainTimeline) this.mainTimeline.kill();
    
    this.cards = [];
    this.particles = [];
    const container = this.cardsContainer?.nativeElement;
    if (container) container.innerHTML = '';

    if (this.background?.nativeElement) {
      gsap.set(this.background.nativeElement, { opacity: 0, backdropFilter: 'blur(0px)' });
    }
    if (this.cardsContainer?.nativeElement) {
      gsap.set(this.cardsContainer.nativeElement, { opacity: 0, scale: 0.5, rotationX: -15 });
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
      audio.volume = rarity === 'mythic' ? 0.8 : 0.6;
      audio.play().catch(() => {});
    }
  }

  public setConfig(config: CardGachaConfig) {
    this.config = config;
    this.resultsPreview = config.results?.map(r => r.rarity) || [];
    this.statusMessage = `Config set com ${this.resultsPreview.length} results`;
  }

  public play(config?: CardGachaConfig) {
    if (config) this.setConfig(config);

    if (!this.config?.results?.length) {
      this.statusMessage = 'Nenhum resultado para animar';
      setTimeout(() => this.animationComplete.emit([]), 50);
      return;
    }

    this.startAnimation();
  }
}