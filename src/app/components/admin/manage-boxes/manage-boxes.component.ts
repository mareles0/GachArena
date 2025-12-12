import { Component, OnInit } from '@angular/core';
import { BoxService } from 'src/app/services/box.service';
import { ItemService } from 'src/app/services/item.service';
import { StorageService } from 'src/app/services/storage.service';
import { Box } from 'src/app/models/box.model';

@Component({
  selector: 'app-manage-boxes',
  templateUrl: './manage-boxes.component.html',
  styleUrls: ['./manage-boxes.component.scss']
})
export class ManageBoxesComponent implements OnInit {
  boxes: Box[] = [];
  loading: boolean = false;
  showForm: boolean = false;
  editingBox: Box | null = null;
  
  boxForm = {
    name: '',
    description: '',
    type: 'NORMAL' as 'NORMAL' | 'PREMIUM',
    theme: '',
    active: true,
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
      this.showNotification('❌ Erro ao carregar caixas', 'error');
    } finally {
      this.loading = false;
    }
  }

  async toggleBoxStatus(box: Box) {
    try {
      await this.boxService.updateBox(box.id, { active: !box.active });
      await this.loadBoxes();
      this.showNotification(`✅ Caixa ${box.active ? 'desativada' : 'ativada'} com sucesso!`, 'success');
    } catch (error) {
      console.error('Erro ao atualizar caixa:', error);
      this.showNotification('❌ Erro ao atualizar caixa', 'error');
    }
  }

  async deleteBox(box: Box) {
    if (!confirm(`Tem certeza que deseja deletar a caixa "${box.name}" e todos os seus itens?`)) {
      return;
    }

    try {
      // Primeiro deletar todos os itens da caixa e suas imagens
      const items = await this.itemService.getItemsByBox(box.id);
      console.log(`Deletando ${items.length} itens da caixa ${box.name}...`);
      
      for (const item of items) {
        // Deletar imagem do item
        if (item.imageUrl) {
          try {
            await this.storageService.deleteImage(item.imageUrl);
          } catch (error) {
            console.warn('Erro ao deletar imagem do item:', error);
          }
        }
        await this.itemService.deleteItem(item.id);
      }
      
      // Deletar imagem da caixa
      if (box.imageUrl) {
        try {
          await this.storageService.deleteImage(box.imageUrl);
        } catch (error) {
          console.warn('Erro ao deletar imagem da caixa:', error);
        }
      }
      
      // Depois deletar a caixa
      await this.boxService.deleteBox(box.id);
      this.showNotification('✅ Caixa e seus itens deletados com sucesso!', 'success');
      await this.loadBoxes();
    } catch (error) {
      console.error('Erro ao deletar caixa:', error);
      this.showNotification('❌ Erro ao deletar caixa', 'error');
    }
  }

  openCreateForm() {
    this.editingBox = null;
    this.boxForm = {
      name: '',
      description: '',
      type: 'NORMAL',
      theme: '',
      active: true,
      imageUrl: ''
    };
    this.selectedFile = null;
    this.showForm = true;
  }

  openEditForm(box: Box) {
    this.editingBox = box;
    this.boxForm = {
      name: box.name,
      description: box.description,
      type: box.type,
      theme: box.theme,
      active: box.active,
      imageUrl: box.imageUrl
    };
    this.selectedFile = null;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.editingBox = null;
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

  async saveBox() {
    if (!this.boxForm.name || !this.boxForm.description || !this.boxForm.theme) {
      this.showNotification('Por favor, preencha todos os campos obrigatórios', 'error');
      return;
    }

    try {
      this.uploadingImage = true;

      let imageUrl = this.boxForm.imageUrl;
      
      if (this.selectedFile) {
        // Se estiver editando e tiver uma imagem antiga, deletar do Storage
        if (this.editingBox && this.editingBox.imageUrl) {
          try {
            await this.storageService.deleteImage(this.editingBox.imageUrl);
            console.log('Imagem antiga deletada do Storage');
          } catch (error) {
            console.warn('Erro ao deletar imagem antiga:', error);
          }
        }
        
        console.log('Iniciando upload da imagem...');
        imageUrl = await this.storageService.uploadBoxImage(
          this.selectedFile, 
          this.boxForm.theme
        );
        console.log('Upload concluído! URL:', imageUrl);
      }

      const boxData = {
        name: this.boxForm.name,
        description: this.boxForm.description,
        type: this.boxForm.type,
        theme: this.boxForm.theme,
        active: this.boxForm.active,
        imageUrl: imageUrl
      };

      console.log('Salvando caixa no Firestore...', boxData);

      if (this.editingBox) {
        await this.boxService.updateBox(this.editingBox.id, boxData);
        this.showNotification('✅ Caixa atualizada com sucesso!', 'success');
      } else {
        await this.boxService.createBox(boxData);
        this.showNotification('✅ Caixa criada com sucesso!', 'success');
      }

      this.closeForm();
      await this.loadBoxes();
    } catch (error) {
      console.error('Erro ao salvar caixa:', error);
      this.showNotification('❌ Erro ao salvar caixa: ' + error, 'error');
    } finally {
      this.uploadingImage = false;
    }
  }
}
