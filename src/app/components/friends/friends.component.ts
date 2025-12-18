import { Component, OnInit } from '@angular/core';
import { FriendService } from '../../services/friend.service';
import { UserService } from '../../services/user.service';
import { Friend } from '../../models/friend.model';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-friends',
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.scss']
})
export class FriendsComponent implements OnInit {
  friends: Friend[] = [];
  pendingRequests: Friend[] = [];
  searchResults: User[] = [];
  searchTerm = '';
  currentUserId = '';
  currentUserName = '';
  currentUserPhoto = '';
  isLoading = false;

  notification = { show: false, message: '', type: 'success' };

  constructor(
    private friendService: FriendService,
    private userService: UserService
  ) { }

  isVideoUrl(url?: string | null): boolean {
    if (!url) return false;
    return /\.(webm|mp4)$/i.test(url);
  }

  isGifUrl(url?: string | null): boolean {
    if (!url) return false;
    return /\.(gif)$/i.test(url);
  }

  async ngOnInit() {
    this.currentUserId = await this.userService.getCurrentUserId() || '';
    const currentUser = await this.userService.getUserById(this.currentUserId);
    if (currentUser) {
      this.currentUserName = currentUser.username;
      this.currentUserPhoto = (currentUser as any).profileIcon || currentUser.photoURL || '';
    }
    await this.loadFriends();
    await this.loadPendingRequests();
  }

  async loadFriends() {
    // obter raw friendships e enriquecer com dados do outro usuário
    const raw = await this.friendService.getFriends(this.currentUserId);
    const enriched = await Promise.all(raw.map(async (f) => {
      const otherId = f.userId === this.currentUserId ? f.friendId : f.userId;
      const otherUser = otherId ? await this.userService.getUserById(otherId) : null;
      return {
        id: f.id,
        userId: otherId,
        username: otherUser?.username || f.friendUsername || 'Usuário',
        photoURL: (otherUser as any)?.profileIcon || otherUser?.photoURL || f.friendPhotoURL || '',
        profileBackground: (otherUser as any)?.profileBackground || ''
      } as Friend & { username?: string; photoURL?: string; profileBackground?: string };
    }));
    this.friends = enriched;
  }

  async loadPendingRequests() {
    // carregar solicitações pendentes e mostrar o remetente (quem enviou)
    const raws = await this.friendService.getPendingRequests(this.currentUserId);
    const enriched = await Promise.all(raws.map(async (r) => {
      const sender = await this.userService.getUserById(r.userId);
      return {
        id: r.id,
        userId: r.userId,
        username: sender?.username || r.friendUsername || 'Usuário',
        photoURL: (sender as any)?.profileIcon || sender?.photoURL || r.friendPhotoURL || '',
        profileBackground: (sender as any)?.profileBackground || ''
      } as Friend & { username?: string; photoURL?: string; profileBackground?: string };
    }));
    this.pendingRequests = enriched;
  }

  async searchUsers() {
    if (this.searchTerm.length < 2) {
      this.searchResults = [];
      return;
    }
    this.searchResults = await this.friendService.searchUsers(this.searchTerm, this.currentUserId);
  }

  async sendRequest(user: User) {
    try {
      await this.friendService.sendFriendRequest(this.currentUserId, user.id || '', this.currentUserName, user.username, this.currentUserPhoto);
      this.showNotification('Solicitação enviada!', 'success');
      this.searchResults = [];
      this.searchTerm = '';
    } catch (error: any) {
      this.showNotification(error.message || 'Erro ao enviar solicitação', 'error');
    }
  }

  async acceptRequest(requestId: string) {
    try {
      await this.friendService.acceptFriendRequest(requestId);
      this.showNotification('Amizade aceita!', 'success');
      await this.loadFriends();
      await this.loadPendingRequests();
    } catch (error) {
      this.showNotification('Erro ao aceitar solicitação', 'error');
    }
  }

  async rejectRequest(requestId: string) {
    try {
      await this.friendService.rejectFriendRequest(requestId);
      this.showNotification('Solicitação rejeitada', 'info');
      await this.loadPendingRequests();
    } catch (error) {
      this.showNotification('Erro ao rejeitar solicitação', 'error');
    }
  }

  async removeFriend(friendshipId: string) {
    if (!confirm('Deseja realmente remover este amigo?')) return;
    try {
      await this.friendService.removeFriend(friendshipId);
      this.showNotification('Amigo removido', 'info');
      await this.loadFriends();
    } catch (error) {
      this.showNotification('Erro ao remover amigo', 'error');
    }
  }

  getFriendName(friend: Friend): string {
    return friend.userId === this.currentUserId ? friend.friendUsername : '';
  }

  showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => this.notification.show = false, 4000);
  }
}
