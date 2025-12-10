export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  friendUsername: string;
  friendPhotoURL?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Date;
}
