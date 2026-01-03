export interface Trade {
  id?: string;
  fromUserId: string;
  fromUsername?: string;
  toUserId: string;
  toUsername?: string;
  offeredUserItemIds: string[];
  requestedUserItemIds: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  createdAt?: Date;
  updatedAt?: Date;
}
