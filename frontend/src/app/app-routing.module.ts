import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { RegisterComponent } from './components/register/register.component';
import { RecuperarSenhaComponent } from './components/recuperar-senha/recuperar-senha.component';
import { EmailVerificationComponent } from './components/email-verification/email-verification.component';
import { CompleteProfileComponent } from './components/complete-profile/complete-profile.component';
import { ProfileComponent } from './components/profile/profile.component';
import { TradesComponent } from './components/trades/trades.component';

import { GachaHomeComponent } from './components/player/gacha-home/gacha-home.component';
import { InventoryComponent } from './components/player/inventory/inventory.component';
import { RankingComponent } from './components/ranking/ranking.component';
import { FriendsComponent } from './components/friends/friends.component';
import { MissionsComponent } from './components/missions/missions.component';

import { ManageBoxesComponent } from './components/admin/manage-boxes/manage-boxes.component';
import { ManageItemsComponent } from './components/admin/manage-items/manage-items.component';
import { ManageUsersComponent } from './components/manage-users/manage-users.component';
import { ManageMissionsComponent } from './components/manage-missions/manage-missions.component';

import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';

const routes: Routes = [
  { path: '', component: WelcomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'recuperar-senha', component: RecuperarSenhaComponent },
  { path: 'verificar-email', component: EmailVerificationComponent },
  { path: 'completar-perfil', component: CompleteProfileComponent },
  
  { path: 'gacha', component: GachaHomeComponent, canActivate: [AuthGuard] },
  { path: 'inventario', component: InventoryComponent, canActivate: [AuthGuard] },
  { path: 'ranking', component: RankingComponent, canActivate: [AuthGuard] },
  { path: 'profile/:id', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'amigos', component: FriendsComponent, canActivate: [AuthGuard] },
  { path: 'trades', component: TradesComponent, canActivate: [AuthGuard] },
  { path: 'missoes', component: MissionsComponent, canActivate: [AuthGuard] },
  
  { path: 'admin/caixas', component: ManageBoxesComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: 'admin/itens', component: ManageItemsComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: 'admin/usuarios', component: ManageUsersComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: 'admin/missoes', component: ManageMissionsComponent, canActivate: [AuthGuard, AdminGuard] }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'enabled'
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }


