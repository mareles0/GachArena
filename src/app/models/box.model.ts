export interface Box {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: 'NORMAL' | 'PREMIUM';
  theme: string;
  active: boolean;
  createdAt: Date;
}
