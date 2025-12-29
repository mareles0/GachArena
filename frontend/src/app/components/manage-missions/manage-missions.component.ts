import { Component, OnInit, ChangeDetectorRef, NgZone, ApplicationRef, ChangeDetectionStrategy } from '@angular/core';
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
  selectedDailyIndex: number = 0;
  isCreating = false;

  notification = { show: false, message: '', type: 'success' };
  confirmation: { show: boolean; message: string; mission?: Mission | null } = { show: false, message: '', mission: null };

  constructor(private missionService: MissionService, private cdr: ChangeDetectorRef, private ngZone: NgZone, private appRef: ApplicationRef) { }

  async ngOnInit() {
    console.log('ManageMissionsComponent ngOnInit');
    this.ngZone.run(async () => {
      await this.loadMissions();
    });
  }

  async loadMissions() {
    this.isLoading = true;
    try {
      const missions = await this.missionService.getAllMissions();
      this.ngZone.run(() => {
        this.missions = [...missions];
        setTimeout(() => {
          this.cdr.markForCheck();
          this.appRef.tick();
          this.cdr.detectChanges();
        }, 0);
      });
      // Diagnostic: log any missions missing id
      const missingId = this.missions.filter(m => !m.id || typeof m.id !== 'string' || m.id.trim() === '');
      if (missingId.length > 0) {
        console.error('Loaded missions with missing id:', missingId);
      }
    } catch (error) {
      this.showNotification('Erro ao carregar missões', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  startCreate(type: 'regular' | 'daily') {
    this.isEditing = true;
    this.isCreating = true;
    this.editingMission = this.getEmptyMission();
    if (type === 'regular') {
      this.editingMission.type = 'WEEKLY';
      this.editingMission.dailyRewards = undefined;
    } else {
      this.editingMission.type = 'DAILY';
      this.editingMission.title = 'Missão Diária';
      this.editingMission.description = 'Complete os dias consecutivos para ganhar recompensas progressivas.';
      this.editingMission.requirement = 'Fazer login diariamente';
      this.editingMission.autoComplete = true;
      // dailyRewards already set in getEmptyMission
    }
  }

  startEdit(mission: Mission) {
    this.isEditing = true;
    this.isCreating = false;
    this.editingMission = { ...mission };
    // ensure dailyRewards exists for daily missions when editing
    if (this.editingMission.type === 'DAILY' && (!this.editingMission.dailyRewards || this.editingMission.dailyRewards.length === 0)) {
      this.editingMission.dailyRewards = [{ day: 1, label: 'Day 1', rewardNormal: 0, rewardPremium: 0, imageUrl: '' }];
    }
  }

  cancelEdit() {
    this.isEditing = false;
    this.isCreating = false;
    this.editingMission = this.getEmptyMission();
  }

  async saveMission() {
    try {
      // Ensure dailyRewards exists if type is DAILY
      if (this.editingMission.type === 'DAILY' && !this.editingMission.dailyRewards) {
        this.editingMission.dailyRewards = [{ day: 1, label: 'Day 1', rewardNormal: 0, rewardPremium: 0, imageUrl: '' }];
      }
      // Ensure numeric fields are numbers
      this.editingMission.rewardNormal = Number(this.editingMission.rewardNormal || 0);
      this.editingMission.rewardPremium = Number(this.editingMission.rewardPremium || 0);
      // Normalize dailyRewards numbers
      if (this.editingMission.dailyRewards && this.editingMission.dailyRewards.length) {
        this.editingMission.dailyRewards = this.editingMission.dailyRewards.map(d => ({
          day: Number(d.day || 0),
          label: d.label || (`Day ${d.day}`),
          rewardNormal: Number(d.rewardNormal || 0),
          rewardPremium: Number(d.rewardPremium || 0),
          imageUrl: d.imageUrl || ''
        }));
      }

      if (this.editingMission.id) {
        await this.missionService.updateMission(this.editingMission.id, this.editingMission);
        this.showNotification('Missão atualizada!', 'success');
      } else {
        const newId = await this.missionService.createMission(this.editingMission as any);
        // assign returned id to the mission (defensive)
        this.editingMission.id = newId;
        this.showNotification('Missão criada!', 'success');
      }
      this.cancelEdit();
      await this.loadMissions();
    } catch (error) {
      this.showNotification('Erro ao salvar missão', 'error');
    }
  }

  showDeleteConfirmation(mission: Mission) {
    if (!mission || !mission.id) {
      this.showNotification('Missão inválida (id ausente)', 'error');
      console.error('Attempted to delete mission without id:', mission);
      return;
    }
    this.confirmation = { show: true, message: `Deseja realmente deletar a missão "${mission.title || mission.id}"?`, mission };
  }

  cancelConfirmation() {
    this.confirmation = { show: false, message: '', mission: null };
  }

  async confirmDeletion() {
    if (!this.confirmation.mission || !this.confirmation.mission.id) {
      this.showNotification('Missão inválida (id ausente)', 'error');
      console.error('confirmDeletion called without a valid mission:', this.confirmation);
      this.cancelConfirmation();
      return;
    }

    const id = this.confirmation.mission.id;
    this.cancelConfirmation();

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
      if (!mission.id) {
        this.showNotification('Missão inválida (id ausente)', 'error');
        console.error('Attempted to toggleActive for mission without id:', mission);
        return;
      }
      await this.missionService.updateMission(mission.id, { active: !mission.active });
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
      autoComplete: false,
      rewardNormal: 0,
      rewardPremium: 0,
      active: true,
      createdAt: new Date()
      , dailyRewards: [{ day: 1, label: 'Day 1', rewardNormal: 0, rewardPremium: 0, imageUrl: '' }]
    };
  }

  addDailyDay() {
    const dr = this.editingMission.dailyRewards || [];
    dr.push({ day: dr.length + 1, label: `Day ${dr.length + 1}`, rewardNormal: 0, rewardPremium: 0, imageUrl: '' });
    this.editingMission.dailyRewards = dr;
    this.selectedDailyIndex = dr.length - 1; // Select the new day
  }

  removeDailyDay(index: number) {
    if (!this.editingMission.dailyRewards) return;
    this.editingMission.dailyRewards.splice(index, 1);
    // renumber days
    this.editingMission.dailyRewards = this.editingMission.dailyRewards.map((d, i) => ({ ...d, day: i + 1 }));
    if (this.selectedDailyIndex >= this.editingMission.dailyRewards.length) {
      this.selectedDailyIndex = Math.max(0, this.editingMission.dailyRewards.length - 1);
    }
  }

  addTicket(index: number, type: 'normal' | 'premium') {
    if (!this.editingMission.dailyRewards) return;
    const reward = this.editingMission.dailyRewards[index];
    if (type === 'normal') {
      reward.rewardNormal = (reward.rewardNormal || 0) + 1;
    } else {
      reward.rewardPremium = (reward.rewardPremium || 0) + 1;
    }
  }

  moveDailyUp(index: number) {
    if (!this.editingMission.dailyRewards || index <= 0) return;
    const arr = this.editingMission.dailyRewards;
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    this.editingMission.dailyRewards = arr.map((d, i) => ({ ...d, day: i + 1 }));
    this.selectedDailyIndex = index - 1;
  }

  moveDailyDown(index: number) {
    if (!this.editingMission.dailyRewards || index >= this.editingMission.dailyRewards.length - 1) return;
    const arr = this.editingMission.dailyRewards;
    [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
    this.editingMission.dailyRewards = arr.map((d, i) => ({ ...d, day: i + 1 }));
    this.selectedDailyIndex = index + 1;
  }

  get selectedDailyReward() {
    return this.editingMission.dailyRewards?.[this.selectedDailyIndex] || { day: 0, label: '', rewardNormal: 0, rewardPremium: 0, imageUrl: '' };
  }

  showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => this.notification.show = false, 5000); // Aumentado para 5 segundos
  }
}
