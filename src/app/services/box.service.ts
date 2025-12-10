import { Injectable } from '@angular/core';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { Box } from '../models/box.model';

@Injectable({
  providedIn: 'root'
})
export class BoxService {
  private db = getFirestore();

  constructor() { }

  async createBox(box: Omit<Box, 'id' | 'createdAt'>): Promise<string> {
    const boxData = {
      ...box,
      createdAt: new Date()
    };
    const docRef = await addDoc(collection(this.db, 'boxes'), boxData);
    return docRef.id;
  }

  async getActiveBoxes(): Promise<Box[]> {
    const q = query(collection(this.db, 'boxes'), where('active', '==', true));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Box));
  }

  async getBoxesByType(type: 'NORMAL' | 'PREMIUM'): Promise<Box[]> {
    const q = query(
      collection(this.db, 'boxes'),
      where('active', '==', true),
      where('type', '==', type)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Box));
  }

  async getAllBoxes(): Promise<Box[]> {
    const querySnapshot = await getDocs(collection(this.db, 'boxes'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Box));
  }

  async getBoxById(boxId: string): Promise<Box | null> {
    const docRef = doc(this.db, 'boxes', boxId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Box;
    }
    return null;
  }

  async updateBox(boxId: string, data: Partial<Box>): Promise<void> {
    const docRef = doc(this.db, 'boxes', boxId);
    await updateDoc(docRef, data);
  }

  async deleteBox(boxId: string): Promise<void> {
    const docRef = doc(this.db, 'boxes', boxId);
    await deleteDoc(docRef);
  }
}
