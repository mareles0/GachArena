import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  User,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase.config';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public currentUser: User | null = null;

  constructor(
    private router: Router,
    private http: HttpClient
  ) {
    onAuthStateChanged(auth, (user) => {
      console.log('[AuthService] Estado de autenticação mudou:', user?.uid);
      this.currentUser = user;
    });
  }

  async register(email: string, password: string) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        await sendEmailVerification(result.user);
      }
      return result;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Verificar se o email foi verificado
      if (result.user && !result.user.emailVerified) {
        await signOut(auth);
        throw 'Por favor, verifique seu email antes de fazer login.';
      }
      
      // Verificar se o usuário existe no Firestore (banco de dados)
      if (result.user) {
        try {
          await this.http.get(`${environment.backendUrl}/users/${result.user.uid}`).toPromise();
        } catch (error: any) {
          // Se o usuário não existe no Firestore, fazer logout e não permitir login
          await signOut(auth);
          if (error.status === 404) {
            throw 'USER_NOT_REGISTERED';
          }
          throw 'Erro ao verificar dados do usuário. Tente novamente.';
        }
      }
      
      this.currentUser = result.user;
      console.log('[AuthService] Login bem-sucedido:', result.user.uid);
      // Prefetch para acelerar páginas críticas
      this.prefetchUserData(result.user.uid).catch(err => console.warn('[AuthService] Prefetch error:', err));
      return result;
    } catch (error: any) {
      if (typeof error === 'string') {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  async logout() {
    await signOut(auth);
    this.currentUser = null;
    this.router.navigate(['/login']);
  }

  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
      return 'E-mail de recuperação enviado com sucesso!';
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  async resendVerificationEmail() {
    try {
      if (this.currentUser) {
        await sendEmailVerification(this.currentUser);
        return 'E-mail de verificação reenviado com sucesso!';
      }
      throw 'Nenhum usuário logado.';
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  isEmailVerified(): boolean {
    return this.currentUser?.emailVerified || false;
  }

  public async prefetchUserData(userId: string) {
    try {
      console.log('[AuthService] Prefetching data for', userId);
      const p1 = this.http.get(`${environment.backendUrl}/missions`).toPromise().catch(() => null);
      const p2 = this.http.get(`${environment.backendUrl}/userItems/user/${userId}`).toPromise().catch(() => null);
      const p3 = this.http.get(`${environment.backendUrl}/users/${userId}/tickets`).toPromise().catch(() => null);
      const p4 = this.http.get(`${environment.backendUrl}/items?limit=50`).toPromise().catch(() => null);
      await Promise.all([p1, p2, p3, p4]);
      console.log('[AuthService] Prefetch complete');
    } catch (err) {
      console.warn('[AuthService] Prefetch failed', err);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      if (this.currentUser) {
        resolve(this.currentUser);
      } else {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          unsubscribe();
          this.currentUser = user;
          // Prefetch on auth state change (login)
          if (user && user.uid) {
            this.prefetchUserData(user.uid).catch(err => console.warn('[AuthService] Prefetch error:', err));
          }
          resolve(user);
        });
      }
    });
  }

  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Verificar se o usuário existe no Firestore (banco de dados)
      if (result.user) {
        try {
          await this.http.get(`${environment.backendUrl}/users/${result.user.uid}`).toPromise();
        } catch (error: any) {
          // Se o usuário não existe no Firestore, fazer logout e não permitir login
          await signOut(auth);
          if (error.status === 404) {
            throw 'USER_NOT_REGISTERED';
          }
          throw 'Erro ao verificar dados do usuário. Tente novamente.';
        }
      }
      
      this.currentUser = result.user;
      console.log('[AuthService] Login com Google bem-sucedido:', result.user.uid);
      // Prefetch
      this.prefetchUserData(result.user.uid).catch(err => console.warn('[AuthService] Prefetch error:', err));
      return result;
    } catch (error: any) {
      if (typeof error === 'string') {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  async registerWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      this.currentUser = result.user;
      console.log('[AuthService] Registro com Google bem-sucedido:', result.user.uid);
      // Prefetch
      this.prefetchUserData(result.user.uid).catch(err => console.warn('[AuthService] Prefetch error:', err));
      return result;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): string {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Este e-mail já está em uso.';
      case 'auth/invalid-email':
        return 'E-mail inválido.';
      case 'auth/weak-password':
        return 'A senha deve ter pelo menos 6 caracteres.';
      case 'auth/user-not-found':
        return 'Usuário não encontrado.';
      case 'auth/wrong-password':
        return 'Senha incorreta.';
      default:
        return 'Erro ao autenticar. Tente novamente.';
    }
  }
}
