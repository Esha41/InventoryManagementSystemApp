import { Pipe, PipeTransform } from '@angular/core';
import { formatDateShort, formatDateTimeExtended } from '@core/utils/format.utils';

@Pipe({
    name: 'appDate',
    standalone: true
})
export class AppDatePipe implements PipeTransform {
    transform(value: string | Date | undefined | null, format: 'short' | 'military' = 'short'): string {
        if (format === 'military') {
            return formatDateTimeExtended(value);
        }
        return formatDateShort(value);
    }
}
