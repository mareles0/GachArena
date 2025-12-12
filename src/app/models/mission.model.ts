export interface Mission {
  id?: string;
  title: string;
  description: string;
  type: 'DAILY' | 'WEEKLY' | 'SPECIAL';
  requirement: string; 
  rewardNormal: number;
  rewardPremium: number;
  active: boolean;
  createdAt?: Date;
}

export interface UserMission {
  id?: string;
  userId: string;
  missionId: string;
  progress: number;
  completed: boolean;
  completedAt?: Date;
}
