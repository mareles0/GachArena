import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ItemService } from './services/item.service';
import { RealtimeService } from './services/realtime.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'GachArena';

  constructor(
    private router: Router,
    private itemService: ItemService,
    private realtimeService: RealtimeService
  ) {
    // Conecta no canal realtime (admin e jogadores se atualizam entre si)
    this.realtimeService.connect();

    // Função global para migração (acessível via console)
    (window as any).migrateItems = async () => {
      console.log('Iniciando migração de itens...');
      try {
        await this.itemService.migrateItemsWithoutPoints(true);
        console.log('Migração de itens base concluída. Iniciando migração de userItems...');
        await this.itemService.migrateUserItemsPoints();
        console.log('Migração concluída com sucesso!');
      } catch (error) {
        console.error('Erro na migração:', error);
      }
    };
  }

  irParaLogin() {
    this.router.navigate(['/login']);
  }
}
