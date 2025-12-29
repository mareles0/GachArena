export interface Trade {
  id?: string;
  fromUserId: string;
  fromUsername?: string;
  toUserId: string;
  toUsername?: string;
  // IDs dos userItems (documentos em userItems) que o remetente oferece
  offeredUserItemIds: string[];
  // IDs dos userItems que o destinatário deverá oferecer
  requestedUserItemIds: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  createdAt?: Date;
  updatedAt?: Date;
}
