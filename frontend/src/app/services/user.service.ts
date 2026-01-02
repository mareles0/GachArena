import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { TicketService } from './ticket.service';
import { getAuth } from 'firebase/auth';
import { EventService } from './event.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(
    private http: HttpClient,
    private ticketService: TicketService,
    private eventService: EventService
  ) { }

  // Salvar dados do usuário
  async saveUser(uid: string, userData: any) {
    try {
      await this.http.post(`${environment.backendUrl}/users/${uid}`, userData).toPromise();
      this.eventService.userDataChanged();
    } catch (error) {
      throw error;
    }
  }

  // Buscar dados do usuário
  async getUser(uid: string): Promise<User | null> {
    try {
      return await this.http.get(`${environment.backendUrl}/users/${uid}`).toPromise() as User | null;
    } catch (error) {
      throw error;
    }
  }

  // Buscar usuário por ID retornando User tipado
  async getUserById(uid: string): Promise<User | null> {
    try {
      const data = await this.http.get(`${environment.backendUrl}/users/${uid}`).toPromise();
      return data ? { id: uid, ...data } as User : null;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }
  }

  // Buscar todos os usuários
  async getAllUsers(): Promise<User[]> {
    try {
      const data = await this.http.get(`${environment.backendUrl}/users`).toPromise();
      return data as User[];
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  }

  // Atualizar usuário
  async updateUser(uid: string, data: Partial<User>): Promise<void> {
    try {
      await this.http.put(`${environment.backendUrl}/users/${uid}`, data).toPromise();
      this.eventService.userDataChanged();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  // Adicionar tickets ao usuário
  async addTickets(uid: string, amount: number, type: 'normal' | 'premium' = 'normal'): Promise<void> {
    try {
      await this.http.post(`${environment.backendUrl}/users/${uid}/tickets`, { amount, type }).toPromise();
      this.eventService.ticketsChanged();
      this.eventService.userDataChanged();
    } catch (error) {
      console.error('Erro ao adicionar tickets:', error);
      throw error;
    }
  }

  // Pegar ID do usuário atual
  async getCurrentUserId(): Promise<string | null> {
    return getAuth().currentUser?.uid || null;
  }

  // Verificar se username já existe
  async checkUsernameExists(username: string): Promise<boolean> {
    // Implementar busca por username na coleção users
    // Por enquanto retorna false
    return false;
  }
}
