export interface Item {
  id: string;
  name: string;
  imageUrl: string;
  rarity: 'COMUM' | 'RARO' | 'EPICO' | 'LENDARIO' | 'MITICO';
  boxId: string;
  boxName: string;
  theme: string;
  power: number;
  points: number;
  dropRate: number;
  createdAt: Date;
}

export interface UserItem {
  id: string;
  userId: string;
  itemId: string;
  item: Item;
  obtainedAt: Date;
  quantity: number;
  rarityLevel?: number;
  points?: number;
}
