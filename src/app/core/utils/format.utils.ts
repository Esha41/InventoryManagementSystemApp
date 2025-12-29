/**
 * Format utility functions
 */

/**
 * Format a date string or Date object to a readable format (e.g., "11 Sept 2024")
 */
export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  } catch {
    return 'N/A';
  }
}

/**
 * Format a number with locale-specific separators (e.g., 1,234.56)
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toLocaleString();
}

/**
 * Format a date to DD/MM/YYYY format
 */
export function formatDateShort(dateString?: string | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return 'N/A';
  }
}

