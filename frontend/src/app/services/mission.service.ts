import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Mission, UserMission, UserMissionStats } from '../models/mission.model';

@Injectable({
  providedIn: 'root'
})
export class MissionService {

  constructor(private http: HttpClient) { }

  // ===== CRUD Missões =====
  
  async createMission(mission: Omit<Mission, 'id' | 'createdAt'>): Promise<string> {
    try {
      const response = await this.http.post<{ id: string }>(`${environment.backendUrl}/missions`, mission).toPromise();
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

  async getAllMissions(): Promise<Mission[]> {
    try {
      const missions = await this.http.get<Mission[]>(`${environment.backendUrl}/missions`).toPromise();
      return missions || [];
    } catch (error) {
      console.error('Erro ao buscar missões:', error);
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
    } catch (error) {
      console.error('Erro ao deletar missão:', error);
      throw error;
    }
  }

  // ===== Missões do Usuário =====
  
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

  // ===== Estatísticas do Usuário =====
  
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

  // ===== Helpers =====
  
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
    const goal = mission.goal;
    
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
        return mission.description;
    }
  }

  getProgressPercentage(userMission: UserMission): number {
    if (!userMission.mission) return 0;
    const target = userMission.mission.goal.target;
    if (target === 0) return 100;
    return Math.min(100, (userMission.progress / target) * 100);
  }

  canClaimMission(userMission: UserMission): boolean {
    if (!userMission.mission) return false;
    return userMission.progress >= userMission.mission.goal.target && 
           !userMission.claimed;
  }
}

