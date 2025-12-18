import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-complete-profile',
  templateUrl: './complete-profile.component.html',
  styleUrls: ['./complete-profile.component.scss']
})
export class CompleteProfileComponent implements OnInit {
  username: string = '';
  errorMessage: string = '';
  loading: boolean = false;
  userEmail: string = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    if (this.authService.currentUser) {
      this.userEmail = this.authService.currentUser.email || '';
    } else {
      // Se não há usuário logado, redireciona para login
      this.router.navigate(['/login']);
    }
  }

  async salvarUsername() {
    if (!this.username || this.username.trim().length < 3) {
      this.errorMessage = 'O username deve ter pelo menos 3 caracteres.';
      return;
    }

    try {
      this.loading = true;
      this.errorMessage = '';

      const user = this.authService.currentUser;
      if (!user) {
        throw 'Nenhum usuário logado.';
      }

      // Salvar dados do usuário no Firestore
      await this.userService.saveUser(user.uid, {
        uid: user.uid,
        username: this.username,
        email: user.email,
        photoURL: (user as any).profileIcon || user.photoURL,
        createdAt: new Date().toISOString(),
        userType: 'JOGADOR'
      });

      // Redirecionar para a página principal
      this.router.navigate(['/']);
    } catch (error: any) {
      this.errorMessage = 'Erro ao salvar username. Tente novamente.';
    } finally {
      this.loading = false;
    }
  }
}
