import { Injectable } from '@angular/core';
import { BoxService } from './box.service';
import { ItemService } from './item.service';
import { Box } from '../models/box.model';
import { Item } from '../models/item.model';

@Injectable({
  providedIn: 'root'
})
export class SeedService {

  constructor(
    private boxService: BoxService,
    private itemService: ItemService
  ) { }

  async seedDatabase() {
    console.log('Iniciando população do banco de dados...');
    
    const boxesData = [
      {
        name: 'Bleach Collection',
        description: 'Personagens e poderes do mundo Bleach',
        imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500',
        type: 'NORMAL' as const,
        theme: 'bleach',
        active: true
      },
      {
        name: 'One Piece Treasure',
        description: 'Piratas e tesouros de One Piece',
        imageUrl: 'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=500',
        type: 'NORMAL' as const,
        theme: 'one-piece',
        active: true
      },
      {
        name: 'Naruto Shinobi Box',
        description: 'Ninjas e jutsus de Naruto',
        imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500',
        type: 'NORMAL' as const,
        theme: 'naruto',
        active: true
      },
      {
        name: 'Hunter x Hunter Box',
        description: 'Hunters e poderes Nen',
        imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500',
        type: 'PREMIUM' as const,
        theme: 'hxh',
        active: true
      },
      {
        name: 'Frieren Collection',
        description: 'Magia e aventuras de Frieren',
        imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500',
        type: 'NORMAL' as const,
        theme: 'frieren',
        active: true
      },
      {
        name: 'One Punch Box',
        description: 'Heróis de One Punch Man',
        imageUrl: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=500',
        type: 'NORMAL' as const,
        theme: 'one-punch',
        active: true
      },
      {
        name: 'Gintama Box',
        description: 'Samurais e comédia de Gintama',
        imageUrl: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=500',
        type: 'NORMAL' as const,
        theme: 'gintama',
        active: true
      },
      {
        name: 'Steins;Gate Collection',
        description: 'Viagens no tempo e ciência',
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500',
        type: 'PREMIUM' as const,
        theme: 'steins-gate',
        active: true
      },
      {
        name: 'Fullmetal Alchemist Box',
        description: 'Alquimia e aventuras dos irmãos Elric',
        imageUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500',
        type: 'NORMAL' as const,
        theme: 'fullmetal',
        active: true
      },
      {
        name: 'Attack on Titan Box',
        description: 'Titãs e a humanidade lutando',
        imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500',
        type: 'PREMIUM' as const,
        theme: 'attack-on-titan',
        active: true
      },
      {
        name: 'Dragon Ball Legends',
        description: 'Guerreiros Z e transformações',
        imageUrl: 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?w=500',
        type: 'PREMIUM' as const,
        theme: 'dragon-ball',
        active: true
      }
    ];

    const createdBoxes: { [key: string]: string } = {};

    for (const boxData of boxesData) {
      const boxId = await this.boxService.createBox(boxData);
      createdBoxes[boxData.theme] = boxId;
      console.log(`Caixa criada: ${boxData.name}`);
    }

    await this.createBleachItems(createdBoxes['bleach']);
    await this.createOnePieceItems(createdBoxes['one-piece']);
    await this.createNarutoItems(createdBoxes['naruto']);
    await this.createHxHItems(createdBoxes['hxh']);
    await this.createFrierenItems(createdBoxes['frieren']);
    await this.createOnePunchItems(createdBoxes['one-punch']);
    await this.createGintamaItems(createdBoxes['gintama']);
    await this.createSteinsGateItems(createdBoxes['steins-gate']);
    await this.createFullmetalItems(createdBoxes['fullmetal']);
    await this.createAttackOnTitanItems(createdBoxes['attack-on-titan']);
    await this.createDragonBallItems(createdBoxes['dragon-ball']);

    console.log('Banco de dados populado com sucesso!');
  }

