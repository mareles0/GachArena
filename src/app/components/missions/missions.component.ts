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
  view: 'all' | 'diarias' | 'desafios' = 'all';
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
    if (!missionId) {
      this.showNotification('Missão inválida', 'error');
      return;
    }

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
      if (userMission.mission.type === 'DAILY') {
        // For daily missions, claim next available day
        const nextDay = this.getNextUnclaimedDay(userMission);
        if (!nextDay) {
          this.showNotification('Nenhum dia disponível para coletar', 'info');
          return;
        }
        await this.claimDaily(userMission, nextDay);
        return;
      }

      // Non-daily: whole mission claim
      if (userMission.claimed) {
        this.showNotification('Recompensa já coletada', 'info');
        return;
      }

      await this.missionService.claimMission(userMission.id);

      // Adicionar recompensas ao usuário (defensive: garantir number)
      const normal = Number(userMission.mission.rewardNormal || 0);
      const premium = Number(userMission.mission.rewardPremium || 0);

      if (isFinite(normal) && normal > 0) {
        await this.userService.addTickets(this.currentUserId, normal, 'normal');
      }
      if (isFinite(premium) && premium > 0) {
        await this.userService.addTickets(this.currentUserId, premium, 'premium');
      }

      this.showNotification('Recompensa coletada!', 'success');
      await this.loadMissions();
    } catch (error:any) {
      this.showNotification(error?.message || 'Erro ao coletar recompensa', 'error');
    }
  }

  getNextUnclaimedDay(um: UserMission & { mission?: Mission }): number | null {
    if (!um.mission || !um.mission.dailyRewards) return null;
    const total = um.mission.dailyRewards.length;
    const claimed: number[] = (um.claimedDays || []).slice();
    for (let d = 1; d <= total; d++) {
      if (!claimed.includes(d)) return d;
    }
    return null;
  }

  isDayClaimed(um: UserMission & { mission?: Mission }, day: number) {
    return (um.claimedDays || []).includes(day);
  }

  async claimDaily(um: UserMission & { mission?: Mission }, day: number) {
    if (!um || !um.id) return;
    try {
      if (!confirm(`Coletar recompensa do Dia ${day}?`)) return;
      await this.missionService.claimDaily(um.id, day);
      // grant reward to user according to mission.dailyRewards[day-1]
      const d = (um.mission?.dailyRewards || [])[day - 1];
      const normal = Number(d?.rewardNormal || 0);
      const premium = Number(d?.rewardPremium || 0);
      if (isFinite(normal) && normal > 0) await this.userService.addTickets(this.currentUserId, normal, 'normal');
      if (isFinite(premium) && premium > 0) await this.userService.addTickets(this.currentUserId, premium, 'premium');

      this.showNotification(`Recompensa do Dia ${day} coletada!`, 'success');
      // small delay to allow animation to show (CSS handles pop-in when .day-collected appears)
      await new Promise(res => setTimeout(res, 300));
      await this.loadMissions();
    } catch (err:any) {
      this.showNotification(err?.message || 'Erro ao coletar dia', 'error');
    }
  }

  isDayAvailable(um: UserMission & { mission?: Mission }) {
    if (!um || !um.mission) return false;
    const na = um.nextAvailableAt as any;
    if (!na) return true;
    const naMs = na.seconds ? na.seconds * 1000 : (na.toMillis ? na.toMillis() : Date.parse(na));
    return Date.now() >= naMs;
  }

  timeUntilNext(um: UserMission & { mission?: Mission }): string {
    const na = um.nextAvailableAt as any;
    if (!na) return '';
    const naMs = na.seconds ? na.seconds * 1000 : (na.toMillis ? na.toMillis() : Date.parse(na));
    const diff = naMs - Date.now();
    if (diff <= 0) return '';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  getMissionIcon(type: string): string {
    const icons: any = {
      'DAILY': 'bi-calendar-check',
      'WEEKLY': 'bi-calendar-week',
      'SPECIAL': 'bi-star-fill'
    };
    return icons[type] || 'bi-check-circle';
  }

  getCurrentDailyDay(um: UserMission & { mission?: Mission }): number {
    const total = (um.mission && um.mission.dailyRewards && um.mission.dailyRewards.length) || 7;
    const pct = typeof um.progress === 'number' ? um.progress : 0;
    const day = Math.min(total, Math.max(1, Math.floor((pct / (100 / total)) + 1)));
    return day;
  }

  get dailyUserMissions() {
    return this.userMissions.filter(u => (u.mission && u.mission.type === 'DAILY'));
  }

  get otherUserMissions() {
    return this.userMissions.filter(u => !(u.mission && u.mission.type === 'DAILY'));
  }

  get dailyAvailable() {
    return this.availableMissions.filter(m => m.type === 'DAILY');
  }

  get otherAvailable() {
    return this.availableMissions.filter(m => m.type !== 'DAILY');
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
