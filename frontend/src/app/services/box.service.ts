import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Box } from '../models/box.model';

@Injectable({
  providedIn: 'root'
})
export class BoxService {

  constructor(private http: HttpClient) { }

  async createBox(box: Omit<Box, 'id' | 'createdAt'>): Promise<string> {
    const result = await this.http.post(`${environment.backendUrl}/boxes`, box).toPromise() as any;
    return result.id;
  }

  async getActiveBoxes(): Promise<Box[]> {
    return await this.http.get(`${environment.backendUrl}/boxes/active`).toPromise() as Box[];
  }

  async getBoxesByType(type: 'NORMAL' | 'PREMIUM'): Promise<Box[]> {
    return await this.http.get(`${environment.backendUrl}/boxes/by-type/${type}`).toPromise() as Box[];
  }

  async getAllBoxes(): Promise<Box[]> {
    return await this.http.get(`${environment.backendUrl}/boxes`).toPromise() as Box[];
  }

  async getBoxById(boxId: string): Promise<Box | null> {
    const data = await this.http.get(`${environment.backendUrl}/boxes/${boxId}`).toPromise() as any;
    return data ? { id: boxId, ...data } as Box : null;
  }

  async updateBox(boxId: string, data: Partial<Box>): Promise<void> {
    await this.http.put(`${environment.backendUrl}/boxes/${boxId}`, data).toPromise();
  }

  async deleteBox(boxId: string): Promise<void> {
    await this.http.delete(`${environment.backendUrl}/boxes/${boxId}`).toPromise();
  }
}
