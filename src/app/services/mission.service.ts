import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, runTransaction } from 'firebase/firestore';
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
      // Avoid persisting an `id` field inside the document body which
      // could later overwrite the Firestore doc id when merging.
      const payload: any = { ...mission };
      if ('id' in payload) delete payload.id;
      payload.createdAt = Timestamp.now();

      const docRef = await addDoc(collection(db, 'missions'), payload);
      console.log('Created mission in Firestore:', docRef.id, payload);
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
        const data = docSnap.data();
        const { id: _id, ...rest } = data as any;
        return { id: docSnap.id, ...rest } as Mission;
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
      const docsInfo = querySnapshot.docs.map(d => ({ id: d.id }));
      console.log('Fetched missions doc ids:', docsInfo);
      return querySnapshot.docs.map(d => {
        const data = d.data();
        const { id: _id, ...rest } = data as any;
        return { id: d.id, ...rest } as Mission;
      });
    } catch (error) {
      console.error('Erro ao buscar missões:', error);
      return [];
    }
  }

  async getActiveMissions(): Promise<Mission[]> {
    try {
      const q = query(collection(db, 'missions'), where('active', '==', true));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => {
        const data = d.data();
        const { id: _id, ...rest } = data as any;
        return { id: d.id, ...rest } as Mission;
      });
    } catch (error) {
      console.error('Erro ao buscar missões ativas:', error);
      return [];
    }
  }

  async updateMission(id: string, mission: Partial<Mission>): Promise<void> {
    try {
      if (!id || typeof id !== 'string' || id.trim() === '' || id.includes('/')) {
        console.error('Invalid mission id provided to updateMission:', id);
        throw new Error('Invalid mission id provided to updateMission');
      }
      const docRef = doc(db, 'missions', id);
      await updateDoc(docRef, mission);
    } catch (error) {
      console.error('Erro ao atualizar missão:', error);
      throw error;
    }
  }

  async deleteMission(id: string): Promise<void> {
    try {
      if (!id || typeof id !== 'string' || id.trim() === '' || id.includes('/')) {
        console.error('Invalid mission id provided to deleteMission:', id);
        throw new Error('Invalid mission id provided to deleteMission');
      }
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
      // Fetch mission to determine if it should auto-complete (e.g., DAILY with no requirement)
      const mission = await this.getMission(missionId);
      const isAutoComplete = mission && mission.type === 'DAILY' && (mission.autoComplete === true || !mission.requirement || mission.requirement.trim() === '');

      const payload: any = {
        userId,
        missionId,
        progress: isAutoComplete ? 100 : 0,
        completed: isAutoComplete ? true : false,
        claimed: isAutoComplete ? true : false,
        claimedDays: [],
        // nextAvailableAt allows first day to be collectible immediately if not autoComplete
        nextAvailableAt: isAutoComplete ? undefined : Timestamp.now(),
        createdAt: Timestamp.now()
      };

      if (isAutoComplete) {
        payload.completedAt = Timestamp.now();
      }

      const docRef = await addDoc(collection(db, 'userMissions'), payload);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao iniciar missão:', error);
      throw error;
    }
  }

  async claimMission(userMissionId: string): Promise<void> {
    try {
      const docRef = doc(db, 'userMissions', userMissionId);
      await updateDoc(docRef, { claimed: true, claimedAt: Timestamp.now() });
    } catch (error) {
      console.error('Erro ao marcar missão como coletada:', error);
      throw error;
    }
  }

  async claimDaily(userMissionId: string, day: number): Promise<void> {
    try {
      const userMissionRef = doc(db, 'userMissions', userMissionId);
      await runTransaction(db, async (tx) => {
        const umSnap = await tx.get(userMissionRef as any);
        if (!umSnap.exists()) throw new Error('UserMission não encontrado');
        const umData: any = umSnap.data();
        const missionId = umData.missionId;
        const mission = await this.getMission(missionId || '');
        const totalDays = (mission && mission.dailyRewards && mission.dailyRewards.length) || 7;
        const claimedDays: number[] = (umData.claimedDays || []).slice();
        if (claimedDays.includes(day)) throw new Error('Dia já coletado');

        // ensure day is the next available unclaimed day (sequential rule)
        const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);
        const nextUnclaimed = allDays.find(d => !claimedDays.includes(d));
        if (nextUnclaimed !== day) throw new Error('Dia não disponível para coleta');

        // check time-based availability
        const nextAvailableTs = umData.nextAvailableAt as any;
        if (nextAvailableTs) {
          const nextAvailableMillis = (nextAvailableTs.seconds ? nextAvailableTs.seconds * 1000 : (nextAvailableTs as any).toMillis());
          if (Date.now() < nextAvailableMillis) throw new Error('Dia ainda não disponível');
        }

        claimedDays.push(day);
        const progress = Math.round((claimedDays.length / totalDays) * 100);

        const updates: any = { claimedDays, progress };
        if (claimedDays.length === totalDays) {
          updates.completed = true;
          updates.completedAt = Timestamp.now();
          updates.claimed = true;
          updates.claimedAt = Timestamp.now();
          updates.nextAvailableAt = undefined;
        } else {
          // set next available to +24h
          updates.nextAvailableAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
        }

        tx.update(userMissionRef as any, updates);
      });
    } catch (error) {
      console.error('Erro ao coletar dia:', error);
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
