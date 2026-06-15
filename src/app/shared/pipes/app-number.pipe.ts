import { Pipe, PipeTransform } from '@angular/core';
import { formatNumber } from '@core/utils/format.utils';

@Pipe({
  name: 'appNumber',
  standalone: true
})
export class AppNumberPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatNumber(value);
  }
}
