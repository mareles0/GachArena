import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Mission, UserMission } from '../models/mission.model';

@Injectable({
  providedIn: 'root'
})
export class MissionService {

  constructor(private http: HttpClient) { }

  // CRUD Missões
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

  // UserMissions
  async getUserMissions(userId: string): Promise<(UserMission & { mission?: Mission })[]> {
    try {
      const userMissions = await this.http.get<(UserMission & { mission?: Mission })[]>(`${environment.backendUrl}/missions/user/${userId}`).toPromise();
      return userMissions || [];
    } catch (error) {
      console.error('Erro ao buscar missões do usuário:', error);
      return [];
    }
  }

  async startMission(userId: string, missionId: string): Promise<string> {
    try {
      const response = await this.http.post<{ id: string }>(`${environment.backendUrl}/missions/user/${userId}/start/${missionId}`, {}).toPromise();
      return response!.id;
    } catch (error) {
      console.error('Erro ao iniciar missão:', error);
      throw error;
    }
  }

  async claimMission(userMissionId: string): Promise<void> {
    try {
      await this.http.put(`${environment.backendUrl}/missions/user-mission/${userMissionId}/claim`, {}).toPromise();
    } catch (error) {
      console.error('Erro ao marcar missão como coletada:', error);
      throw error;
    }
  }

  async claimDaily(userMissionId: string, day: number): Promise<void> {
    try {
      await this.http.put(`${environment.backendUrl}/missions/user-mission/${userMissionId}/claim-daily`, { day }).toPromise();
    } catch (error) {
      console.error('Erro ao coletar dia:', error);
      throw error;
    }
  }

  async updateProgress(userMissionId: string, progress: number): Promise<void> {
    try {
      await this.http.put(`${environment.backendUrl}/missions/user-mission/${userMissionId}/progress`, { progress }).toPromise();
    } catch (error) {
      console.error('Erro ao atualizar progresso:', error);
      throw error;
    }
  }

  async completeMission(userMissionId: string): Promise<void> {
    try {
      await this.http.put(`${environment.backendUrl}/missions/user-mission/${userMissionId}/complete`, {}).toPromise();
    } catch (error) {
      console.error('Erro ao completar missão:', error);
      throw error;
    }
  }
}
