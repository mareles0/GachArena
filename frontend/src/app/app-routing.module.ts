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

// Player Components
import { GachaHomeComponent } from './components/player/gacha-home/gacha-home.component';
import { InventoryComponent } from './components/player/inventory/inventory.component';
import { RankingComponent } from './components/ranking/ranking.component';
import { FriendsComponent } from './components/friends/friends.component';
import { MissionsComponent } from './components/missions/missions.component';

// Admin Components
import { ManageBoxesComponent } from './components/admin/manage-boxes/manage-boxes.component';
import { ManageItemsComponent } from './components/admin/manage-items/manage-items.component';
import { ManageUsersComponent } from './components/manage-users/manage-users.component';
import { ManageMissionsComponent } from './components/manage-missions/manage-missions.component';

const routes: Routes = [
  { path: '', component: WelcomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'recuperar-senha', component: RecuperarSenhaComponent },
  { path: 'verificar-email', component: EmailVerificationComponent },
  { path: 'completar-perfil', component: CompleteProfileComponent },
  
  // Player Routes
  { path: 'gacha', component: GachaHomeComponent },
  { path: 'inventario', component: InventoryComponent },
  { path: 'ranking', component: RankingComponent },
  { path: 'profile/:id', component: ProfileComponent },
  { path: 'amigos', component: FriendsComponent },
  { path: 'trades', component: TradesComponent },
  { path: 'missoes', component: MissionsComponent },
  
  // Admin Routes
  { path: 'admin/caixas', component: ManageBoxesComponent },
  { path: 'admin/itens', component: ManageItemsComponent },
  { path: 'admin/usuarios', component: ManageUsersComponent },
  { path: 'admin/missoes', component: ManageMissionsComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
