import { Component, OnInit } from '@angular/core';
import { BoxService } from 'src/app/services/box.service';
import { ItemService } from 'src/app/services/item.service';
import { StorageService } from 'src/app/services/storage.service';
import { Box } from 'src/app/models/box.model';
import { Item } from 'src/app/models/item.model';

@Component({
  selector: 'app-manage-items',
  templateUrl: './manage-items.component.html',
  styleUrls: ['./manage-items.component.scss']
})
export class ManageItemsComponent implements OnInit {
  boxes: Box[] = [];
  items: Item[] = [];
  selectedBox: Box | null = null;
  loading: boolean = false;
  showForm: boolean = false;
  editingItem: Item | null = null;

  itemForm = {
    name: '',
    rarity: 'COMUM' as 'COMUM' | 'RARO' | 'EPICO' | 'LENDARIO' | 'MITICO',
    power: 50,
    points: 10,
    dropRate: 1.0,
    imageUrl: ''
  };

  selectedFile: File | null = null;
  uploadingImage: boolean = false;

  // Sistema de notificações
  notification = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  };

  constructor(
    private boxService: BoxService,
    private itemService: ItemService,
    private storageService: StorageService
  ) { }

  async ngOnInit() {
    await this.loadBoxes();
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    this.notification = { show: true, message, type };
    setTimeout(() => {
      this.notification.show = false;
    }, 4000);
  }

  async loadBoxes() {
    this.loading = true;
    try {
      this.boxes = await this.boxService.getAllBoxes();
    } catch (error) {
      console.error('Erro ao carregar caixas:', error);
    } finally {
      this.loading = false;
    }
  }

  async selectBox(box: Box) {
    this.selectedBox = box;
    await this.loadItems();
  }

  async loadItems() {
    if (!this.selectedBox) return;
    
    this.loading = true;
    try {
      this.items = await this.itemService.getItemsByBox(this.selectedBox.id);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      this.loading = false;
    }
  }

  openCreateForm() {
    if (!this.selectedBox) {
      this.showNotification('Selecione uma caixa primeiro', 'error');
      return;
    }

    this.editingItem = null;
    this.itemForm = {
      name: '',
      rarity: 'COMUM',
      power: 50,
      points: 10,
      dropRate: 1.0,
      imageUrl: ''
    };
    this.selectedFile = null;
    this.showForm = true;
  }

  openEditForm(item: Item) {
    this.editingItem = item;
    this.itemForm = {
      name: item.name,
      rarity: item.rarity,
      power: item.power,
      points: item.points || 10,
      dropRate: item.dropRate || 1.0,
      imageUrl: item.imageUrl
    };
    this.selectedFile = null;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.editingItem = null;
    this.selectedFile = null;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.showNotification('Por favor, selecione apenas arquivos de imagem', 'error');
        return;
      }
      this.selectedFile = file;
    }
  }

  async saveItem() {
    if (!this.selectedBox || !this.itemForm.name) {
      this.showNotification('Por favor, preencha todos os campos obrigatórios', 'error');
      return;
    }

    if (!this.itemForm.dropRate || this.itemForm.dropRate <= 0) {
      this.showNotification('Por favor, configure uma Taxa de Drop válida (maior que 0)', 'error');
      return;
    }

    try {
      this.uploadingImage = true;

      let imageUrl = this.itemForm.imageUrl;
      
      if (this.selectedFile) {
        // Se estiver editando e tiver uma imagem antiga, deletar do Storage
        if (this.editingItem && this.editingItem.imageUrl) {
          try {
            await this.storageService.deleteImage(this.editingItem.imageUrl);
            console.log('Imagem antiga deletada do Storage');
          } catch (error) {
            console.warn('Erro ao deletar imagem antiga:', error);
          }
        }
        
        // Upload da nova imagem
        imageUrl = await this.storageService.uploadItemImage(
          this.selectedFile,
          this.itemForm.name,
          this.selectedBox.theme
        );
      }

      const itemData = {
        name: this.itemForm.name,
        rarity: this.itemForm.rarity,
        power: this.itemForm.power,
        points: this.itemForm.points,
        dropRate: this.itemForm.dropRate,
        imageUrl: imageUrl,
        boxId: this.selectedBox.id,
        boxName: this.selectedBox.name,
        theme: this.selectedBox.theme
      };

      if (this.editingItem) {
        await this.itemService.updateItem(this.editingItem.id, itemData);
        this.showNotification('✅ Item atualizado com sucesso!', 'success');
      } else {
        await this.itemService.createItem(itemData);
        this.showNotification('✅ Item criado com sucesso!', 'success');
      }

      this.closeForm();
      await this.loadItems();
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      this.showNotification('❌ Erro ao salvar item: ' + error, 'error');
    } finally {
      this.uploadingImage = false;
    }
  }

  async deleteItem(item: Item) {
    if (!confirm(`Tem certeza que deseja deletar "${item.name}"?`)) {
      return;
    }

    try {
      // Deletar imagem do Storage se existir
      if (item.imageUrl) {
        try {
          await this.storageService.deleteImage(item.imageUrl);
          console.log('Imagem deletada do Storage');
        } catch (error) {
          console.warn('Erro ao deletar imagem:', error);
        }
      }
      
      await this.itemService.deleteItem(item.id);
      this.showNotification('✅ Item deletado com sucesso!', 'success');
      await this.loadItems();
    } catch (error) {
      console.error('Erro ao deletar item:', error);
      this.showNotification('❌ Erro ao deletar item', 'error');
    }
  }

  getRarityClass(rarity: string): string {
    const classes: { [key: string]: string } = {
      'COMUM': 'text-secondary',
      'RARO': 'text-primary',
      'EPICO': 'text-info',
      'LENDARIO': 'text-warning',
      'MITICO': 'text-danger'
    };
    return classes[rarity] || 'text-secondary';
  }

  getRarityColor(rarity: string): string {
    const colors: any = {
      'COMUM': '#9e9e9e',
      'RARO': '#4fc3f7',
      'EPICO': '#ba68c8',
      'LENDARIO': '#ffd54f',
      'MITICO': '#ff6f00'
    };
    return colors[rarity] || '#fff';
  }

  async deleteAllItems() {
    if (!confirm('ATENÇÃO! Isso irá deletar TODOS os itens do banco de dados. Continuar?')) {
      return;
    }

    this.loading = true;
    try {
      await this.itemService.deleteAllItems();
      this.showNotification('✅ Todos os itens foram deletados!', 'success');
      this.items = [];
      await this.loadBoxes();
    } catch (error) {
      console.error('Erro ao deletar itens:', error);
      this.showNotification('❌ Erro ao deletar itens', 'error');
    } finally {
      this.loading = false;
    }
  }

  async migrateItems() {
    try {
      this.loading = true;
      await this.itemService.migrateItemsWithoutPoints(true);
      console.log('Migração de itens base concluída. Migrando userItems...');
      await this.itemService.migrateUserItemsPoints();
      this.showNotification('✅ Migração concluída! Itens atualizados com pontos baseados na raridade.', 'success');
      await this.loadItems();
    } catch (error) {
      console.error('Erro na migração:', error);
      this.showNotification('❌ Erro na migração: ' + error, 'error');
    } finally {
      this.loading = false;
    }
  }
}
