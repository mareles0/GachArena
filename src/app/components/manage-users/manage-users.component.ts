import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-manage-users',
  templateUrl: './manage-users.component.html',
  styleUrls: ['./manage-users.component.scss']
})
export class ManageUsersComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  searchTerm = '';
  isLoading = false;

  notification = { show: false, message: '', type: 'success' };
  showTicketModal = false;
  selectedUser: User | null = null;
  ticketAmount = 0;
  ticketType: 'normal' | 'premium' = 'normal';

  constructor(private userService: UserService) { }

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.isLoading = true;
    try {
      this.users = await this.userService.getAllUsers();
      this.filteredUsers = this.users;
    } catch (error) {
      this.showNotification('Erro ao carregar usuários', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  filterUsers() {
    if (!this.searchTerm) {
      this.filteredUsers = this.users;
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(u =>
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  }

  async toggleBan(user: User) {
    try {
      await this.userService.updateUser(user.id || '', { isBanned: !user.isBanned });
      this.showNotification(user.isBanned ? 'Usuário desbanido' : 'Usuário banido', 'success');
      await this.loadUsers();
      this.filterUsers();
    } catch (error) {
      this.showNotification('Erro ao atualizar usuário', 'error');
    }
  }

  async addTickets(user: User) {
    this.selectedUser = user;
    this.ticketAmount = 0;
    this.ticketType = 'normal';
    this.showTicketModal = true;
  }

  closeTicketModal() {
    this.showTicketModal = false;
    this.selectedUser = null;
    this.ticketAmount = 0;
  }

  async confirmAddTickets() {
    if (!this.selectedUser || this.ticketAmount <= 0) return;

    try {
      await this.userService.addTickets(this.selectedUser.id || '', this.ticketAmount, this.ticketType);
      this.showNotification(`${this.ticketAmount} tickets ${this.ticketType === 'normal' ? 'normais' : 'premium'} adicionados para ${this.selectedUser.username}`, 'success');
      this.closeTicketModal();

      // Pequeno delay para garantir que o Firestore seja atualizado
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.loadUsers();
      this.filterUsers();
    } catch (error) {
      this.showNotification('Erro ao adicionar tickets', 'error');
    }
  }

  showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => this.notification.show = false, 5000); // Aumentado para 5 segundos
  }
}
