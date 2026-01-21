import { Pipe, PipeTransform } from '@angular/core';
import { formatDateShort } from '@core/utils/format.utils';

@Pipe({
    name: 'appDate',
    standalone: true
})
export class AppDatePipe implements PipeTransform {
    transform(value: string | Date | undefined | null): string {
        return formatDateShort(value);
    }
}
