/**
 * Date utility functions
 */

import { formatDateTimeMilitary } from './format.utils';

export class DateUtils {
  /**
   * Format date in military format: "dd MM yyyy"
   */
  static formatDate(date: Date | string): string {
    return formatDateTimeMilitary(date, false);
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
}

/**
 * Format date and time for order display in military format: "dd MM yyyy HH mm"
 * If time string is provided separately, it will be appended (handles military time format HHMM)
 * Example: "15 01 2024 14 30"
 */
export function formatOrderDateTime(date?: string, time?: string): string {
  if (!date) return 'N/A';
  try {
    const formattedDate = formatDateTimeMilitary(date, false);
    
    // If time is provided separately, use it; otherwise use time from date
    if (time) {
      // Handle military time format (HHMM) - add space between hours and minutes
      let formattedTime = time;
      if (time.length === 4 && /^\d{4}$/.test(time)) {
        formattedTime = `${time.substring(0, 2)} ${time.substring(2, 4)}`;
      } else if (time.includes(':')) {
        formattedTime = time.replace(':', ' ');
      }
      return `${formattedDate} ${formattedTime}`;
    } else {
      return formatDateTimeMilitary(date, true);
    }
  } catch {
    return 'N/A';
  }
}

