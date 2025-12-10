import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { TicketService } from 'src/app/services/ticket.service';
import { Ticket } from 'src/app/models/ticket.model';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isLoggedIn: boolean = false;
  isAdmin: boolean = false;
  username: string = '';
  photoURL: string = '';
  tickets: Ticket = { normalTickets: 0, premiumTickets: 0 };
  userId: string = '';
  private routerSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private ticketService: TicketService,
    private router: Router
  ) { }

  async ngOnInit() {
    console.log('[Navbar] Inicializando...');
    await this.checkUserStatus();
    
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        console.log('[Navbar] Navegação detectada, atualizando status...');
        this.checkUserStatus();
      });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  async checkUserStatus() {
    console.log('[Navbar] Verificando status do usuário...');
    const user = await this.authService.getCurrentUser();
    console.log('[Navbar] Usuário:', user?.uid, user?.email);
    
    if (user) {
      this.isLoggedIn = true;
      this.userId = user.uid;
      console.log('[Navbar] Buscando dados do usuário no Firestore...');
      const userData = await this.userService.getUser(user.uid);
      console.log('[Navbar] Dados do usuário:', userData);
      
      if (userData) {
        this.username = userData.username || userData.displayName || 'Usuário';
        this.photoURL = userData.photoURL || '';
        this.isAdmin = userData.userType === 'ADMINISTRADOR';
        console.log('[Navbar] Username:', this.username, 'IsAdmin:', this.isAdmin);
      }
      await this.loadTickets();
    } else {
      console.log('[Navbar] Nenhum usuário autenticado');
      this.isLoggedIn = false;
      this.isAdmin = false;
      this.username = '';
      this.photoURL = '';
      this.userId = '';
      this.tickets = { normalTickets: 0, premiumTickets: 0 };
    }
  }

  async loadTickets() {
    if (this.userId) {
      console.log('[Navbar] Carregando tickets para:', this.userId);
      this.tickets = await this.ticketService.getUserTickets(this.userId);
      console.log('[Navbar] Tickets carregados:', this.tickets);
    }
  }

  async logout() {
    await this.authService.logout();
    this.isLoggedIn = false;
    this.isAdmin = false;
    this.router.navigate(['/']);
  }
}
