import { Injectable } from '@angular/core';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase.config';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor() { }

  // Salvar dados do usuário
  async saveUser(uid: string, userData: any) {
    try {
      await setDoc(doc(db, 'users', uid), userData);
    } catch (error) {
      throw error;
    }
  }

  // Buscar dados do usuário
  async getUser(uid: string) {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  // Buscar usuário por ID retornando User tipado
  async getUserById(uid: string): Promise<User | null> {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as User;
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }
  }

  // Buscar todos os usuários
  async getAllUsers(): Promise<User[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  }

  // Atualizar usuário
  async updateUser(uid: string, data: Partial<User>): Promise<void> {
    try {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  // Adicionar tickets ao usuário
  async addTickets(uid: string, amount: number, type: 'normal' | 'premium' = 'normal'): Promise<void> {
    try {
      console.log(`Adicionando ${amount} tickets ${type} para usuário ${uid}`);
      const docRef = doc(db, 'users', uid);
      const field = type === 'normal' ? 'normalTickets' : 'premiumTickets';

      // Verificar se o documento existe
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log(`Documento existe, atualizando ${field} com +${amount}`);
        await updateDoc(docRef, {
          [field]: increment(amount)
        });
      } else {
        console.log(`Documento não existe, criando com ${field}: ${amount}`);
        const initialData: any = {
          normalTickets: 0,
          premiumTickets: 0
        };
        initialData[field] = amount;
        await setDoc(docRef, initialData);
      }

      console.log(`Tickets adicionados com sucesso para ${uid}`);
    } catch (error) {
      console.error('Erro ao adicionar tickets:', error);
      throw error;
    }
  }

  // Pegar ID do usuário atual
  async getCurrentUserId(): Promise<string | null> {
    return auth.currentUser?.uid || null;
  }

  // Verificar se username já existe
  async checkUsernameExists(username: string): Promise<boolean> {
    // Implementar busca por username na coleção users
    // Por enquanto retorna false
    return false;
  }
}
