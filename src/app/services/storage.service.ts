import { Injectable } from '@angular/core';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  async uploadImage(file: File, path: string): Promise<string> {
    try {
      console.log('[Storage] Uploading image to:', path);
      console.log('[Storage] File:', file.name, file.size, 'bytes');
      const storageRef = ref(storage, path);
      console.log('[Storage] Storage ref created:', storageRef.fullPath);
      const snapshot = await uploadBytes(storageRef, file);
      console.log('[Storage] Upload successful! Snapshot:', snapshot);
      const downloadURL = await getDownloadURL(snapshot.ref);
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

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Erro ao deletar imagem:', error);
    }
  }
}
