import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { TicketService } from 'src/app/services/ticket.service';
import { Ticket } from 'src/app/models/ticket.model';
import { User } from 'src/app/models/user.model';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  showNavbar: boolean = true;
  lowZ: boolean = false;
  highZ: boolean = false;
  isLoggedIn: boolean = false;
  isAdmin: boolean = false;
  username: string = '';
  photoURL: string = '';
  tickets: Ticket = { normalTickets: 0, premiumTickets: 0 };
  userId: string = '';
  private routerSubscription?: Subscription;
  private ticketsSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private ticketService: TicketService,
    private router: Router
  ) { }

  async ngOnInit() {
    console.log('[Navbar] Inicializando...');
    await this.checkUserStatus();
    
    this.ticketsSubscription = this.ticketService.tickets$.subscribe(tickets => {
      console.log('[Navbar] Tickets atualizados:', tickets);
      this.tickets = tickets;
    });
    
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects || this.router.url;
        console.log('[Navbar] Navegação detectada para', url);
        const hideOn = ['/', '/login', '/register', '/recuperar-senha'];
        const path = url.split('?')[0];
        this.showNavbar = !hideOn.includes(path);
        this.lowZ = path === '/gacha';
        this.highZ = path === '/trades';
        this.checkUserStatus();
      });

    const current = this.router.url.split('?')[0];
    const hideOnInit = ['/', '/login', '/register', '/recuperar-senha'];
    this.showNavbar = !hideOnInit.includes(current);
    this.lowZ = current === '/gacha';
    this.highZ = current === '/trades';
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.ticketsSubscription) {
      this.ticketsSubscription.unsubscribe();
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
      const userData = await this.userService.getUser(user.uid) as User | null;
      console.log('[Navbar] Dados do usuário:', userData);
      
      if (userData) {
        this.username = userData.username || 'Usuário';
        this.photoURL = (userData as any).profileIcon || userData.photoURL || '';
        this.isAdmin = userData.userType === 'ADMINISTRADOR';
        console.log('[Navbar] Username:', this.username, 'IsAdmin:', this.isAdmin);
      }
        await this.ticketService.refreshTickets(this.userId);
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
      console.log('[Navbar] Forçando atualização de tickets para:', this.userId);
      await this.ticketService.refreshTickets(this.userId);
    }
  }

  async logout() {
    await this.authService.logout();
    this.isLoggedIn = false;
    this.isAdmin = false;
    this.router.navigate(['/']);
  }
}
