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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public currentUser: User | null = null;

  constructor(private router: Router) {
    onAuthStateChanged(auth, (user) => {
      console.log('[AuthService] Estado de autenticação mudou:', user?.uid);
      this.currentUser = user;
    });
  }

  // Registrar novo usuário
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

  // Login
  async login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      // Verificar se o email foi verificado
      if (result.user && !result.user.emailVerified) {
        await signOut(auth);
        throw 'Por favor, verifique seu email antes de fazer login.';
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

  // Logout
  async logout() {
    await signOut(auth);
    this.currentUser = null;
    this.router.navigate(['/login']);
  }

  // Recuperar senha
  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
      return 'E-mail de recuperação enviado com sucesso!';
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Verificar se está logado
  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  // Reenviar email de verificação
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

  // Verificar se email foi verificado
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

  // Login com Google
  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      this.currentUser = result.user;
      console.log('[AuthService] Login com Google bem-sucedido:', result.user.uid);
      return result;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Tratar erros
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
