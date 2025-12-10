export interface Ticket {
  normalTickets: number;
  premiumTickets: number;
}

export interface UserTickets {
  userId: string;
  tickets: Ticket;
  updatedAt: Date;
}
