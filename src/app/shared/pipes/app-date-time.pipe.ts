import { Pipe, PipeTransform } from '@angular/core';
import { formatDateTimeExtended } from '@core/utils/format.utils';

@Pipe({
    name: 'appDateTime',
    standalone: true
})
export class AppDateTimePipe implements PipeTransform {
    transform(value: string | Date | undefined | null, fallbackDate?: string | Date | undefined | null): string {
        return formatDateTimeExtended(value, fallbackDate);
    }
}
