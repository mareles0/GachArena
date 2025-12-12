import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss']
})
export class LoadingComponent implements OnInit {

  @Input() title: string = 'Abrindo caixa...';
  @Input() subtitle: string = 'Preparando seu item especial!';
  @Input() showParticles: boolean = true;
  @Input() showSparkles: boolean = true;

  // Arrays para as animações
  sparkles = [1, 2, 3, 4, 5];
  particles = [1, 2, 3, 4, 5, 6];

  constructor() { }

  ngOnInit(): void {
  }

}
