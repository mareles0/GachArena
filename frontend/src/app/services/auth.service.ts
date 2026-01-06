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

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      if (this.currentUser) {
        resolve(this.currentUser);
      } else {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          unsubscribe();
          this.currentUser = user;
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
