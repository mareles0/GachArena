import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Mission, UserMission, UserMissionStats } from '../models/mission.model';
import { Subject } from 'rxjs';
import { EventService } from './event.service';

@Injectable({
  providedIn: 'root'
})
export class MissionService {
  private missionProgressChanged = new Subject<void>();
  public missionProgressChanged$ = this.missionProgressChanged.asObservable();
  private missionsCache: Mission[] | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_DURATION = 30000;

  constructor(private http: HttpClient, private eventService: EventService) {
    this.eventService.events$.subscribe((event) => {
      if (event === 'missionsChanged') {
        this.clearCache();
      }
    });
  }
  
  private clearCache() {
    this.missionsCache = null;
    this.cacheTimestamp = 0;
  }

  private isCacheValid(): boolean {
    return this.missionsCache !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }
  
  notifyProgressChanged(): void {
    console.log('[MissionService] Notificando mudança de progresso');
    this.missionProgressChanged.next();
  }

  async createMission(mission: Omit<Mission, 'id' | 'createdAt'>): Promise<string> {
    try {
      const response = await this.http.post<{ id: string }>(`${environment.backendUrl}/missions`, mission).toPromise();
      this.clearCache();
      return response!.id;
    } catch (error) {
      console.error('Erro ao criar missão:', error);
      throw error;
    }
  }

  async getMission(id: string): Promise<Mission | null> {
    try {
      const mission = await this.http.get<Mission>(`${environment.backendUrl}/missions/${id}`).toPromise();
      return mission || null;
    } catch (error) {
      console.error('Erro ao buscar missão:', error);
      return null;
    }
  }

  async getAllMissions(forceRefresh: boolean = false): Promise<Mission[]> {
    if (!forceRefresh && this.isCacheValid() && this.missionsCache) {
      console.log('[MissionService] Retornando missões do cache');
      return this.missionsCache;
    }
    
    try {
      console.log('[MissionService] Fazendo requisição para:', `${environment.backendUrl}/missions`);
      const missions = await this.http.get<Mission[]>(`${environment.backendUrl}/missions`).toPromise();
      console.log('[MissionService] Resposta recebida:', missions);
      console.log('[MissionService] Total de missões:', missions?.length || 0);
      this.missionsCache = missions || [];
      this.cacheTimestamp = Date.now();
      return this.missionsCache;
    } catch (error) {
      console.error('[MissionService] Erro ao buscar missões:', error);
      return [];
    }
  }

  async getActiveMissions(): Promise<Mission[]> {
    try {
      const missions = await this.http.get<Mission[]>(`${environment.backendUrl}/missions/active`).toPromise();
      return missions || [];
    } catch (error) {
      console.error('Erro ao buscar missões ativas:', error);
      return [];
    }
  }

  async updateMission(id: string, mission: Partial<Mission>): Promise<void> {
    try {
      if (!id || typeof id !== 'string' || id.trim() === '' || id.includes('/')) {
        console.error('Invalid mission id provided to updateMission:', id);
        throw new Error('Invalid mission id provided to updateMission');
      }
      await this.http.put(`${environment.backendUrl}/missions/${id}`, mission).toPromise();
      this.clearCache();
    } catch (error) {
      console.error('Erro ao atualizar missão:', error);
      throw error;
    }
  }

  async deleteMission(id: string): Promise<void> {
    try {
      if (!id || typeof id !== 'string' || id.trim() === '' || id.includes('/')) {
        console.error('Invalid mission id provided to deleteMission:', id);
        throw new Error('Invalid mission id provided to deleteMission');
      }
      await this.http.delete(`${environment.backendUrl}/missions/${id}`).toPromise();
      this.eventService.missionsChanged();
    } catch (error) {
      console.error('Erro ao deletar missão:', error);
      throw error;
    }
  }

  async getUserMissions(userId: string): Promise<(UserMission & { mission?: Mission })[]> {
    try {
      const userMissions = await this.http.get<(UserMission & { mission?: Mission })[]>(
        `${environment.backendUrl}/missions/user/${userId}`
      ).toPromise();
      return userMissions || [];
    } catch (error) {
      console.error('Erro ao buscar missões do usuário:', error);
      return [];
    }
  }

  async startMission(userId: string, missionId: string): Promise<string> {
    try {
      const response = await this.http.post<{ id: string }>(
        `${environment.backendUrl}/missions/user/${userId}/start/${missionId}`, 
        {}
      ).toPromise();
      return response!.id;
    } catch (error) {
      console.error('Erro ao iniciar missão:', error);
      throw error;
    }
  }

  async claimMission(userMissionId: string): Promise<void> {
    try {
      await this.http.put(
        `${environment.backendUrl}/missions/user-mission/${userMissionId}/claim`, 
        {}
      ).toPromise();
      this.eventService.missionsChanged();
      this.eventService.ticketsChanged();
    } catch (error) {
      console.error('Erro ao marcar missão como coletada:', error);
      throw error;
    }
  }

  async claimDaily(userMissionId: string, day: number): Promise<void> {
    try {
      await this.http.put(
        `${environment.backendUrl}/missions/user-mission/${userMissionId}/claim-daily`, 
        { day }
      ).toPromise();
      this.eventService.missionsChanged();
      this.eventService.ticketsChanged();
    } catch (error) {
      console.error('Erro ao coletar dia:', error);
      throw error;
    }
  }

