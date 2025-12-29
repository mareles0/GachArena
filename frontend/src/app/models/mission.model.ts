export interface Mission {
  id?: string;
  title: string;
  description: string;
  type: 'DAILY' | 'WEEKLY' | 'SPECIAL';
  requirement: string; 
  autoComplete?: boolean; // quando true, missão é coletável imediatamente (ex.: diária sem requisito)
  rewardNormal: number;
  rewardPremium: number;
  active: boolean;
  createdAt?: Date;
  // Para missões do tipo DAILY: array de recompensas por dia (day 1..n)
  dailyRewards?: Array<{ day: number; label?: string; rewardNormal?: number; rewardPremium?: number; imageUrl?: string }>;
}

export interface UserMission {
  id?: string;
  userId: string;
  missionId: string;
  progress: number;
  completed: boolean;
  completedAt?: Date;
  claimed?: boolean;
  claimedAt?: Date;
  // For DAILY missions: track which days were claimed (1-based)
  claimedDays?: number[];
  // optional field indicating when next day is available (not used yet)
  nextAvailableAt?: Date;
}
