import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor(private http: HttpClient) { }

  async uploadImage(file: File, path: string): Promise<string> {
    try {
      console.log('[Storage] Uploading image to:', path);
      console.log('[Storage] File:', file.name, file.size, 'bytes');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);

      const response = await this.http.post<{ downloadURL: string }>(`${environment.backendUrl}/storage/upload`, formData).toPromise();
      const downloadURL = response!.downloadURL;

      console.log('[Storage] Download URL:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('[Storage] Erro ao fazer upload:', error);
      throw error;
    }
  }

  async uploadBoxImage(file: File, boxName: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${boxName}_${timestamp}.${file.name.split('.').pop()}`;
    const path = `boxes/${fileName}`;
    return this.uploadImage(file, path);
  }

  async uploadItemImage(file: File, itemName: string, boxName: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${itemName}_${timestamp}.${file.name.split('.').pop()}`;
    const path = `items/${boxName}/${fileName}`;
    return this.uploadImage(file, path);
  }

  async uploadBoxAnimation(file: File, boxName: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${boxName}_animation_${timestamp}.${file.name.split('.').pop()}`;
    const path = `animations/${fileName}`;
    return this.uploadImage(file, path);
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      await this.http.delete(`${environment.backendUrl}/storage/delete`, { body: { imageUrl } }).toPromise();
    } catch (error) {
      console.error('Erro ao deletar imagem:', error);
    }
  }
}
