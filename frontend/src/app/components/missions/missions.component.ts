import { Component, OnInit, OnDestroy } from '@angular/core';
import { MissionService } from '../../services/mission.service';
import { EventService } from '../../services/event.service';
import { TicketService } from '../../services/ticket.service';
import { Mission, UserMission } from '../../models/mission.model';
import { auth } from '../../firebase.config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-missions',
  templateUrl: './missions.component.html',
  styleUrls: ['./missions.component.scss']
})
export class MissionsComponent implements OnInit, OnDestroy {
  userMissions: (UserMission & { mission?: Mission })[] = [];
  availableMissions: Mission[] = [];
  view: 'all' | 'diarias' | 'desafios' = 'all';
  missionFilter: 'all' | 'daily' | 'regular' = 'all';
  currentUserId: string = '';
  isLoading = false;
  private unsubscribeAuth?: () => void;
  private eventSubscription?: Subscription;
  private reloadQueued = false;
  private autoStartInProgress = false;
  
  dailyMissionData = new Map<string, {
    nextUnclaimedDay: number | null;
    isDayAvailable: boolean;
  }>();
  
  progressCache = new Map<string, number>();

  notification = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  };

  constructor(
    private missionService: MissionService,
    private eventService: EventService,
    private ticketService: TicketService
  ) { }

  getMissionNormalReward(mission?: Mission): number {
    const anyMission = mission as any;
    const value = mission?.reward?.normalTickets ?? anyMission?.rewardNormal ?? 0;
    return Number(value || 0);
  }

  getMissionPremiumReward(mission?: Mission): number {
    const anyMission = mission as any;
    const value = mission?.reward?.premiumTickets ?? anyMission?.rewardPremium ?? 0;
    return Number(value || 0);
  }

  async ngOnInit() {
    console.log('[Missions] ngOnInit iniciado');
    
    this.eventSubscription = this.eventService.events$.subscribe((event) => {
      console.log('[Missions] Evento recebido:', event);
      if (this.currentUserId && event === 'missionsChanged') {
        console.log('[Missions] Recarregando missões (alteração detectada)...');
        this.queueReloadMissions();
        return;
      }
      if (this.currentUserId && (event === 'boxesOpened' || event === 'itemsChanged' || event === 'tradesChanged' || event === 'userDataChanged')) {
        console.log('[Missions] Atualizando progresso das missões...');
        if (this.userMissions.length > 0) {
          this.updateMissionsProgress();
        }
      }
    });
    
    this.unsubscribeAuth = onAuthStateChanged(auth, async (user: User | null) => {
      console.log('[Missions] Usuário mudou:', user?.uid);
      if (user?.uid) {
        this.currentUserId = user.uid;
        await this.loadMissions();
      } else {
        console.log('[Missions] Nenhum usuário logado');
        this.currentUserId = '';
        this.userMissions = [];
        this.availableMissions = [];
      }
    });
  }

  ngOnDestroy() {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
    }
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }

  async loadMissions() {
    this.isLoading = true;
    this.progressCache.clear();
    try {
      const [userMissions, activeMissions] = await Promise.all([
        this.missionService.getUserMissions(this.currentUserId),
        this.missionService.getActiveMissions()
      ]);

      console.log('[Missions] userMissions:', userMissions);
      console.log('[Missions] activeMissions:', activeMissions);

      let filteredUserMissions = (userMissions || []).filter(um => um.mission && um.mission.id);

      // Auto-iniciar todas as missões ativas (inclui DAILY) para o usuário.
      // Isso evita que jogador novo precise clicar em "iniciar".
      const startedMissionIds = new Set(filteredUserMissions.map(um => um.missionId));
      const missingActive = (activeMissions || []).filter(m => !!m.id && !startedMissionIds.has(m.id!));

      if (missingActive.length > 0 && !this.autoStartInProgress) {
        this.autoStartInProgress = true;
        console.log('[Missions] Auto-iniciando missões ativas faltantes:', missingActive.map(m => m.id));

        await Promise.all(
          missingActive.map(m =>
            this.missionService.startMission(this.currentUserId, m.id!).catch((err) => {
              console.warn('[Missions] Falha ao auto-iniciar missão:', m.id, err);
              return '';
            })
          )
        );

        const refreshed = await this.missionService.getUserMissions(this.currentUserId);
        filteredUserMissions = (refreshed || []).filter(um => um.mission && um.mission.id);
        this.autoStartInProgress = false;
      }

      this.userMissions = filteredUserMissions;

      await this.updateMissionsProgress();

      const startedMissionIdsAfter = this.userMissions.map(um => um.missionId);
      this.availableMissions = (activeMissions || []).filter(m => !startedMissionIdsAfter.includes(m.id || ''));

      this.calculateDailyMissionData();
      
      console.log('[Missions] this.userMissions (filtradas):', this.userMissions);
      console.log('[Missions] this.availableMissions:', this.availableMissions);
      console.log('[Missions] dailyUserMissions:', this.dailyUserMissions);
      console.log('[Missions] otherUserMissions:', this.otherUserMissions);
      console.log('[Missions] dailyAvailable:', this.dailyAvailable);
      console.log('[Missions] otherAvailable:', this.otherAvailable);
    } catch (error) {
      console.error('Erro ao carregar missões:', error);
      this.showNotification('Erro ao carregar missões', 'error');
    } finally {
      this.isLoading = false;

      if (this.reloadQueued) {
        this.reloadQueued = false;
        this.loadMissions();
      }
    }
  }

  private queueReloadMissions() {
    if (this.isLoading) {
      this.reloadQueued = true;
      return;
    }
    this.loadMissions();
  }

  calculateDailyMissionData() {
    this.dailyMissionData.clear();
    console.log('[Missions] Calculando dados de missões diárias...');
    
    for (const um of this.userMissions) {
      if (um.mission?.type === 'DAILY' && um.id) {
        console.log('[Missions] Processando missão diária:', {
          id: um.id,
          claimedDays: um.claimedDays,
          nextAvailableAt: um.nextAvailableAt,
          progress: um.progress
        });
        
        const nextDay = this.calculateNextUnclaimedDay(um);
        const isAvailable = this.calculateDayAvailability(um);
        
        console.log(`[Missions] Missão ${um.id}: nextDay=${nextDay}, isAvailable=${isAvailable}`);
        
        this.dailyMissionData.set(um.id, {
          nextUnclaimedDay: nextDay,
          isDayAvailable: isAvailable
        });
      }
    }
    
    console.log('[Missions] dailyMissionData final:', Array.from(this.dailyMissionData.entries()));
    console.log('[Missions] Dados calculados:', this.dailyMissionData.size, 'missões');
  }

  async updateMissionsProgress() {
    console.log('[Missions] updateMissionsProgress iniciado para', this.userMissions.length, 'missões');
    
    this.progressCache.clear();
    
    for (const um of this.userMissions) {
      if (um.mission?.type !== 'DAILY' && !um.completed && um.mission?.id) {
        console.log('[Missions] Calculando progresso para missão:', um.mission.id, um.mission.title);
        try {
          const progressData = await this.missionService.calculateProgress(this.currentUserId, um.mission.id);
          um.progress = progressData.progress;
          console.log('[Missions] Progresso calculado:', um.mission.id, '=', um.progress, '%');
          
          if (um.id) {
            this.progressCache.set(um.id, um.progress);
          }
          
          if (progressData.completed && !um.completed && um.id) {
            console.log('[Missions] Missão completada, marcando como concluída:', um.mission.id);
            await this.missionService.completeMission(um.id);
            um.completed = true;
          }
        } catch (error: any) {
          console.error('[Missions] Erro ao calcular progresso da missão:', um.mission?.id, error);
          if (error?.status === 404) {
            console.warn('[Missions] Missão não encontrada no backend, setando progresso como 0');
            um.progress = 0;
            if (um.id) {
              this.progressCache.set(um.id, 0);
            }
          }
        }
      } else if (um.id) {
        this.progressCache.set(um.id, um.progress || 0);
      }
    }
    
    console.log('[Missions] updateMissionsProgress finalizado');
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

      await this.ticketService.refreshTickets(this.currentUserId);

      this.showNotification('Recompensa coletada!', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (error: any) {
      console.error('Erro ao coletar recompensa:', error);
      this.showNotification(error?.message || 'Erro ao coletar recompensa', 'error');
    }
  }

  calculateNextUnclaimedDay(um: UserMission & { mission?: Mission }): number | null {
    if (!um.mission || !um.mission.dailyRewards) {
      return null;
    }
    const total = um.mission.dailyRewards.length;
    const claimed: number[] = (um.claimedDays || []);
    for (let d = 1; d <= total; d++) {
      if (!claimed.includes(d)) {
        return d;
      }
    }
    return null;
  }
  
  getNextUnclaimedDay(um: UserMission & { mission?: Mission }): number | null {
    if (!um.id) return null;
    return this.dailyMissionData.get(um.id)?.nextUnclaimedDay ?? null;
  }

  isDayClaimed(um: UserMission & { mission?: Mission }, day: number): boolean {
    return (um.claimedDays || []).includes(day);
  }

  async claimDaily(um: UserMission & { mission?: Mission }, day: number) {
    if (!um || !um.id) {
      console.error('[Missions] claimDaily: UserMission inválida', um);
      return;
    }
    
    console.log('[Missions] Tentando coletar dia', day, 'da missão', um.id);
    console.log('[Missions] UserMission completa:', um);
    
    try {
      await this.missionService.claimDaily(um.id, day);

      await this.ticketService.refreshTickets(this.currentUserId);

      this.showNotification(`Dia ${day} coletado!`, 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      console.error('[Missions] Erro ao coletar dia:', err);
      this.showNotification(err?.message || 'Erro ao coletar dia', 'error');
    }
  }

  calculateDayAvailability(um: UserMission & { mission?: Mission }): boolean {
    if (!um || !um.mission) {
      console.log('[Missions] calculateDayAvailability: missão inválida');
      return false;
    }
    
    const nextDay = this.calculateNextUnclaimedDay(um);
    const claimedDaysCount = (um.claimedDays || []).length;
    
    console.log('[Missions] calculateDayAvailability:', {
      missionId: um.id,
      nextUnclaimedDay: nextDay,
      claimedDays: um.claimedDays,
      claimedDaysCount,
      nextAvailableAt: um.nextAvailableAt,
      lastDailyClaimAt: um.lastDailyClaimAt
    });
    
    const na = um.nextAvailableAt as any;
    const lastClaim = um.lastDailyClaimAt as any;

    // Compatibilidade: alguns usuários novos podem ter vindo com nextAvailableAt setado para amanhã.
    // Para o primeiro dia (sem coletas ainda), deve aparecer como disponível.
    if ((um.claimedDays || []).length === 0 && nextDay === 1 && !lastClaim) {
      console.log('[Missions] Dia 1 (primeira coleta) - disponível');
      return true;
    }
    
    if (!na && !lastClaim) {
      if (claimedDaysCount === 0) {
        console.log('[Missions] Primeira coleta, disponível');
        return true;
      } else {
        console.log('[Missions] Sem nextAvailableAt e lastDailyClaimAt, mas já tem dias coletados - bloqueando por segurança');
        return false;
      }
    }
    
    if (lastClaim) {
      try {
        let lastClaimMs: number;
        
        if (lastClaim.seconds !== undefined) {
          lastClaimMs = lastClaim.seconds * 1000;
        } else if (lastClaim.toMillis) {
          lastClaimMs = lastClaim.toMillis();
        } else if (typeof lastClaim === 'string') {
          lastClaimMs = Date.parse(lastClaim);
        } else if (lastClaim instanceof Date) {
          lastClaimMs = lastClaim.getTime();
        } else {
          lastClaimMs = 0;
        }
        
        if (lastClaimMs) {
          const lastClaimDate = new Date(lastClaimMs);
          const today = new Date();
          lastClaimDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          
          console.log('[Missions] Verificação de última coleta:', {
            lastClaimDate: lastClaimDate.toISOString(),
            today: today.toISOString(),
            sameDay: lastClaimDate.getTime() === today.getTime()
          });
          
          if (lastClaimDate.getTime() === today.getTime()) {
            console.log('[Missions] Já coletou hoje, não disponível');
            return false;
          }
        }
      } catch (err) {
        console.error('[Missions] Erro ao processar lastDailyClaimAt:', err);
      }
    }
    
    if (!na) {
      console.log('[Missions] Sem nextAvailableAt, mas passou verificação de lastClaim');
      return true;
    }
    
    try {
      let naMs: number;
      
      if (na.seconds !== undefined) {
        naMs = na.seconds * 1000;
      } else if (na.toMillis) {
        naMs = na.toMillis();
      } else if (typeof na === 'string') {
        naMs = Date.parse(na);
      } else if (na instanceof Date) {
        naMs = na.getTime();
      } else {
        console.error('[Missions] Formato de data desconhecido:', na);
        return false;
      }
      
      if (!naMs || isNaN(naMs)) {
        console.error('[Missions] Data inválida resultou em NaN:', { na, naMs });
        return false;
      }
      
      const now = Date.now();
      const available = now >= naMs;
      
      console.log('[Missions] calculateDayAvailability:', {
        now: new Date(now).toISOString(),
        nextAvailable: new Date(naMs).toISOString(),
        isAvailable: available,
        diff: (naMs - now) / 1000 / 60 + ' minutos'
      });
      
      return available;
    } catch (err) {
      console.error('[Missions] Erro ao processar data', err);
      return false;
    }
  }
  
  isDayAvailable(um: UserMission & { mission?: Mission }): boolean {
    if (!um.id) return false;
    return this.dailyMissionData.get(um.id)?.isDayAvailable ?? false;
  }

  timeUntilNext(um: UserMission & { mission?: Mission }): string {
    const na = um.nextAvailableAt as any;
    console.log('[Missions] timeUntilNext:', { missionId: um.id, nextAvailableAt: na });
    
    if (!na) {
      console.log('[Missions] timeUntilNext: sem nextAvailableAt');
      return '';
    }
    
    try {
      let naMs: number;
      
      if (na.seconds !== undefined) {
        naMs = na.seconds * 1000;
      } else if (na.toMillis) {
        naMs = na.toMillis();
      } else if (typeof na === 'string') {
        naMs = Date.parse(na);
      } else if (na instanceof Date) {
        naMs = na.getTime();
      } else {
        console.error('[Missions] Formato de data desconhecido:', na);
        return '';
      }
      
      if (!naMs || isNaN(naMs)) {
        console.error('[Missions] Data inválida resultou em NaN:', { na, naMs });
        return '';
      }
      
      const diff = naMs - Date.now();
      
      console.log('[Missions] timeUntilNext calc:', {
        naMs,
        now: Date.now(),
        diff,
        nextAvailable: new Date(naMs).toISOString()
      });
      
      if (diff <= 0) {
        console.log('[Missions] timeUntilNext: diff negativo ou zero');
        return '';
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (isNaN(hours) || isNaN(mins)) {
        console.error('[Missions] timeUntilNext: NaN detectado', { hours, mins, diff, naMs });
        return '';
      }
      
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    } catch (err) {
      console.error('[Missions] Erro ao calcular tempo:', err);
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
    if (this.missionFilter === 'regular') return [];
    return this.userMissions.filter(u => u.mission?.type === 'DAILY');
  }

  get otherUserMissions() {
    if (this.missionFilter === 'daily') return [];
    return this.userMissions.filter(u => u.mission?.type !== 'DAILY');
  }

  get dailyAvailable() {
    if (this.missionFilter === 'regular') return [];
    return this.availableMissions.filter(m => m.type === 'DAILY');
  }

  get otherAvailable() {
    if (this.missionFilter === 'daily') return [];
    return this.availableMissions.filter(m => m.type !== 'DAILY');
  }

  getProgressPercentage(userMission: UserMission & { mission?: Mission }): number {
    if (!userMission.id) return 0;
    if (!userMission.mission) return 0;
    
    if (userMission.completed) {
      return 100;
    }
    
    if (this.progressCache.has(userMission.id)) {
      return this.progressCache.get(userMission.id)!;
    }
    
    const percentage = this.missionService.getProgressPercentage(userMission);
    this.progressCache.set(userMission.id, percentage);
    
    return percentage;
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
