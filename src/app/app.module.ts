import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { UserListComponent } from './components/admin/user-list/user-list.component';
import { ItemFormComponent } from './components/admin/item-form/item-form.component';
import { GachaComponent } from './components/player/gacha/gacha.component';
import { MyItemsComponent } from './components/player/my-items/my-items.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { LoadingComponent } from './components/loading/loading.component';
import { RarityPipe } from './pipes/rarity.pipe';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { RecuperarSenhaComponent } from './components/recuperar-senha/recuperar-senha.component';
import { EmailVerificationComponent } from './components/email-verification/email-verification.component';
import { CompleteProfileComponent } from './components/complete-profile/complete-profile.component';
import { GachaHomeComponent } from './components/player/gacha-home/gacha-home.component';
import { InventoryComponent } from './components/player/inventory/inventory.component';
import { RankingComponent } from './components/player/ranking/ranking.component';
import { FriendsComponent } from './components/player/friends/friends.component';
import { MissionsComponent } from './components/player/missions/missions.component';
import { ManageBoxesComponent } from './components/admin/manage-boxes/manage-boxes.component';
import { ManageItemsComponent } from './components/admin/manage-items/manage-items.component';
import { ManageUsersComponent } from './components/admin/manage-users/manage-users.component';
import { ManageMissionsComponent } from './components/admin/manage-missions/manage-missions.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    UserListComponent,
    ItemFormComponent,
    GachaComponent,
    MyItemsComponent,
    NavbarComponent,
    LoadingComponent,
    RarityPipe,
    WelcomeComponent,
    RecuperarSenhaComponent,
    EmailVerificationComponent,
    CompleteProfileComponent,
    GachaHomeComponent,
    InventoryComponent,
    RankingComponent,
    FriendsComponent,
    MissionsComponent,
    ManageBoxesComponent,
    ManageItemsComponent,
    ManageUsersComponent,
    ManageMissionsComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
