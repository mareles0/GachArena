import { Component, OnInit } from '@angular/core';
import { MissionService } from '../../services/mission.service';
import { UserService } from '../../services/user.service';
import { Mission, UserMission } from '../../models/mission.model';

@Component({
  selector: 'app-missions',
  templateUrl: './missions.component.html',
  styleUrls: ['./missions.component.scss']
})
export class MissionsComponent implements OnInit {
  userMissions: (UserMission & { mission?: Mission })[] = [];
  availableMissions: Mission[] = [];
  currentUserId: string = '';
  isLoading = false;

  notification = {
    show: false,
    message: '',
    type: 'success'
  };

  constructor(
    private missionService: MissionService,
    private userService: UserService
  ) { }

  async ngOnInit() {
    this.currentUserId = await this.userService.getCurrentUserId() || '';
    if (this.currentUserId) {
      await this.loadMissions();
    }
  }

  async loadMissions() {
    this.isLoading = true;
    try {
      const [userMissions, activeMissions] = await Promise.all([
        this.missionService.getUserMissions(this.currentUserId),
        this.missionService.getActiveMissions()
      ]);

      this.userMissions = userMissions;
      
      // Filtrar missões disponíveis (não iniciadas)
      const startedMissionIds = userMissions.map(um => um.missionId);
      this.availableMissions = activeMissions.filter(m => !startedMissionIds.includes(m.id || ''));
    } catch (error) {
      this.showNotification('Erro ao carregar missões', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async startMission(missionId: string) {
    try {
      await this.missionService.startMission(this.currentUserId, missionId);
      this.showNotification('Missão iniciada!', 'success');
      await this.loadMissions();
    } catch (error) {
      this.showNotification('Erro ao iniciar missão', 'error');
    }
  }

  async claimReward(userMission: UserMission & { mission?: Mission }) {
    if (!userMission.mission || !userMission.id) return;

    try {
      // Atualizar como reclamada
      await this.missionService.updateProgress(userMission.id, userMission.progress);
      
      // Adicionar recompensas ao usuário
      if (userMission.mission.rewardNormal) {
        await this.userService.addTickets(this.currentUserId, userMission.mission.rewardNormal);
      }

      this.showNotification('Recompensa coletada!', 'success');
      await this.loadMissions();
    } catch (error) {
      this.showNotification('Erro ao coletar recompensa', 'error');
    }
  }

  getMissionIcon(type: string): string {
    const icons: any = {
      'DAILY': 'bi-calendar-check',
      'WEEKLY': 'bi-calendar-week',
      'SPECIAL': 'bi-star-fill'
    };
    return icons[type] || 'bi-check-circle';
  }

  getProgressPercentage(userMission: UserMission & { mission?: Mission }): number {
    if (!userMission.mission) return 0;
    // Simplifique: retornar progresso direto
    return Math.min(100, userMission.progress);
  }

  showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => {
      this.notification.show = false;
    }, 4000);
  }
}
