export interface Box {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: 'NORMAL' | 'PREMIUM';
  theme: string;
  themeColor?: string;
  active: boolean;
  createdAt: Date;
  openingAnimationType?: 'video' | 'gif' | 'auto';
  openingAnimationSrc?: string;
}
