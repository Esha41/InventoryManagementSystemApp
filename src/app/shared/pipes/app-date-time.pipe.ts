import { Pipe, PipeTransform } from '@angular/core';
import { formatDateTimeExtended } from '@core/utils/format.utils';

@Pipe({
    name: 'appDateTime',
    standalone: true
})
export class AppDateTimePipe implements PipeTransform {
    transform(value: string | Date | undefined | null, fallbackDate?: string | Date | undefined | null): string {
        // Avoid timezone shift for date-only strings like "2026-03-25"
        if (typeof value === 'string') {
            const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) {
                const year = parseInt(m[1], 10);
                const month = parseInt(m[2], 10);
                const day = parseInt(m[3], 10);
                const d = new Date(year, month - 1, day);
                return formatDateTimeExtended(d, fallbackDate);
            }
        }
        return formatDateTimeExtended(value, fallbackDate);
    }
}
