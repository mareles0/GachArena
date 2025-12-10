import { Component, OnInit } from '@angular/core';
import { BoxService } from 'src/app/services/box.service';
import { SeedService } from 'src/app/services/seed.service';
import { Box } from 'src/app/models/box.model';

@Component({
  selector: 'app-manage-boxes',
  templateUrl: './manage-boxes.component.html',
  styleUrls: ['./manage-boxes.component.scss']
})
export class ManageBoxesComponent implements OnInit {
  boxes: Box[] = [];
  loading: boolean = false;
  seeding: boolean = false;

  constructor(
    private boxService: BoxService,
    private seedService: SeedService
  ) { }

  async ngOnInit() {
    await this.loadBoxes();
  }

  async loadBoxes() {
    this.loading = true;
    try {
      this.boxes = await this.boxService.getAllBoxes();
    } catch (error) {
      console.error('Erro ao carregar caixas:', error);
      alert('Erro ao carregar caixas');
    } finally {
      this.loading = false;
    }
  }

  async seedDatabase() {
    if (!confirm('Isso irá popular o banco de dados com caixas e itens de exemplo. Continuar?')) {
      return;
    }

    this.seeding = true;
    try {
      await this.seedService.seedDatabase();
      alert('Banco de dados populado com sucesso!');
      await this.loadBoxes();
    } catch (error) {
      console.error('Erro ao popular banco:', error);
      alert('Erro ao popular banco de dados: ' + error);
    } finally {
      this.seeding = false;
    }
  }

  async toggleBoxStatus(box: Box) {
    try {
      await this.boxService.updateBox(box.id, { active: !box.active });
      await this.loadBoxes();
    } catch (error) {
      console.error('Erro ao atualizar caixa:', error);
      alert('Erro ao atualizar caixa');
    }
  }

  async deleteBox(box: Box) {
    if (!confirm(`Tem certeza que deseja deletar a caixa "${box.name}"?`)) {
      return;
    }

    try {
      await this.boxService.deleteBox(box.id);
      alert('Caixa deletada com sucesso!');
      await this.loadBoxes();
    } catch (error) {
      console.error('Erro ao deletar caixa:', error);
      alert('Erro ao deletar caixa');
    }
  }
}
