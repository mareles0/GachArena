import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, Firestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private db: Firestore;

  constructor() {
    const app = initializeApp(environment.firebaseConfig);
    this.db = getFirestore(app);
  }

  // Salvar dados do usuário
  async saveUser(uid: string, userData: any) {
    try {
      await setDoc(doc(this.db, 'users', uid), userData);
    } catch (error) {
      throw error;
    }
  }

  // Buscar dados do usuário
  async getUser(uid: string) {
    try {
      const docRef = doc(this.db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  // Verificar se username já existe
  async checkUsernameExists(username: string): Promise<boolean> {
    // Implementar busca por username na coleção users
    // Por enquanto retorna false
    return false;
  }
}
