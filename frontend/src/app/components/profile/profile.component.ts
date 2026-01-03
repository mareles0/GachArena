import { Component, OnInit, OnDestroy, ViewChild, ElementRef, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProfileService } from '../../services/profile.service';
import { ItemService } from '../../services/item.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { EventService } from '../../services/event.service';
import { UserProfile } from '../../models/user-profile.model';
import { FriendService } from '../../services/friend.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  userId: string | null = null;
  profile: UserProfile | null = null;
  username: string | null = null;
  iconsByCategory: Record<string, string[]> = {};
  iconsLoaded = false;

  backgrounds: Array<{src:string,type:'image'|'video'|'gif'}> = [];
  backgroundsLoaded = false;
  editing = false;

  isGifUrl(url?: string | null): boolean {
    if (!url) return false;
    return /\.(gif)$/i.test(url);
  }

  showcasedItems: any[] = [];

  loading = false;
  error = '';

  isFriend = false;
  showTradeModal = false;

  isOwner = false;
  level?: number | null = null;
  
  private eventSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private profileService: ProfileService,
    private itemService: ItemService,
    public auth: AuthService,
    private friendService: FriendService,
    private userService: UserService,
    private eventService: EventService
  ) {}

  async ngOnInit(): Promise<void> {
    this.userId = this.route.snapshot.paramMap.get('id') || this.auth.currentUser?.uid || null;
    if (!this.userId) {
      this.error = 'Usuário não encontrado';
      return;
    }

    await this.loadProfile();
    this.iconsByCategory = await this.profileService.listAvailableIconsGrouped();
    this.iconsLoaded = Object.keys(this.iconsByCategory || {}).length > 0;

    this.backgrounds = await this.profileService.listAvailableBackgrounds();
    this.backgroundsLoaded = (this.backgrounds || []).length > 0;

    const me = this.auth.currentUser;
    if (me && this.userId) {
      this.isFriend = await this.friendService.areFriends(me.uid, this.userId);
      this.isOwner = me.uid === this.userId;
    }
    
    this.eventSubscription = this.eventService.events$.subscribe(event => {
      if (event === 'itemsChanged' || event === 'userDataChanged') {
        console.log('[Profile] Evento recebido:', event, '- recarregando perfil');
        this.loadProfile();
      }
    });
  }

  async loadProfile() {
    if (!this.userId) return;
    this.loading = true;
    this.profile = await this.profileService.getProfile(this.userId);
    const userDoc = await this.userService.getUserById(this.userId);
    this.username = userDoc?.username || null;
    console.log('Profile loaded:', { userId: this.userId, showcasedCards: this.profile?.showcasedCards });

    if (this.profile?.showcasedCards && this.profile.showcasedCards.length) {
      try {
        const items = await this.itemService.getUserItems(this.userId);
        this.showcasedItems = items.filter((it: any) => this.profile?.showcasedCards?.includes(it.id));
      } catch (err) {
        console.warn('Erro ao buscar items showcase', err);
      }
    }

    this.loading = false;
  }

  myItemsForShowcase: any[] = [];
  showcasedSelection: Set<string> = new Set();

  modalLoading = false;
  modalCancelRequested = false;

  @ViewChild('descriptionTextarea') descriptionTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('loadingTpl', { static: true }) loadingTpl!: TemplateRef<any>;

  async startEdit() { 
    const me = this.auth.currentUser;
    if (!me || this.userId !== me.uid) return;

    await this.loadProfile();

    this.editing = true;
    this.modalLoading = true;
    this.modalCancelRequested = false;
    let timedOut = false;
    try {
      const timeoutMs = 8000;
      const items: any[] = await Promise.race<any>([
        this.itemService.getUserItems(me.uid),
        new Promise((res) => setTimeout(() => { timedOut = true; res([]); }, timeoutMs))
      ]);

      if (this.modalCancelRequested) return;

      if (timedOut) {
        this.error = 'Tempo de carregamento excedido. Tente novamente.';
        this.myItemsForShowcase = items || [];
      } else {
        this.myItemsForShowcase = items || [];
      }
      console.log('myItemsForShowcase loaded:', { count: this.myItemsForShowcase.length, items: this.myItemsForShowcase.map(i => ({ id: i.id, itemId: i.itemId, name: i.item?.name })) });

      this.showcasedSelection = new Set(this.profile?.showcasedCards || []);
      console.log('showcasedSelection initialized:', { size: this.showcasedSelection.size, items: Array.from(this.showcasedSelection) });
    } catch (err) {
      console.error('Erro ao carregar itens para edição', err);
      this.myItemsForShowcase = [];
      this.error = 'Erro ao carregar cartas. Tente novamente.';
    } finally {
      if (!this.modalCancelRequested) this.modalLoading = false;
    }

    setTimeout(() => {
      try{ this.descriptionTextarea?.nativeElement?.focus(); }catch(e){}
    }, 120);
  }
  cancelEdit() { 
    this.modalCancelRequested = true;
    this.editing = false; 
    this.modalLoading = false; 
    this.error = '';
  }

  async saveEdit() {
    if (!this.userId || !this.profile) return;
    try {
      this.loading = true;
      console.log('saveEdit - showcasedSelection:', { size: this.showcasedSelection.size, items: Array.from(this.showcasedSelection) });
      
      if (this.showcasedSelection && this.showcasedSelection.size > 6) {
        this.error = 'Você só pode destacar até 6 cartas.';
        return;
      }

      if (this.profile) {
        this.profile.showcasedCards = Array.from(this.showcasedSelection || []);
        console.log('saveEdit - profile.showcasedCards updated:', this.profile.showcasedCards);
      }

      await this.profileService.updateProfile(this.userId, this.profile);
      console.log('saveEdit - profile updated in database');
      this.editing = false;
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error('Erro ao salvar perfil', err);
      this.error = 'Erro ao salvar perfil. Tente novamente.';
    } finally {
      this.loading = false;
    }
  }

  selectIcon(path: string) { if (this.profile) this.profile.profileIcon = path; }

  isVideoUrl(url?: string | null): boolean {
    if (!url) return false;
    return /\.(webm|mp4)$/i.test(url);
  }

  toggleShowcase(id: string, checked: boolean) {
    const me = this.auth.currentUser;
    if (!me || this.userId !== me.uid) return;

    console.log('toggleShowcase', { id, checked, currentSize: this.showcasedSelection.size, showcasedCards: this.profile?.showcasedCards });

    if (checked) {
      if (this.showcasedSelection.size >= 6) {
        console.log('Limite atingido:', this.showcasedSelection.size);
        this.error = 'Você pode destacar no máximo 6 cartas.';
        return;
      }
      this.showcasedSelection.add(id);
      console.log('Adicionado:', id, 'Novo tamanho:', this.showcasedSelection.size);
    } else {
      this.showcasedSelection.delete(id);
      console.log('Removido:', id, 'Novo tamanho:', this.showcasedSelection.size);
    }
    this.error = '';
  }

  async sendFriendRequest() {
    const me = this.auth.currentUser;
    if (!me || !this.userId) return;
    try {
      const meDoc = await this.userService.getUserById(me.uid);
      const myName = meDoc?.username || me.email || '';

      const targetDoc = await this.userService.getUserById(this.userId);
      const targetName = targetDoc?.username || '';

      await this.friendService.sendFriendRequest(me.uid, this.userId, myName, targetName, (me as any).profileIcon || me.photoURL || '');
      alert('Solicitação enviada');
      setTimeout(() => window.location.reload(), 800);
    } catch (err:any) {
      console.error('Erro ao enviar solicitação', err);
      alert(err?.message || 'Erro ao enviar solicitação');
    }
  }

  openTrade() { this.showTradeModal = true; }
  closeTrade(result:boolean) { this.showTradeModal = false; if (result) alert('Proposta enviada'); }
  
  ngOnDestroy() {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }
}
