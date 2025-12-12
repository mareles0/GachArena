export interface Item {
  id: string;
  name: string;
  imageUrl: string;
  rarity: 'COMUM' | 'RARO' | 'EPICO' | 'LENDARIO' | 'MITICO';
  boxId: string;
  boxName: string;
  theme: string;
  power: number;
  points: number; // Pontos que o item vale
  dropRate: number; // Porcentagem de chance de drop (0-100)
  createdAt: Date;
}

export interface UserItem {
  id: string;
  userId: string;
  itemId: string;
  item: Item;
  obtainedAt: Date;
  quantity: number;
  rarityLevel?: number; // Nível de raridade aleatório (1-1000) gerado ao ganhar o item
}
