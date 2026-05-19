import { formatDateForInput, formatDateShort, formatTimeToMilitary } from '@core/utils/format.utils';

/** i18n key — matches backend: usage date to >= usage date from */
export const USAGE_DATE_TO_ON_OR_AFTER_FROM_KEY =
  'newIssueRequest.validation.usageDateToMustBeOnOrAfterFrom';

/**
 * Normalizes a date string to YYYY-MM-DD (local, no timezone shift for date inputs).
 */
export function normalizeUsageDateYmd(dateStr: string): string | null {
  if (!dateStr?.trim()) return null;
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) return ymdMatch[0];
  const formatted = formatDateForInput(dateStr);
  return formatted || null;
}

/**
 * Combines a date string and military (HHMM) or legacy (HH:mm) time into a Date.
 */
export function combineUsageDateAndTime(dateStr: string, timeStr: string): Date | null {
  const datePart = normalizeUsageDateYmd(dateStr);
  if (!datePart) return null;

  let timePart = '00:00';
  if (timeStr?.trim()) {
    if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
      timePart = `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}`;
    } else if (timeStr.length >= 5 && timeStr.includes(':')) {
      timePart = timeStr.substring(0, 5);
    }
  }

  const parsed = new Date(`${datePart}T${timePart}:00`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export type UsageDateRangeValidation = 'valid' | 'invalid' | 'incomplete';

/**
 * Validates usage end is on or after usage start.
 * - `incomplete`: not enough data to decide (no error shown)
 * - `invalid`: end before start
 * - `valid`
 */
export function validateUsageDateTimeRange(
  dateFrom: string,
  timeFrom: string,
  dateTo: string,
  timeTo: string
): UsageDateRangeValidation {
  const fromYmd = normalizeUsageDateYmd(dateFrom);
  const toYmd = normalizeUsageDateYmd(dateTo);
  if (!fromYmd || !toYmd) return 'incomplete';

  if (toYmd < fromYmd) return 'invalid';
  if (toYmd > fromYmd) return 'valid';

  const hasFromTime = !!timeFrom?.trim();
  const hasToTime = !!timeTo?.trim();
  if (!hasFromTime || !hasToTime) {
    return 'incomplete';
  }

  const start = combineUsageDateAndTime(dateFrom, timeFrom);
  const end = combineUsageDateAndTime(dateTo, timeTo);
  if (!start || !end) return 'incomplete';

  return end >= start ? 'valid' : 'invalid';
}

/**
 * Formats a usage date (YYYY-MM-DD from picker) with a separate military/clock time for display.
 */
export function formatUsageDateAndTime(
  dateVal: string | Date | null | undefined,
  timeVal?: string | null
): string {
  if (dateVal === null || dateVal === undefined || dateVal === '') {
    return '';
  }

  const ymd = typeof dateVal === 'string' ? normalizeUsageDateYmd(dateVal) : null;
  let datePart: string;
  if (ymd) {
    const [, year, month, day] = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
    datePart = day && month && year ? `${day}/${month}/${year}` : formatDateShort(dateVal);
  } else {
    datePart = formatDateShort(dateVal);
  }

  if (!datePart || datePart === 'N/A') {
    return '';
  }

  const timePart = formatTimeToMilitary(timeVal ?? '');
  return timePart ? `${datePart} ${timePart}` : datePart;
}
