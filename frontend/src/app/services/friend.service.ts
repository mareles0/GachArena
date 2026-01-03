import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, or, and, Timestamp } from 'firebase/firestore';
import { db } from '../firebase.config';
import { Friend } from '../models/friend.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class FriendService {

  constructor() { }

  async sendFriendRequest(fromUserId: string, toUserId: string, fromUserName: string, toUserName: string, fromUserPhoto?: string): Promise<string> {
    try {
      const q = query(
        collection(db, 'friends'),
        where('userId', '==', fromUserId),
        where('friendId', '==', toUserId),
        where('status', '==', 'PENDING')
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        throw new Error('Já existe uma solicitação pendente');
      }

      const friendshipCheck = await this.areFriends(fromUserId, toUserId);
      if (friendshipCheck) {
        throw new Error('Vocês já são amigos');
      }

      const payload: any = {
        userId: fromUserId,
        friendId: toUserId,
        friendUsername: toUserName,
        status: 'PENDING',
        createdAt: Timestamp.now()
      };
      if (typeof fromUserPhoto !== 'undefined' && fromUserPhoto !== null && fromUserPhoto !== '') {
        payload.friendPhotoURL = fromUserPhoto;
      }

      const docRef = await addDoc(collection(db, 'friends'), payload);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao enviar solicitação de amizade:', error);
      throw error;
    }
  }

  async getPendingRequests(userId: string): Promise<Friend[]> {
    try {
      const q = query(
        collection(db, 'friends'),
        where('friendId', '==', userId),
        where('status', '==', 'PENDING')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Friend));
    } catch (error) {
      console.error('Erro ao buscar solicitações pendentes:', error);
      return [];
    }
  }

  async acceptFriendRequest(requestId: string): Promise<void> {
    try {
      const docRef = doc(db, 'friends', requestId);
      await updateDoc(docRef, {
        status: 'ACCEPTED'
      });
    } catch (error) {
      console.error('Erro ao aceitar solicitação:', error);
      throw error;
    }
  }

  async rejectFriendRequest(requestId: string): Promise<void> {
    try {
      const docRef = doc(db, 'friends', requestId);
      await updateDoc(docRef, {
        status: 'REJECTED'
      });
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      throw error;
    }
  }

  async getFriends(userId: string): Promise<Friend[]> {
    try {
      const q = query(
        collection(db, 'friends'),
        where('status', '==', 'ACCEPTED')
      );
      const querySnapshot = await getDocs(q);
      
      const allFriends = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Friend));
      
      return allFriends.filter(friend => 
        friend.userId === userId || friend.friendId === userId
      );
    } catch (error) {
      console.error('Erro ao buscar amigos:', error);
      return [];
    }
  }

  async removeFriend(friendshipId: string): Promise<void> {
    try {
      const docRef = doc(db, 'friends', friendshipId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erro ao remover amigo:', error);
      throw error;
    }
  }

  async areFriends(user1Id: string, user2Id: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'friends'),
        where('status', '==', 'ACCEPTED')
      );
      const querySnapshot = await getDocs(q);
      
      const friendships = querySnapshot.docs.map(doc => doc.data() as Friend);
      
      return friendships.some(f => 
        (f.userId === user1Id && f.friendId === user2Id) ||
        (f.userId === user2Id && f.friendId === user1Id)
      );
    } catch (error) {
      console.error('Erro ao verificar amizade:', error);
      return false;
    }
  }

  async searchUsers(searchTerm: string, currentUserId: string): Promise<User[]> {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      
      return users.filter(user => 
        user.id !== currentUserId &&
        user.userType === 'PLAYER' &&
        (user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
         user.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  }
}
