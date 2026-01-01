// Tipos de missões disponíveis
export type MissionType = 'DAILY' | 'WEEKLY' | 'ACHIEVEMENT';

// Tipos de objetivos calcul áveis
export type MissionGoalType = 
  | 'TICKETS_SPENT'       // Gastar X tickets (normal ou premium)
  | 'BOXES_OPENED'        // Abrir X caixas
  | 'ITEMS_COLLECTED'     // Coletar X itens
  | 'TOTAL_POWER'         // Atingir X de poder total
  | 'RARITY_COLLECTED'    // Coletar X itens de uma raridade específica
  | 'LOGIN_DAYS'          // Fazer login por X dias consecutivos
  | 'TRADES_COMPLETED'    // Completar X trocas
  | 'FRIENDS_ADDED';      // Adicionar X amigos

// Raridades para filtros de missões
export type ItemRarity = 'COMUM' | 'RARO' | 'EPICO' | 'LENDARIO' | 'MITICO';

// Configuração do objetivo da missão
export interface MissionGoal {
  type: MissionGoalType;
  target: number;               // Valor alvo a ser atingido
  rarity?: ItemRarity;          // Para missões específicas de raridade
  ticketType?: 'NORMAL' | 'PREMIUM';  // Para missões de tickets
}

// Recompensa da missão
export interface MissionReward {
  normalTickets?: number;
  premiumTickets?: number;
  bonus?: string;  // Descrição de bônus extra (ex: "Avatar especial")
}

// Definição completa da missão
export interface Mission {
  id?: string;
  title: string;
  description: string;
  type: MissionType;
  goal: MissionGoal;
  reward: MissionReward;
  active: boolean;
  icon?: string;  // Ícone Bootstrap (ex: 'bi-trophy')
  createdAt?: Date;
  expiresAt?: Date;  // Para missões temporárias
  
  // Campos legados (compatibilidade)
  requirement?: string;
  autoComplete?: boolean;
  rewardNormal?: number;
  rewardPremium?: number;
  
  // Para missões diárias: recompensas progressivas por dia
  dailyRewards?: Array<{
    day: number;
    label: string;
    reward: MissionReward;
    imageUrl?: string;
    // Campos legados
    rewardNormal?: number;
    rewardPremium?: number;
  }>;
}

// Progresso do usuário em uma missão
export interface UserMission {
  id?: string;
  userId: string;
  missionId: string;
  progress: number;  // Valor atual do progresso
  completed: boolean;
  completedAt?: Date;
  claimed: boolean;
  claimedAt?: Date;
  startedAt: Date;
  
  // Para missões diárias
  claimedDays?: number[];  // Dias já coletados
  lastDailyClaimAt?: Date;  // Última vez que coletou um dia
  currentStreak?: number;   // Sequência de dias consecutivos
  nextAvailableAt?: any;    // Próxima disponibilidade
  
  // Cache da missão completa
  mission?: Mission;
}

// Estatísticas do usuário para rastreamento de missões
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

