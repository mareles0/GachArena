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
  private usersCache: User[] | null = null;
  private userCache: Map<string, User> = new Map();
  private cacheTimestamp: number = 0;
  private CACHE_DURATION = 30000;

  constructor(
    private http: HttpClient,
    private ticketService: TicketService,
    private eventService: EventService
  ) {
    this.eventService.events$.subscribe((event) => {
      if (event === 'userDataChanged' || event === 'ticketsChanged') {
        this.clearCache();
      }
    });
  }

  private clearCache() {
    this.usersCache = null;
    this.userCache.clear();
    this.cacheTimestamp = 0;
  }

  private isCacheValid(): boolean {
    return (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  async saveUser(uid: string, userData: any) {
    try {
      await this.http.post(`${environment.backendUrl}/users/${uid}`, userData).toPromise();
      this.clearCache();
    } catch (error) {
      throw error;
    }
  }

  async getUser(uid: string): Promise<User | null> {
    try {
      return await this.http.get(`${environment.backendUrl}/users/${uid}`).toPromise() as User | null;
    } catch (error) {
      throw error;
    }
  }

  async getUserById(uid: string): Promise<User | null> {
    try {
      const data = await this.http.get(`${environment.backendUrl}/users/${uid}`).toPromise();
      return data ? { id: uid, ...data } as User : null;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }
  }

  async getAllUsers(forceRefresh: boolean = false): Promise<User[]> {
    if (!forceRefresh && this.isCacheValid() && this.usersCache) {
      return this.usersCache;
    }
    
    try {
      const data = await this.http.get(`${environment.backendUrl}/users`).toPromise();
      this.usersCache = data as User[];
      this.cacheTimestamp = Date.now();
      return this.usersCache;
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  }

  async updateUser(uid: string, data: Partial<User>): Promise<void> {
    try {
      await this.http.put(`${environment.backendUrl}/users/${uid}`, data).toPromise();
      this.clearCache();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  async addTickets(uid: string, amount: number, type: 'normal' | 'premium' = 'normal'): Promise<void> {
    try {
      await this.http.post(`${environment.backendUrl}/users/${uid}/tickets`, { amount, type }).toPromise();
      this.clearCache();
    } catch (error) {
      console.error('Erro ao adicionar tickets:', error);
      throw error;
    }
  }

  async getCurrentUserId(): Promise<string | null> {
    return getAuth().currentUser?.uid || null;
  }

  async checkUsernameExists(username: string): Promise<boolean> {
    return false;
  }
}
