import { Component, OnInit } from '@angular/core';
import { MissionService } from '../../services/mission.service';
import { Mission } from '../../models/mission.model';

@Component({
  selector: 'app-manage-missions',
  templateUrl: './manage-missions.component.html',
  styleUrls: ['./manage-missions.component.scss']
})
export class ManageMissionsComponent implements OnInit {
  missions: Mission[] = [];
  isEditing = false;
  editingMission: Mission = this.getEmptyMission();
  isLoading = false;

  notification = { show: false, message: '', type: 'success' };

  constructor(private missionService: MissionService) { }

  async ngOnInit() {
    await this.loadMissions();
  }

  async loadMissions() {
    this.isLoading = true;
    try {
      this.missions = await this.missionService.getAllMissions();
    } catch (error) {
      this.showNotification('Erro ao carregar missões', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  startCreate() {
    this.isEditing = true;
    this.editingMission = this.getEmptyMission();
  }

  startEdit(mission: Mission) {
    this.isEditing = true;
    this.editingMission = { ...mission };
  }

  cancelEdit() {
    this.isEditing = false;
    this.editingMission = this.getEmptyMission();
  }

  async saveMission() {
    try {
      if (this.editingMission.id) {
        await this.missionService.updateMission(this.editingMission.id, this.editingMission);
        this.showNotification('Missão atualizada!', 'success');
      } else {
        await this.missionService.createMission(this.editingMission);
        this.showNotification('Missão criada!', 'success');
      }
      this.cancelEdit();
      await this.loadMissions();
    } catch (error) {
      this.showNotification('Erro ao salvar missão', 'error');
    }
  }

  async deleteMission(id: string) {
    if (!confirm('Deseja realmente deletar esta missão?')) return;
    try {
      await this.missionService.deleteMission(id);
      this.showNotification('Missão deletada', 'success');
      await this.loadMissions();
    } catch (error) {
      this.showNotification('Erro ao deletar missão', 'error');
    }
  }

  async toggleActive(mission: Mission) {
    try {
      await this.missionService.updateMission(mission.id || '', { active: !mission.active });
      this.showNotification(mission.active ? 'Missão desativada' : 'Missão ativada', 'success');
      await this.loadMissions();
    } catch (error) {
      this.showNotification('Erro ao atualizar missão', 'error');
    }
  }

  getEmptyMission(): Mission {
    return {
      id: '',
      title: '',
      description: '',
      type: 'DAILY',
      requirement: '',
      rewardNormal: 0,
      rewardPremium: 0,
      active: true,
      createdAt: new Date()
    };
  }

  showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => this.notification.show = false, 5000); // Aumentado para 5 segundos
  }
}
