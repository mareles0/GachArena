import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit {

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  async ngOnInit() {
    const user = await this.authService.getCurrentUser();
    if (user) {
      this.router.navigate(['/gacha']);
    }
  }

  irParaLogin() {
    this.router.navigate(['/login']);
  }

}