  async updateProgress(userMissionId: string, progress: number): Promise<void> {
    try {
      await this.http.put(
        `${environment.backendUrl}/missions/user-mission/${userMissionId}/progress`, 
        { progress }
      ).toPromise();
    } catch (error) {
      console.error('Erro ao atualizar progresso:', error);
      throw error;
    }
  }

  async completeMission(userMissionId: string): Promise<void> {
    try {
      await this.http.put(
        `${environment.backendUrl}/missions/user-mission/${userMissionId}/complete`, 
        {}
      ).toPromise();
    } catch (error) {
      console.error('Erro ao completar missão:', error);
      throw error;
    }
  }

  async calculateProgress(userId: string, missionId: string): Promise<{ progress: number; currentValue: number; targetValue: number; completed: boolean }> {
    try {
      const result = await this.http.post<{ progress: number; currentValue: number; targetValue: number; completed: boolean }>(
        `${environment.backendUrl}/missions/user/${userId}/calculate-progress/${missionId}`,
        {}
      ).toPromise();
      return result!;
    } catch (error) {
      console.error('Erro ao calcular progresso:', error);
      return { progress: 0, currentValue: 0, targetValue: 0, completed: false };
    }
  }

  async getUserStats(userId: string): Promise<UserMissionStats | null> {
    try {
      const stats = await this.http.get<UserMissionStats>(
        `${environment.backendUrl}/missions/user/${userId}/stats`
      ).toPromise();
      return stats || null;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return null;
    }
  }

  async updateUserStats(userId: string, stats: Partial<UserMissionStats>): Promise<void> {
    try {
      await this.http.put(
        `${environment.backendUrl}/missions/user/${userId}/stats`, 
        stats
      ).toPromise();
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
      throw error;
    }
  }

  getMissionIconClass(mission: Mission): string {
    if (mission.icon) return mission.icon;
    
    switch (mission.goal.type) {
      case 'TICKETS_SPENT':
        return 'bi-ticket-perforated';
      case 'BOXES_OPENED':
        return 'bi-box-seam';
      case 'ITEMS_COLLECTED':
        return 'bi-collection';
      case 'TOTAL_POWER':
        return 'bi-lightning-charge';
      case 'RARITY_COLLECTED':
        return 'bi-gem';
      case 'LOGIN_DAYS':
        return 'bi-calendar-check';
      case 'TRADES_COMPLETED':
        return 'bi-arrow-left-right';
      case 'FRIENDS_ADDED':
        return 'bi-people';
      default:
        return 'bi-check-circle';
    }
  }

  getMissionDescription(mission: Mission): string {
    if (mission.description && mission.description.trim() !== '') {
      return mission.description;
    }

    if (mission.requirement) {
      const amount = (mission as any).requirementAmount || 0;
      switch (mission.requirement) {
        case 'TOTAL_POWER':
          return `Atinja ${amount} de poder total`;
        case 'ITEM_COUNT':
          return `Colete ${amount} itens`;
        case 'RARITY_COMMON':
          return 'Ganhe um item Comum';
        case 'RARITY_RARE':
          return 'Ganhe um item Raro';
        case 'RARITY_EPIC':
          return 'Ganhe um item Épico';
        case 'RARITY_LEGENDARY':
          return 'Ganhe um item Lendário';
        case 'RARITY_MYTHIC':
          return 'Ganhe um item Mítico';
        case 'OPEN_BOXES':
          return `Abra ${amount} caixas`;
        case 'GACHA_PULLS':
          return `Faça ${amount} gachas`;
        case 'COMPLETE_TRADES':
          return `Complete ${amount} trocas`;
        default:
          return mission.title || 'Missão';
      }
    }

    const goal = mission.goal;
    if (goal) {
      switch (goal.type) {
        case 'TICKETS_SPENT':
          return `Gaste ${goal.target} tickets ${goal.ticketType === 'PREMIUM' ? 'premium' : 'normais'}`;
        case 'BOXES_OPENED':
          return `Abra ${goal.target} caixas`;
        case 'ITEMS_COLLECTED':
          return `Colete ${goal.target} itens${goal.rarity ? ` ${goal.rarity.toLowerCase()}s` : ''}`;
        case 'TOTAL_POWER':
          return `Atinja ${goal.target} de poder total`;
        case 'RARITY_COLLECTED':
          return `Colete ${goal.target} itens ${goal.rarity?.toLowerCase()}s`;
        case 'LOGIN_DAYS':
          return `Faça login por ${goal.target} dias consecutivos`;
        case 'TRADES_COMPLETED':
          return `Complete ${goal.target} trocas`;
        case 'FRIENDS_ADDED':
          return `Adicione ${goal.target} amigos`;
        default:
          return mission.title || 'Missão';
      }
    }

    return mission.title || 'Missão';
  }

  getProgressPercentage(userMission: UserMission): number {
    if (!userMission) {
      return 0;
    }
    
    if (userMission.completed) {
      return 100;
    }
    
    if (typeof userMission.progress !== 'number') {
      return 0;
    }
    
    return Math.min(100, Math.max(0, userMission.progress));
  }

  canClaimMission(userMission: UserMission): boolean {
    if (!userMission || !userMission.mission) return false;
    return userMission.completed && !userMission.claimed;
  }
}

