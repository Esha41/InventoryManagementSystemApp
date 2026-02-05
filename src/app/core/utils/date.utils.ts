/**
 * Date utility functions
 */

import { formatTimeToMilitary, formatDateShort } from './format.utils';

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

