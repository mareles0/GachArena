import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Box } from '../models/box.model';
import { EventService } from './event.service';

@Injectable({
  providedIn: 'root'
})
export class BoxService {
  private boxesCache: Box[] | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_DURATION = 30000;

  constructor(private http: HttpClient, private eventService: EventService) {
    this.eventService.events$.subscribe((event) => {
      if (event === 'boxesChanged') {
        this.clearCache();
      }
    });
  }

  private clearCache() {
    this.boxesCache = null;
    this.cacheTimestamp = 0;
  }

  private isCacheValid(): boolean {
    return this.boxesCache !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  async createBox(box: Omit<Box, 'id' | 'createdAt'>): Promise<string> {
    const result = await this.http.post(`${environment.backendUrl}/boxes`, box).toPromise() as any;
    this.clearCache();
    return result.id;
  }

  async getActiveBoxes(): Promise<Box[]> {
    return await this.http.get(`${environment.backendUrl}/boxes/active`).toPromise() as Box[];
  }

  async getBoxesByType(type: 'NORMAL' | 'PREMIUM'): Promise<Box[]> {
    return await this.http.get(`${environment.backendUrl}/boxes/by-type/${type}`).toPromise() as Box[];
  }

  async getAllBoxes(forceRefresh: boolean = false): Promise<Box[]> {
    if (!forceRefresh && this.isCacheValid() && this.boxesCache) {
      return this.boxesCache;
    }
    
    const boxes = await this.http.get(`${environment.backendUrl}/boxes`).toPromise() as Box[];
    this.boxesCache = boxes;
    this.cacheTimestamp = Date.now();
    return boxes;
  }

  async getBoxById(boxId: string): Promise<Box | null> {
    const data = await this.http.get(`${environment.backendUrl}/boxes/${boxId}`).toPromise() as any;
    return data ? { id: boxId, ...data } as Box : null;
  }

  async updateBox(boxId: string, data: Partial<Box>): Promise<void> {
    await this.http.put(`${environment.backendUrl}/boxes/${boxId}`, data).toPromise();
    this.clearCache();
  }

  async deleteBox(boxId: string): Promise<void> {
    await this.http.delete(`${environment.backendUrl}/boxes/${boxId}`).toPromise();
    this.clearCache();
  }
}
