import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-card',
  templateUrl: './loading-card.component.html',
  styleUrls: ['./loading-card.component.scss']
})
export class LoadingCardComponent {
  @Input() title: string = 'Abrindo caixa...';
  @Input() subtitle: string = 'Preparando seu item especial!';
  @Input() showParticles: boolean = true;
  @Input() showSparkles: boolean = true;

  constructor() { }
}