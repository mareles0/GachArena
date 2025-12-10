export interface RankingEntry {
  userId: string;
  username: string;
  photoURL?: string;
  boxId: string;
  boxName: string;
  rarestItem: {
    itemId: string;
    itemName: string;
    rarity: string;
    power: number;
    imageUrl: string;
  };
  totalPower: number;
  position: number;
}
