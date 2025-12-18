export interface Box {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: 'NORMAL' | 'PREMIUM';
  theme: string;
  themeColor?: string; // optional hex color to style the card
  active: boolean;
  createdAt: Date;
  // Animação de abertura personalizada
  openingAnimationType?: 'video' | 'gif' | 'auto'; // tipo de animação
  openingAnimationSrc?: string; // caminho para o vídeo/gif
}
