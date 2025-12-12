export interface User {
  id?: string;
  email: string;
  username: string;
  photoURL?: string;
  userType: 'admin' | 'player';
  normalTickets: number;
  premiumTickets: number;
  isBanned?: boolean;
  createdAt?: Date;
  lastLogin?: Date;
}
