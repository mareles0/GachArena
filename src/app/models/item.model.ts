export interface Item {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  rarity: 'COMUM' | 'RARO' | 'EPICO' | 'LENDARIO' | 'MITICO';
  boxId: string;
  boxName: string;
  theme: string;
  power: number; // Poder da carta (1-100)
  createdAt: Date;
}

export interface UserItem {
  id: string;
  userId: string;
  itemId: string;
  item: Item;
  obtainedAt: Date;
  quantity: number;
}
