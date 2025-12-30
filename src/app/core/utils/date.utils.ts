/**
 * Date utility functions
 */

import { formatTimeToMilitary } from './format.utils';

export class DateUtils {
  /**
   * Format date to DD/MM/YYYY
   */
  static formatDate(date: Date | string): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
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
 * Format date and time for order display
 * Format: "DD Month YYYY · HHmm" (e.g., "15 January 2024 · 1430")
 * Uses military time format (HHmm) for consistency across the application
 */
export function formatOrderDateTime(date?: string, time?: string): string {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const timeStr = time ? formatTimeToMilitary(time) : '';
    return `${day} ${month} ${year}${timeStr ? ' · ' + timeStr : ''}`;
  } catch {
    return date;
  }
}