  private async createBleachItems(boxId: string) {
    const items = [
      { name: 'Ichigo Kurosaki', rarity: 'LENDARIO' as const, power: 95 },
      { name: 'Rukia Kuchiki', rarity: 'RARO' as const, power: 75 },
      { name: 'Byakuya Kuchiki', rarity: 'EPICO' as const, power: 88 },
      { name: 'Aizen Sosuke', rarity: 'MITICO' as const, power: 100 },
      { name: 'Renji Abarai', rarity: 'COMUM' as const, power: 65 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Personagem de Bleach - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'Bleach Collection',
        theme: 'bleach'
      });
    }
  }

  private async createOnePieceItems(boxId: string) {
    const items = [
      { name: 'Monkey D. Luffy', rarity: 'LENDARIO' as const, power: 96 },
      { name: 'Roronoa Zoro', rarity: 'EPICO' as const, power: 90 },
      { name: 'Nami', rarity: 'RARO' as const, power: 70 },
      { name: 'Shanks', rarity: 'MITICO' as const, power: 100 },
      { name: 'Usopp', rarity: 'COMUM' as const, power: 60 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Pirata de One Piece - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'One Piece Treasure',
        theme: 'one-piece'
      });
    }
  }

  private async createNarutoItems(boxId: string) {
    const items = [
      { name: 'Naruto Uzumaki', rarity: 'LENDARIO' as const, power: 94 },
      { name: 'Sasuke Uchiha', rarity: 'LENDARIO' as const, power: 95 },
      { name: 'Sakura Haruno', rarity: 'RARO' as const, power: 78 },
      { name: 'Madara Uchiha', rarity: 'MITICO' as const, power: 100 },
      { name: 'Rock Lee', rarity: 'COMUM' as const, power: 68 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Ninja de Naruto - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'Naruto Shinobi Box',
        theme: 'naruto'
      });
    }
  }

  private async createHxHItems(boxId: string) {
    const items = [
      { name: 'Gon Freecss', rarity: 'EPICO' as const, power: 85 },
      { name: 'Killua Zoldyck', rarity: 'EPICO' as const, power: 87 },
      { name: 'Hisoka', rarity: 'LENDARIO' as const, power: 92 },
      { name: 'Meruem', rarity: 'MITICO' as const, power: 100 },
      { name: 'Kurapika', rarity: 'RARO' as const, power: 80 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Hunter de HxH - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'Hunter x Hunter Box',
        theme: 'hxh'
      });
    }
  }

  private async createFrierenItems(boxId: string) {
    const items = [
      { name: 'Frieren', rarity: 'LENDARIO' as const, power: 98 },
      { name: 'Fern', rarity: 'EPICO' as const, power: 82 },
      { name: 'Stark', rarity: 'RARO' as const, power: 75 },
      { name: 'Himmel', rarity: 'EPICO' as const, power: 88 },
      { name: 'Heiter', rarity: 'COMUM' as const, power: 65 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Personagem de Frieren - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'Frieren Collection',
        theme: 'frieren'
      });
    }
  }

  private async createOnePunchItems(boxId: string) {
    const items = [
      { name: 'Saitama', rarity: 'MITICO' as const, power: 100 },
      { name: 'Genos', rarity: 'EPICO' as const, power: 85 },
      { name: 'Mumen Rider', rarity: 'COMUM' as const, power: 50 },
      { name: 'Tatsumaki', rarity: 'LENDARIO' as const, power: 93 },
      { name: 'Sonic', rarity: 'RARO' as const, power: 77 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Herói de One Punch Man - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'One Punch Box',
        theme: 'one-punch'
      });
    }
  }

  private async createGintamaItems(boxId: string) {
    const items = [
      { name: 'Gintoki Sakata', rarity: 'LENDARIO' as const, power: 90 },
      { name: 'Kagura', rarity: 'EPICO' as const, power: 86 },
      { name: 'Shinpachi', rarity: 'COMUM' as const, power: 62 },
      { name: 'Hijikata', rarity: 'RARO' as const, power: 78 },
      { name: 'Okita', rarity: 'RARO' as const, power: 80 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Personagem de Gintama - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'Gintama Box',
        theme: 'gintama'
      });
    }
  }

  private async createSteinsGateItems(boxId: string) {
    const items = [
      { name: 'Okabe Rintarou', rarity: 'LENDARIO' as const, power: 92 },
      { name: 'Makise Kurisu', rarity: 'LENDARIO' as const, power: 94 },
      { name: 'Mayuri Shiina', rarity: 'EPICO' as const, power: 83 },
      { name: 'Suzuha Amane', rarity: 'RARO' as const, power: 76 },
      { name: 'Daru', rarity: 'COMUM' as const, power: 67 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Personagem de Steins;Gate - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'Steins;Gate Collection',
        theme: 'steins-gate'
      });
    }
  }

  private async createFullmetalItems(boxId: string) {
    const items = [
      { name: 'Edward Elric', rarity: 'LENDARIO' as const, power: 93 },
      { name: 'Alphonse Elric', rarity: 'EPICO' as const, power: 87 },
      { name: 'Roy Mustang', rarity: 'EPICO' as const, power: 89 },
      { name: 'Scar', rarity: 'RARO' as const, power: 79 },
      { name: 'Winry Rockbell', rarity: 'COMUM' as const, power: 60 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Alquimista de Fullmetal - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'Fullmetal Alchemist Box',
        theme: 'fullmetal'
      });
    }
  }

  private async createAttackOnTitanItems(boxId: string) {
    const items = [
      { name: 'Eren Yeager', rarity: 'MITICO' as const, power: 99 },
      { name: 'Mikasa Ackerman', rarity: 'LENDARIO' as const, power: 95 },
      { name: 'Levi Ackerman', rarity: 'MITICO' as const, power: 100 },
      { name: 'Armin Arlert', rarity: 'EPICO' as const, power: 84 },
      { name: 'Sasha Blouse', rarity: 'RARO' as const, power: 72 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Soldado de Attack on Titan - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'Attack on Titan Box',
        theme: 'attack-on-titan'
      });
    }
  }

  private async createDragonBallItems(boxId: string) {
    const items = [
      { name: 'Goku Ultra Instinct', rarity: 'MITICO' as const, power: 100 },
      { name: 'Vegeta', rarity: 'LENDARIO' as const, power: 96 },
      { name: 'Gohan', rarity: 'EPICO' as const, power: 88 },
      { name: 'Piccolo', rarity: 'RARO' as const, power: 81 },
      { name: 'Krillin', rarity: 'COMUM' as const, power: 64 }
    ];

    for (const item of items) {
      await this.itemService.createItem({
        ...item,
        description: `Guerreiro Z - ${item.name}`,
        imageUrl: 'https://via.placeholder.com/300x400?text=' + item.name.replace(' ', '+'),
        boxId,
        boxName: 'Dragon Ball Legends',
        theme: 'dragon-ball'
      });
    }
  }
}
