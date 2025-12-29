import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-email-verification',
  templateUrl: './email-verification.component.html',
  styleUrls: ['./email-verification.component.scss']
})
export class EmailVerificationComponent implements OnInit {
  message: string = '';
  errorMessage: string = '';
  userEmail: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (this.authService.currentUser) {
      this.userEmail = this.authService.currentUser.email || '';
    }
  }

  async resendEmail() {
    try {
      this.errorMessage = '';
      const result = await this.authService.resendVerificationEmail();
      this.message = result;
    } catch (error: any) {
      this.errorMessage = error;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
