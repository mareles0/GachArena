import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'rarity'
})
export class RarityPipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }

}
