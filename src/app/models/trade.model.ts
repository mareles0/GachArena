export interface Trade {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  offeredItemId: string;
  offeredItem: any; // Item oferecido
  requestedItemId: string;
  requestedItem: any; // Item solicitado
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}
