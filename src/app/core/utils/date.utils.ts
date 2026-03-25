/**
 * Date utility functions
 */

import { formatTimeToMilitary, formatDateShort } from './format.utils';

export class DateUtils {
  /**
   * Format date to DD/MM/YYYY
   */
  static formatDate(date: Date | string): string {
    const d = date instanceof Date ? date : DateUtils.parseDate(date) ?? new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Parse supported date strings to a local Date object without timezone shifts.
   * - Accepts `YYYY-MM-DD` (and `YYYY-MM-DDTHH:mm:ss...` -> time ignored)
   * - Accepts `DD/MM/YYYY`
   * Returns `undefined` if invalid.
   */
  static parseDate(date: Date | string | undefined | null): Date | undefined {
    if (!date) return undefined;
    if (date instanceof Date) {
      return DateUtils.isValidDate(date) ? date : undefined;
    }

    const trimmed = date.trim();
    if (!trimmed) return undefined;

    // ISO date: YYYY-MM-DD...
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      if (month < 1 || month > 12) return undefined;
      if (day < 1 || day > 31) return undefined;
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return undefined;
      return d;
    }

    // DD/MM/YYYY
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10);
      const year = parseInt(ddmmyyyyMatch[3], 10);
      if (year < 1900) return undefined;
      if (month < 1 || month > 12) return undefined;
      if (day < 1 || day > 31) return undefined;
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return undefined;
      return d;
    }

    return undefined;
  }

  /**
   * Convert supported date input to `YYYY-MM-DD` for the backend.
   */
  static toIsoDate(date: Date | string | undefined | null): string | undefined {
    const d = DateUtils.parseDate(date);
    if (!d) return undefined;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get current date in ISO format
   */
  static getCurrentDate(): string {
    return new Date().toISOString();
  }

  /**
   * Check if date is valid
   */
  static isValidDate(date: any): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Add days to a date
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Get difference in days between two dates
   */
  static getDaysDifference(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Open a native date/datetime picker input.
   * Works across browsers by using `showPicker()` when available.
   */
  static openNativeDatePicker(input: HTMLInputElement | null | undefined): void {
    if (!input) return;
    if (input.showPicker) {
      input.showPicker();
      return;
    }
    input.focus();
  }

  /**
   * Format a date value as `dd/mm/yyyy` for inputs/display.
   * Returns empty string if invalid/empty (so UI can show placeholders).
   */
  static formatDateValue(value?: Date | string | null): string {
    const d = DateUtils.parseDate(value);
    return d ? DateUtils.formatDate(d) : '';
  }

  /**
   * Format `datetime-local` value `YYYY-MM-DDTHH:mm` to:
   * `dd/mm/yyyy hh:mm AM/PM`
   */
  static formatDateTimeValue(value?: string | null): string {
    if (!value) return '';
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match) return value;

    const [, yyyy, mm, dd, hhStr, min] = match;

    const hour24 = parseInt(hhStr, 10);
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = (hour24 % 12) || 12;
    const hour12Str = String(hour12).padStart(2, '0');

    return `${dd}/${mm}/${yyyy} ${hour12Str}:${min} ${ampm}`;
  }
}

/**
 * Format date and time for order display
 * Format: "dd/MM/yyyy · HHmm" (e.g., "15/01/2024 · 1430")
 * Uses military time format (HHmm) for consistency across the application
 */
export function formatOrderDateTime(date?: string, time?: string): string {
  if (!date) return 'N/A';
  try {
    const formattedDate = formatDateShort(date);
    if (formattedDate === 'N/A') return 'N/A';
    const timeStr = time ? formatTimeToMilitary(time) : '';
    return `${formattedDate}${timeStr ? ' · ' + timeStr : ''}`;
  } catch {
    return 'N/A';
  }
}

