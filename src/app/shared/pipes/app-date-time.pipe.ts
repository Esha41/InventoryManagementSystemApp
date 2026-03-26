import { Pipe, PipeTransform } from '@angular/core';
import { formatDateShort, formatDateTimeExtended } from '@core/utils/format.utils';

@Pipe({
    name: 'appDateTime',
    standalone: true
})
export class AppDateTimePipe implements PipeTransform {
    transform(value: string | Date | undefined | null, fallbackDate?: string | Date | undefined | null): string {
        if (value instanceof Date && !isNaN(value.getTime())) {
            if (this.isLocalMidnight(value)) {
                return formatDateShort(value);
            }
        }

        // Avoid timezone shift for date-only strings like "2026-03-25"
        if (typeof value === 'string') {
            const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) {
                const year = parseInt(m[1], 10);
                const month = parseInt(m[2], 10);
                const day = parseInt(m[3], 10);
                const d = new Date(year, month - 1, day);
                return formatDateShort(d);
            }
            // ISO midnight from APIs/Excel (often with Z) — calendar date only, no time
            const isoMid = value.match(
                /^(\d{4})-(\d{2})-(\d{2})(?:T| )(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/
            );
            if (
                isoMid &&
                isoMid[4] === '00' &&
                isoMid[5] === '00' &&
                isoMid[6] === '00'
            ) {
                const year = parseInt(isoMid[1], 10);
                const month = parseInt(isoMid[2], 10);
                const day = parseInt(isoMid[3], 10);
                const d = new Date(year, month - 1, day);
                return formatDateShort(d);
            }
        }
        return formatDateTimeExtended(value, fallbackDate);
    }

    private isLocalMidnight(d: Date): boolean {
        return (
            d.getHours() === 0 &&
            d.getMinutes() === 0 &&
            d.getSeconds() === 0 &&
            d.getMilliseconds() === 0
        );
    }
}
