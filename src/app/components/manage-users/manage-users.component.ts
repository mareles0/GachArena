import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { ItemService } from '../../services/item.service';
import { User } from '../../models/user.model';
import { Item, UserItem } from '../../models/item.model';

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

  showRoleModal = false;
  newUserType: 'PLAYER' | 'VIP' | 'ADMINISTRADOR' = 'PLAYER';

  showInventoryModal = false;
  userItems: UserItem[] = [];
  showAddItemModal = false;
  allItems: Item[] = [];
  selectedItemId = '';
  selectedItem: Item | null = null;
  rarityLevel = 1;
  removeQuantities: { [key: string]: number } = {};

  constructor(private userService: UserService, private itemService: ItemService) { }

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

  changeRole(user: User) {
    this.selectedUser = user;
    this.newUserType = user.userType;
    this.showRoleModal = true;
  }

  closeRoleModal() {
    this.showRoleModal = false;
    this.selectedUser = null;
  }

  async confirmChangeRole() {
    if (!this.selectedUser) return;

    try {
      await this.userService.updateUser(this.selectedUser.id || '', { userType: this.newUserType });
      this.showNotification(`Cargo alterado para ${this.newUserType}`, 'success');
      this.closeRoleModal();
      await this.loadUsers();
      this.filterUsers();
    } catch (error) {
      this.showNotification('Erro ao alterar cargo', 'error');
    }
  }

  async viewInventory(user: User) {
    this.selectedUser = user;
    this.showInventoryModal = true;
    try {
      this.userItems = await this.itemService.getUserItems(user.id || '');
    } catch (error) {
      this.showNotification('Erro ao carregar inventário', 'error');
      this.userItems = [];
    }
  }

  closeInventoryModal() {
    this.showInventoryModal = false;
    this.selectedUser = null;
    this.userItems = [];
  }

  async removeItem(userItem: UserItem) {
    if (!this.selectedUser) return;

    const qty = this.removeQuantities[userItem.id] || 1;
    if (qty > userItem.quantity) {
      this.showNotification('Quantidade inválida', 'error');
      return;
    }

    try {
      await this.itemService.removeItemFromUser(userItem.id, qty);
      this.showNotification('Item removido', 'success');
      // Recarregar inventário
      this.userItems = await this.itemService.getUserItems(this.selectedUser.id || '');
    } catch (error) {
      this.showNotification('Erro ao remover item', 'error');
    }
  }

  async openAddItemModal() {
    this.showAddItemModal = true;
    try {
      this.allItems = await this.itemService.getAllItems();
    } catch (error) {
      this.showNotification('Erro ao carregar itens', 'error');
      this.allItems = [];
    }
  }

  closeAddItemModal() {
    this.showAddItemModal = false;
    this.selectedItemId = '';
    this.selectedItem = null;
    this.rarityLevel = 1;
  }

  onItemSelected() {
    this.selectedItem = this.allItems.find(i => i.id === this.selectedItemId) || null;
  }

  async confirmAddItem() {
    if (!this.selectedUser || !this.selectedItemId) return;

    try {
      const rl = (this.selectedItem && (this.selectedItem.rarity === 'LENDARIO' || this.selectedItem.rarity === 'MITICO')) ? this.rarityLevel : undefined;
      await this.itemService.addItemToUser(this.selectedUser.id || '', this.selectedItemId, rl);
      this.showNotification('Item adicionado', 'success');
      this.closeAddItemModal();
      // Recarregar inventário
      this.userItems = await this.itemService.getUserItems(this.selectedUser.id || '');
    } catch (error) {
      this.showNotification('Erro ao adicionar item', 'error');
    }
  }

  showNotification(message: string, type: 'success' | 'error' | 'info') {
    this.notification = { show: true, message, type };
    setTimeout(() => this.notification.show = false, 5000); // Aumentado para 5 segundos
  }
}
