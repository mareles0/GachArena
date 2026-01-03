import { Component, OnInit, OnDestroy } from '@angular/core';
import { BoxService } from 'src/app/services/box.service';
import { ItemService } from 'src/app/services/item.service';
import { StorageService } from 'src/app/services/storage.service';
import { EventService } from 'src/app/services/event.service';
import { Box } from 'src/app/models/box.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-manage-boxes',
  templateUrl: './manage-boxes.component.html',
  styleUrls: ['./manage-boxes.component.scss']
})
export class ManageBoxesComponent implements OnInit, OnDestroy {
  boxes: Box[] = [];
  loading: boolean = false;
  showForm: boolean = false;
  editingBox: Box | null = null;
  private eventSubscription?: Subscription;
  
  boxForm = {
    name: '',
    description: '',
    type: 'NORMAL' as 'NORMAL' | 'PREMIUM',
    theme: '',
    themeColor: '',
    active: true,
    imageUrl: '',
    openingAnimationType: 'auto' as 'auto' | 'video' | 'gif',
    openingAnimationSrc: ''
  };
  
  selectedFile: File | null = null;
  uploadingImage: boolean = false;

  selectedAnimationFile: File | null = null;
  uploadingAnimation: boolean = false;

  notification = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  };

  constructor(
    private boxService: BoxService,
    private itemService: ItemService,
    private storageService: StorageService,
    private eventService: EventService
  ) { }

  async ngOnInit() {
    await this.loadBoxes();
    
    this.eventSubscription = this.eventService.events$.subscribe((event) => {
      if (event === 'boxesChanged') {
        this.loadBoxes();
      }
    });
  }

  ngOnDestroy() {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
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
      this.showNotification(`✅ Caixa ${box.active ? 'desativada' : 'ativada'} com sucesso!`, 'success');
      setTimeout(() => window.location.reload(), 800);
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
      const items = await this.itemService.getItemsByBox(box.id);
      console.log(`Deletando ${items.length} itens da caixa ${box.name}...`);
      
      for (const item of items) {
        if (item.imageUrl) {
          try {
            await this.storageService.deleteImage(item.imageUrl);
          } catch (error) {
            console.warn('Erro ao deletar imagem do item:', error);
          }
        }
        await this.itemService.deleteItem(item.id);
      }
      
      if (box.imageUrl) {
        try {
          await this.storageService.deleteImage(box.imageUrl);
        } catch (error) {
          console.warn('Erro ao deletar imagem da caixa:', error);
        }
      }
      
      await this.boxService.deleteBox(box.id);
      this.showNotification('✅ Caixa e seus itens deletados com sucesso!', 'success');
      setTimeout(() => window.location.reload(), 800);
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
      themeColor: '',
      active: true,
      imageUrl: '',
      openingAnimationType: 'auto',
      openingAnimationSrc: ''
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
      themeColor: (box as any).themeColor || '',
      active: box.active,
      imageUrl: box.imageUrl,
      openingAnimationType: (box as any).openingAnimationType || 'auto',
      openingAnimationSrc: (box as any).openingAnimationSrc || ''
    };
    this.selectedFile = null;
    this.selectedAnimationFile = null;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.editingBox = null;
    this.selectedFile = null;
    this.selectedAnimationFile = null;
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

  onAnimationFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['video/mp4', 'video/webm', 'image/gif', 'video/avi', 'video/mov'];
      const isValidType = allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.gif');

      if (!isValidType) {
        this.showNotification('Por favor, selecione apenas arquivos de vídeo (MP4, WebM, AVI, MOV) ou GIF', 'error');
        return;
      }

      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        this.showNotification('Arquivo muito grande. Máximo permitido: 50MB', 'error');
        return;
      }

      this.selectedAnimationFile = file;
      this.boxForm.openingAnimationSrc = file.name;
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

      let animationUrl = this.boxForm.openingAnimationSrc;
      
      if (this.selectedAnimationFile) {
        this.uploadingAnimation = true;
        
        if (this.editingBox && (this.editingBox as any).openingAnimationSrc && 
            (this.editingBox as any).openingAnimationSrc.startsWith('https://')) {
          try {
            await this.storageService.deleteImage((this.editingBox as any).openingAnimationSrc);
            console.log('Animação antiga deletada do Storage');
          } catch (error) {
            console.warn('Erro ao deletar animação antiga:', error);
          }
        }
        
        console.log('Iniciando upload da animação...');
        animationUrl = await this.storageService.uploadBoxAnimation(
          this.selectedAnimationFile, 
          this.boxForm.theme
        );
        console.log('Upload da animação concluído! URL:', animationUrl);
      }

      if (this.boxForm.themeColor && !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(this.boxForm.themeColor)) {
        this.showNotification('Formato de cor inválido. Use hex, ex: #b50000', 'error');
        this.uploadingImage = false;
        return;
      }

      const boxData: any = {
        name: this.boxForm.name,
        description: this.boxForm.description,
        type: this.boxForm.type,
        theme: this.boxForm.theme,
        active: this.boxForm.active,
        openingAnimationType: this.boxForm.openingAnimationType
      };

      if (imageUrl) {
        boxData.imageUrl = imageUrl;
      }

      if (this.boxForm.themeColor) {
        boxData.themeColor = this.boxForm.themeColor;
      }

      if (animationUrl) {
        boxData.openingAnimationSrc = animationUrl;
      }

      console.log('Salvando caixa no Firestore...', boxData);

      if (this.editingBox) {
        await this.boxService.updateBox(this.editingBox.id, boxData);
        this.showNotification('✅ Caixa atualizada com sucesso!', 'success');
      } else {
        await this.boxService.createBox(boxData);
        this.showNotification('✅ Caixa criada com sucesso!', 'success');
      }

      this.closeForm();
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error('Erro ao salvar caixa:', error);
      this.showNotification('❌ Erro ao salvar caixa: ' + error, 'error');
    } finally {
      this.uploadingImage = false;
      this.uploadingAnimation = false;
    }
  }
}
