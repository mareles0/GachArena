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
  
  // Map para armazenar dados calculados de missões diárias (evita recalcular no template)
  dailyMissionData = new Map<string, {
    nextUnclaimedDay: number | null;
    isDayAvailable: boolean;
  }>();
  
  // Map para cachear percentual de progresso (evita recalcular no template)
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

  async ngOnInit() {
    console.log('[Missions] ngOnInit iniciado');
    
    // Escutar eventos do sistema para atualizar automaticamente
    this.eventSubscription = this.eventService.events$.subscribe((event) => {
      console.log('[Missions] Evento recebido:', event);
      if (this.currentUserId && event === 'missionsChanged') {
        console.log('[Missions] Recarregando missões (alteração detectada)...');
        this.queueReloadMissions();
        return;
      }
      if (this.currentUserId && (event === 'boxesOpened' || event === 'itemsChanged' || event === 'tradesChanged' || event === 'userDataChanged')) {
        console.log('[Missions] Atualizando progresso das missões...');
        // Se o componente está ativo, atualizar apenas o progresso
        if (this.userMissions.length > 0) {
          this.updateMissionsProgress();
        }
      }
    });
    
    // Escutar mudanças de autenticação
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
    try {
      const [userMissions, activeMissions] = await Promise.all([
        this.missionService.getUserMissions(this.currentUserId),
        this.missionService.getActiveMissions()
      ]);

      console.log('[Missions] userMissions:', userMissions);
      console.log('[Missions] activeMissions:', activeMissions);

      // Filtrar apenas userMissions que têm uma missão válida (não deletada)
      this.userMissions = (userMissions || []).filter(um => um.mission && um.mission.id);
      
      // Calcular progresso para missões regulares não completadas
      await this.updateMissionsProgress();
      
      const startedMissionIds = this.userMissions.map(um => um.missionId);
      this.availableMissions = (activeMissions || []).filter(m => !startedMissionIds.includes(m.id || ''));

      // Calcular dados das missões diárias (uma vez só)
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
        // Rodar mais uma vez, mas sem empilhar múltiplos reloads
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
        const nextDay = this.calculateNextUnclaimedDay(um);
        const isAvailable = this.calculateDayAvailability(um);
        
        console.log(`[Missions] Missão ${um.id}: nextDay=${nextDay}, isAvailable=${isAvailable}`);
        
        this.dailyMissionData.set(um.id, {
          nextUnclaimedDay: nextDay,
          isDayAvailable: isAvailable
        });
      }
    }
    
    console.log('[Missions] Dados calculados:', this.dailyMissionData.size, 'missões');
  }

  async updateMissionsProgress() {
    console.log('[Missions] updateMissionsProgress iniciado para', this.userMissions.length, 'missões');
    
    // Limpar cache de progresso antes de recalcular
    this.progressCache.clear();
    
    for (const um of this.userMissions) {
      // Apenas calcular para missões regulares não completadas
      if (um.mission?.type !== 'DAILY' && !um.completed && um.mission?.id) {
        console.log('[Missions] Calculando progresso para missão:', um.mission.id, um.mission.title);
        try {
          const progressData = await this.missionService.calculateProgress(this.currentUserId, um.mission.id);
          um.progress = progressData.progress;
          console.log('[Missions] Progresso calculado:', um.mission.id, '=', um.progress, '%');
          
          // Atualizar cache
          if (um.id) {
            this.progressCache.set(um.id, um.progress);
          }
          
          // Se completou, atualizar no backend
          if (progressData.completed && !um.completed && um.id) {
            console.log('[Missions] Missão completada, marcando como concluída:', um.mission.id);
            await this.missionService.completeMission(um.id);
            um.completed = true;
          }
        } catch (error: any) {
          console.error('[Missions] Erro ao calcular progresso da missão:', um.mission?.id, error);
          // Se for 404, a missão não existe mais no backend, setar progresso como 0
          if (error?.status === 404) {
            console.warn('[Missions] Missão não encontrada no backend, setando progresso como 0');
            um.progress = 0;
            if (um.id) {
              this.progressCache.set(um.id, 0);
            }
          }
        }
      } else if (um.id) {
        // Para missões diárias ou já completadas, cachear o progresso atual
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

      // Recompensa é aplicada no backend. Aqui só atualizamos a UI.
      await this.ticketService.refreshTickets(this.currentUserId);

      this.showNotification('Recompensa coletada!', 'success');
      await this.loadMissions();
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
  
  // Getter rápido para usar no template (sem recalcular)
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

      // Recompensa é aplicada no backend. Aqui só atualizamos a UI.
      await this.ticketService.refreshTickets(this.currentUserId);

      this.showNotification(`Dia ${day} coletado!`, 'success');
      await this.loadMissions();
    } catch (err: any) {
      console.error('[Missions] Erro ao coletar dia:', err);
      this.showNotification(err?.message || 'Erro ao coletar dia', 'error');
    }
  }

  calculateDayAvailability(um: UserMission & { mission?: Mission }): boolean {
    if (!um || !um.mission) {
      return false;
    }
    const na = um.nextAvailableAt as any;
    if (!na) {
      return true;
    }
    
    try {
      const naMs = na.seconds ? na.seconds * 1000 : (na.toMillis ? na.toMillis() : Date.parse(na));
      const now = Date.now();
      const available = now >= naMs;
      return available;
    } catch (err) {
      console.error('[Missions] Erro ao processar data', err);
      return true;
    }
  }
  
  // Getter rápido para usar no template (sem recalcular)
  isDayAvailable(um: UserMission & { mission?: Mission }): boolean {
    if (!um.id) return false;
    return this.dailyMissionData.get(um.id)?.isDayAvailable ?? false;
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
    
    // Usar cache se disponível
    if (this.progressCache.has(userMission.id)) {
      return this.progressCache.get(userMission.id)!;
    }
    
    // Se não estiver no cache, calcular e armazenar
    if (!userMission.mission) return 0;
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
