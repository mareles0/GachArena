export interface Box {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: 'NORMAL' | 'PREMIUM';
  theme: string; // Ex: 'bleach', 'one-piece', 'naruto'
  active: boolean;
  createdAt: Date;
}
