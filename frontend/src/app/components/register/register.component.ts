import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  username: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  errorMessage: string = '';
  loading: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
  }

  async Registrar() {
    
    if (!this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Preencha todos os campos.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'As senhas não coincidem.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
      return;
    }

    try {
      this.loading = true;
      this.errorMessage = '';
      const result = await this.authService.register(this.email, this.password);
      
      if (result.user) {
        await this.userService.saveUser(result.user.uid, {
          uid: result.user.uid,
          username: this.username,
          email: this.email,
          createdAt: new Date().toISOString(),
          userType: 'JOGADOR'
        });
      }
    
      this.router.navigate(['/verificar-email']);
    } catch (error: any) {
      this.errorMessage = error;
    } finally {
      this.loading = false;
    }
  }

  async registrarComGoogle() {
    try {
      this.loading = true;
      this.errorMessage = '';
      await this.authService.loginWithGoogle();
      this.router.navigate(['/completar-perfil']);
    } catch (error: any) {
      this.errorMessage = error;
    } finally {
      this.loading = false;
    }
  }

  voltar() {
    this.router.navigate(['/login']);
  }
}
