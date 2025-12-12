import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase.config';
import { Mission, UserMission } from '../models/mission.model';

@Injectable({
  providedIn: 'root'
})
export class MissionService {

  constructor() { }

  // CRUD Missões
  async createMission(mission: Omit<Mission, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'missions'), {
        ...mission,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar missão:', error);
      throw error;
    }
  }

  async getMission(id: string): Promise<Mission | null> {
    try {
      const docRef = doc(db, 'missions', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Mission;
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar missão:', error);
      return null;
    }
  }

  async getAllMissions(): Promise<Mission[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'missions'));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission));
    } catch (error) {
      console.error('Erro ao buscar missões:', error);
      return [];
    }
  }

  async getActiveMissions(): Promise<Mission[]> {
    try {
      const q = query(collection(db, 'missions'), where('active', '==', true));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission));
    } catch (error) {
      console.error('Erro ao buscar missões ativas:', error);
      return [];
    }
  }

  async updateMission(id: string, mission: Partial<Mission>): Promise<void> {
    try {
      const docRef = doc(db, 'missions', id);
      await updateDoc(docRef, mission);
    } catch (error) {
      console.error('Erro ao atualizar missão:', error);
      throw error;
    }
  }

  async deleteMission(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'missions', id);
      await deleteDoc(docRef);
      // Deletar todas as UserMissions associadas
      const userMissionsQuery = query(collection(db, 'userMissions'), where('missionId', '==', id));
      const userMissionsSnapshot = await getDocs(userMissionsQuery);
      const deletePromises = userMissionsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Erro ao deletar missão:', error);
      throw error;
    }
  }

  // UserMissions
  async getUserMissions(userId: string): Promise<(UserMission & { mission?: Mission })[]> {
    try {
      const q = query(collection(db, 'userMissions'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const userMissions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserMission));

      // Buscar detalhes da missão
      const missionsWithDetails = await Promise.all(userMissions.map(async (um) => {
        const mission = await this.getMission(um.missionId);
        return { ...um, mission: mission || undefined };
      }));

      return missionsWithDetails;
    } catch (error) {
      console.error('Erro ao buscar missões do usuário:', error);
      return [];
    }
  }

  async startMission(userId: string, missionId: string): Promise<string> {
    try {
      // Verificar se já existe
      const q = query(
        collection(db, 'userMissions'),
        where('userId', '==', userId),
        where('missionId', '==', missionId)
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        return existing.docs[0].id;
      }

      const docRef = await addDoc(collection(db, 'userMissions'), {
        userId,
        missionId,
        progress: 0,
        completed: false,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao iniciar missão:', error);
      throw error;
    }
  }

  async updateProgress(userMissionId: string, progress: number): Promise<void> {
    try {
      const docRef = doc(db, 'userMissions', userMissionId);
      await updateDoc(docRef, { progress });
    } catch (error) {
      console.error('Erro ao atualizar progresso:', error);
      throw error;
    }
  }

  async completeMission(userMissionId: string): Promise<void> {
    try {
      const docRef = doc(db, 'userMissions', userMissionId);
      await updateDoc(docRef, {
        completed: true,
        completedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Erro ao completar missão:', error);
      throw error;
    }
  }
}
