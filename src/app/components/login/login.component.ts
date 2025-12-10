import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  loading: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
  }

  async login() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Preencha email e senha.';
      return;
    }

    try {
      this.loading = true;
      this.errorMessage = '';
      await this.authService.login(this.email, this.password);
      this.router.navigate(['/gacha']);
    } catch (error: any) {
      this.errorMessage = error;
    } finally {
      this.loading = false;
    }
  }

  async loginComGoogle() {
    try {
      this.loading = true;
      this.errorMessage = '';
      const result = await this.authService.loginWithGoogle();
      
      if (result.user) {
        const userData = await this.userService.getUser(result.user.uid);
        
        if (!userData || !userData['username']) {
          this.router.navigate(['/completar-perfil']);
        } else {
          this.router.navigate(['/gacha']);
        }
      }
    } catch (error: any) {
      this.errorMessage = error;
    } finally {
      this.loading = false;
    }
  }

  irParaRegistrar() {
    this.router.navigate(['/register']);
  }

  recuperarSenha() {
    this.router.navigate(['/recuperar-senha']);
  }

  voltar() {
    this.router.navigate(['']);
  }
}
