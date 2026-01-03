import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserService } from './user.service';
import { User } from '../models/user.model';
import { UserProfile } from '../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private iconsIndexPath = 'assets/avatares/index.json';

  constructor(private http: HttpClient, private userService: UserService) {}

  async listAvailableIconsGrouped(): Promise<Record<string, string[]>> {
    try {
      const res: any = await this.http.get(this.iconsIndexPath).toPromise();
      if (!res) return {};
      if (Array.isArray(res)) {
        return { Geral: res };
      }
      return res as Record<string, string[]>;
    } catch (error) {
      console.error('Erro ao listar icons agrupados:', error);
      return {};
    }
  }

  async listAvailableBackgrounds(): Promise<Array<{src:string,type:'image'|'video'|'gif'}>> {
    try {
      const res: any = await this.http.get('assets/backgrounds/index.json').toPromise();
      if (!res) return [];
      let files: string[] = [];
      if (Array.isArray(res)) files = res as string[];
      else files = Object.keys(res).reduce((acc: string[], k: string) => acc.concat((res as any)[k] || []), [] as string[]);

      return files.map(f => ({ src: f, type: /\.(webm|mp4)$/i.test(f) ? 'video' : (/\.(gif)$/i.test(f) ? 'gif' : 'image') }));
    } catch (error) {
      console.error('Erro ao listar backgrounds:', error);
      return [];
    }
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const user = await this.userService.getUserById(userId);
      if (!user) return null;
      const profile: UserProfile = {
        displayName: user.username,
        profileIcon: (user as any).profileIcon || (user as any).photoURL,
        profileBackground: (user as any).profileBackground || '',
        description: (user as any).description || '',
        showcasedCards: (user as any).showcasedCards || []
      };
      return profile;
    } catch (error) {
      console.error('Erro ao obter profile:', error);
      return null;
    }
  }

  async updateProfile(userId: string, profile: Partial<UserProfile>): Promise<void> {
    try {
      const payload: any = {};
      if (typeof profile.profileIcon !== 'undefined') payload.profileIcon = profile.profileIcon;
      if (typeof profile.profileBackground !== 'undefined') payload.profileBackground = profile.profileBackground;
      if (typeof profile.description !== 'undefined') payload.description = profile.description;
      if (typeof profile.showcasedCards !== 'undefined') payload.showcasedCards = profile.showcasedCards;

      if (Object.keys(payload).length === 0) return;

      await this.userService.updateUser(userId, payload);
    } catch (error) {
      console.error('Erro ao atualizar profile:', error);
      throw error;
    }
  }
}
