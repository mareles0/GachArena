export interface Mission {
  id: string;
  title: string;
  description: string;
  type: 'DAILY' | 'WEEKLY' | 'SPECIAL';
  requirement: string; // Ex: 'open_5_boxes', 'login_daily'
  rewardNormal: number;
  rewardPremium: number;
  active: boolean;
  createdAt: Date;
}

export interface UserMission {
  userId: string;
  missionId: string;
  mission: Mission;
  progress: number;
  completed: boolean;
  completedAt?: Date;
}
