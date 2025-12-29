/**
 * Format utility functions
 */

/**
 * Format date and time in military format: "dd MM yyyy HH mm"
 * Example: "15 01 2024 14 30" (15 January 2024, 2:30 PM)
 */
export function formatDateTimeMilitary(dateString?: string | Date | null, includeTime: boolean = true): string {
  if (!dateString) return 'N/A';
  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    if (includeTime) {
      return `${day} ${month} ${year} ${hours} ${minutes}`;
    } else {
      return `${day} ${month} ${year}`;
    }
  } catch {
    return 'N/A';
  }
}

/**
 * Format a date string or Date object in military format: "dd MM yyyy HH mm"

 */
export function formatDate(dateString?: string | Date | null): string {
  return formatDateTimeMilitary(dateString, true);
}

/**
 * Format a number with locale-specific separators (e.g., 1,234.56)
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toLocaleString();
}

/**
 * Format a date in military format without time: "dd MM yyyy"
 * Example: "15 01 2024"
 */
export function formatDateShort(dateString?: string | null): string {
  return formatDateTimeMilitary(dateString, false);
}

