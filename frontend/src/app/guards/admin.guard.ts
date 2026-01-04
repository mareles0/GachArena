import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const user = await this.authService.getCurrentUser();
    if (!user) {
      return this.router.createUrlTree(['/login']);
    }

    try {
      const userData = await this.userService.getUser(user.uid);
      const isAdmin = userData?.userType === 'ADMINISTRADOR';
      if (isAdmin) return true;
      return this.router.createUrlTree(['/gacha']);
    } catch {
      return this.router.createUrlTree(['/gacha']);
    }
  }
}
