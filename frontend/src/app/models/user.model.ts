export interface User {
  id?: string;
  email: string;
  username: string;
  photoURL?: string;
  userType: 'ADMINISTRADOR' | 'VIP' | 'PLAYER';
  normalTickets: number;
  premiumTickets: number;
  isBanned?: boolean;
  createdAt?: Date;
  lastLogin?: Date;
}
