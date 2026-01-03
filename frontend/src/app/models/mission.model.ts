export type MissionType = 'DAILY' | 'WEEKLY' | 'ACHIEVEMENT';

export type MissionGoalType = 
  | 'TICKETS_SPENT'
  | 'BOXES_OPENED'
  | 'ITEMS_COLLECTED'
  | 'TOTAL_POWER'
  | 'RARITY_COLLECTED'
  | 'LOGIN_DAYS'
  | 'TRADES_COMPLETED'
  | 'FRIENDS_ADDED';

export type ItemRarity = 'COMUM' | 'RARO' | 'EPICO' | 'LENDARIO' | 'MITICO';

export interface MissionGoal {
  type: MissionGoalType;
  target: number;
  rarity?: ItemRarity;
  ticketType?: 'NORMAL' | 'PREMIUM';
}

export interface MissionReward {
  normalTickets?: number;
  premiumTickets?: number;
  bonus?: string;
}

export interface Mission {
  id?: string;
  title: string;
  description: string;
  type?: MissionType;
  goal: MissionGoal;
  reward: MissionReward;
  active: boolean;
  icon?: string;
  createdAt?: Date;
  expiresAt?: Date;
  
  requirement?: string;
  requirementAmount?: number;
  autoComplete?: boolean;
  rewardNormal?: number;
  rewardPremium?: number;
  
  dailyRewards?: Array<{
    day: number;
    label: string;
    reward: MissionReward;
    imageUrl?: string;
    rewardNormal?: number;
    rewardPremium?: number;
  }>;
}

export interface UserMission {
  id?: string;
  userId: string;
  missionId: string;
  progress: number;
  completed: boolean;
  completedAt?: Date;
  claimed: boolean;
  claimedAt?: Date;
  startedAt: Date;
  
  claimedDays?: number[];
  lastDailyClaimAt?: Date;
  currentStreak?: number;
  nextAvailableAt?: any;
  
  mission?: Mission;
}

export interface UserMissionStats {
  userId: string;
  ticketsSpentNormal: number;
  ticketsSpentPremium: number;
  boxesOpened: number;
  itemsCollected: number;
  totalPower: number;
  rarityCount: {
    COMUM: number;
    RARO: number;
    EPICO: number;
    LENDARIO: number;
    MITICO: number;
  };
  loginStreak: number;
  lastLoginAt: Date;
  tradesCompleted: number;
  friendsCount: number;
  updatedAt: Date;
}

