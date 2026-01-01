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
    type: 'success' as 'success' | 'error' | 'info'
  };

  constructor(
    private missionService: MissionService,
    private userService: UserService
  ) { }

  async ngOnInit() {
    try {
      this.currentUserId = await this.userService.getCurrentUserId() || '';
      if (this.currentUserId) {
        await this.loadMissions();
      }
    } catch (error) {
      console.error('Erro ao inicializar missões:', error);
    }
  }

  async loadMissions() {
    this.isLoading = true;
    try {
      const [userMissions, activeMissions] = await Promise.all([
        this.missionService.getUserMissions(this.currentUserId),
        this.missionService.getActiveMissions()
      ]);

      this.userMissions = userMissions || [];
      
      const startedMissionIds = this.userMissions.map(um => um.missionId);
      this.availableMissions = (activeMissions || []).filter(m => !startedMissionIds.includes(m.id || ''));
    } catch (error) {
      console.error('Erro ao carregar missões:', error);
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
      console.error('Erro ao iniciar missão:', error);
      this.showNotification('Erro ao iniciar missão', 'error');
    }
  }

  async claimReward(userMission: UserMission & { mission?: Mission }) {
    if (!userMission.mission || !userMission.id) return;
    
    try {
      if (userMission.claimed) {
        this.showNotification('Recompensa já coletada', 'info');
        return;
      }

      if (!userMission.completed) {
        this.showNotification('Missão ainda não completada', 'info');
        return;
      }

      await this.missionService.claimMission(userMission.id);

      const normal = Number(userMission.mission.reward?.normalTickets || 0);
      const premium = Number(userMission.mission.reward?.premiumTickets || 0);

      if (isFinite(normal) && normal > 0) {
        await this.userService.addTickets(this.currentUserId, normal, 'normal');
      }
      if (isFinite(premium) && premium > 0) {
        await this.userService.addTickets(this.currentUserId, premium, 'premium');
      }

      this.showNotification('Recompensa coletada!', 'success');
      await this.loadMissions();
    } catch (error: any) {
      console.error('Erro ao coletar recompensa:', error);
      this.showNotification(error?.message || 'Erro ao coletar recompensa', 'error');
    }
  }

  getNextUnclaimedDay(um: UserMission & { mission?: Mission }): number | null {
    if (!um.mission || !um.mission.dailyRewards) return null;
    const total = um.mission.dailyRewards.length;
    const claimed: number[] = (um.claimedDays || []);
    for (let d = 1; d <= total; d++) {
      if (!claimed.includes(d)) return d;
    }
    return null;
  }

  isDayClaimed(um: UserMission & { mission?: Mission }, day: number): boolean {
    return (um.claimedDays || []).includes(day);
  }

  async claimDaily(um: UserMission & { mission?: Mission }, day: number) {
    if (!um || !um.id) return;
    
    try {
      await this.missionService.claimDaily(um.id, day);
      
      const dayReward = (um.mission?.dailyRewards || [])[day - 1];
      if (dayReward) {
        const normal = Number(dayReward.reward?.normalTickets || 0);
        const premium = Number(dayReward.reward?.premiumTickets || 0);
        
        if (isFinite(normal) && normal > 0) {
          await this.userService.addTickets(this.currentUserId, normal, 'normal');
        }
        if (isFinite(premium) && premium > 0) {
          await this.userService.addTickets(this.currentUserId, premium, 'premium');
        }
      }

      this.showNotification(`Dia ${day} coletado!`, 'success');
      await this.loadMissions();
    } catch (err: any) {
      console.error('Erro ao coletar dia:', err);
      this.showNotification(err?.message || 'Erro ao coletar dia', 'error');
    }
  }

  isDayAvailable(um: UserMission & { mission?: Mission }): boolean {
    if (!um || !um.mission) return false;
    const na = um.nextAvailableAt as any;
    if (!na) return true;
    
    try {
      const naMs = na.seconds ? na.seconds * 1000 : (na.toMillis ? na.toMillis() : Date.parse(na));
      return Date.now() >= naMs;
    } catch {
      return true;
    }
  }

  timeUntilNext(um: UserMission & { mission?: Mission }): string {
    const na = um.nextAvailableAt as any;
    if (!na) return '';
    
    try {
      const naMs = na.seconds ? na.seconds * 1000 : (na.toMillis ? na.toMillis() : Date.parse(na));
      const diff = naMs - Date.now();
      if (diff <= 0) return '';
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    } catch {
      return '';
    }
  }

  getMissionIcon(mission?: Mission): string {
    if (!mission) return 'bi-check-circle';
    return this.missionService.getMissionIconClass(mission);
  }

  getMissionDescription(mission?: Mission): string {
    if (!mission) return '';
    return this.missionService.getMissionDescription(mission);
  }

  getCurrentDailyDay(um: UserMission & { mission?: Mission }): number {
    const total = (um.mission?.dailyRewards?.length) || 7;
    const claimed = (um.claimedDays || []).length;
    return Math.min(total, claimed + 1);
  }

  get dailyUserMissions() {
    return this.userMissions.filter(u => u.mission?.type === 'DAILY');
  }

  get otherUserMissions() {
    return this.userMissions.filter(u => u.mission?.type !== 'DAILY');
  }

  get dailyAvailable() {
    return this.availableMissions.filter(m => m.type === 'DAILY');
  }

  get otherAvailable() {
    return this.availableMissions.filter(m => m.type !== 'DAILY');
  }

  getProgressPercentage(userMission: UserMission & { mission?: Mission }): number {
    if (!userMission.mission) return 0;
    return this.missionService.getProgressPercentage(userMission);
  }

  canClaimMission(userMission: UserMission & { mission?: Mission }): boolean {
    return this.missionService.canClaimMission(userMission);
  }

  showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => {
      this.notification.show = false;
    }, 4000);
  }
}
