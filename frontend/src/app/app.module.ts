import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { CacheInterceptor } from './interceptors/cache.interceptor';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { UserListComponent } from './components/admin/user-list/user-list.component';
import { ItemFormComponent } from './components/admin/item-form/item-form.component';
import { GachaComponent } from './components/player/gacha/gacha.component';
import { MyItemsComponent } from './components/player/my-items/my-items.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { RarityPipe } from './pipes/rarity.pipe';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { RecuperarSenhaComponent } from './components/recuperar-senha/recuperar-senha.component';
import { EmailVerificationComponent } from './components/email-verification/email-verification.component';
import { CompleteProfileComponent } from './components/complete-profile/complete-profile.component';
import { ProfileComponent } from './components/profile/profile.component';
import { TradeModalComponent } from './components/trade/trade-modal.component';
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
    ManageMissionsComponent,
    ProfileComponent,
    TradeModalComponent,
    TradesComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    CommonModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CacheInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
