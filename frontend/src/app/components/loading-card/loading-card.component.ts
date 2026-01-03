import { Component, Input, OnInit } from '@angular/core';

interface RouletteItem {
  id: string;
  name: string;
  imageUrl: string;
  rarity: 'COMUM' | 'RARO' | 'EPICO' | 'LENDARIO' | 'MITICO';
}

@Component({
  selector: 'app-loading-card',
  templateUrl: './loading-card.component.html',
  styleUrls: ['./loading-card.component.scss']
})
export class LoadingCardComponent implements OnInit {
  @Input() title: string = 'Girando a Roleta...';
  @Input() subtitle: string = 'Descobrindo seu item especial!';
  @Input() showParticles: boolean = true;
  @Input() showSparkles: boolean = true;

  rouletteItems: RouletteItem[] = [
    {
      id: '1',
      name: 'Goku SSJ',
      imageUrl: 'https:
      rarity: 'MITICO'
    },
    {
      id: '2',
      name: 'Vegeta SSJ',
      imageUrl: 'https:
      rarity: 'LENDARIO'
    },
    {
      id: '3',
      name: 'Naruto',
      imageUrl: 'https:
      rarity: 'EPICO'
    },
    {
      id: '4',
      name: 'Sasuke',
      imageUrl: 'https:
      rarity: 'RARO'
    },
    {
      id: '5',
      name: 'Luffy',
      imageUrl: 'https:
      rarity: 'COMUM'
    },
    {
      id: '6',
      name: 'Zoro',
      imageUrl: 'https:
      rarity: 'EPICO'
    },
    {
      id: '7',
      name: 'Ichigo',
      imageUrl: 'https:
      rarity: 'LENDARIO'
    },
    {
      id: '8',
      name: 'Light Yagami',
      imageUrl: 'https:
      rarity: 'MITICO'
    }
  ];

  constructor() { }

  ngOnInit(): void {
    this.rouletteItems = this.shuffleArray(this.rouletteItems);
  }

  getRarityColor(rarity: string): string {
    const colors: any = {
      'COMUM': 'linear-gradient(45deg, #9e9e9e, #bdbdbd)',
      'RARO': 'linear-gradient(45deg, #4fc3f7, #29b6f6)',
      'EPICO': 'linear-gradient(45deg, #ba68c8, #ab47bc)',
      'LENDARIO': 'linear-gradient(45deg, #ffd54f, #ffca28)',
      'MITICO': 'linear-gradient(45deg, #ff6f00, #ff5722)'
    };
    return colors[rarity] || 'linear-gradient(45deg, #9e9e9e, #bdbdbd)';
  }

  private shuffleArray(array: any[]): any[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}