/**
 * Format utility functions
 */

/**
 * Format a date string or Date object to DD/MM/YYYY
 * This is the shared, project-wide standard for date-only display.
 */
export function formatDate(dateString?: string | Date | null): string {
  return formatDateShort(dateString);
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
export function formatDateShort(dateString?: string | Date | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return 'N/A';
  }
}

/**
 * Format time to military format (HHmm - 4 digits)
 * Converts various time formats to military time format (e.g., "1430" for 2:30 PM)
 * 
 * Supports input formats:
 * - Military format (HHmm): "1430" -> "1430"
 * - Time with colons (HH:mm:ss or HH:mm): "14:30:00" or "14:30" -> "1430"
 * - Date object: extracts hours and minutes -> "1430"
 * - Empty/null/undefined: returns empty string
 * 
 * @param time - Time value in various formats (string, Date, null, undefined)
 * @returns Time in military format (HHmm) or empty string if invalid
 * 
 * @example
 * formatTimeToMilitary("14:30:00") // returns "1430"
 * formatTimeToMilitary("14:30") // returns "1430"
 * formatTimeToMilitary("1430") // returns "1430"
 * formatTimeToMilitary(new Date(2024, 0, 1, 14, 30)) // returns "1430"
 * formatTimeToMilitary(null) // returns ""
 */
export function formatTimeToMilitary(time?: string | Date | null): string {
  if (!time) return '';

  // If it's already in military format (HHmm - 4 digits)
  if (typeof time === 'string' && time.length === 4 && /^\d{4}$/.test(time)) {
    return time;
  }

  // Handle Date object
  if (time instanceof Date) {
    if (isNaN(time.getTime())) return '';
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    return hours + minutes;
  }

  // Handle string formats
  if (typeof time === 'string') {
    // Check if it's an ISO date string (contains 'T' or is a full date-time string)
    // Examples: "2024-01-15T14:30:00Z", "2024-01-15T14:30:00.000Z", etc.
    if (time.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(time)) {
      try {
        const dateObj = new Date(time);
        if (!isNaN(dateObj.getTime())) {
          const hours = dateObj.getHours().toString().padStart(2, '0');
          const minutes = dateObj.getMinutes().toString().padStart(2, '0');
          return hours + minutes;
        }
      } catch {
        // If Date parsing fails, continue to other string format checks
      }
    }

    // Time with colons (HH:mm:ss or HH:mm) - convert to military
    // Only process if it looks like a time string (not a date string)
    if (time.includes(':') && !time.includes('-') && !time.includes('T')) {
      const parts = time.split(':');
      const hours = parts[0]?.trim().padStart(2, '0') || '00';
      const minutes = parts[1]?.trim().padStart(2, '0') || '00';
      // Validate hours (00-23) and minutes (00-59)
      const hoursNum = parseInt(hours, 10);
      const minutesNum = parseInt(minutes, 10);
      if (hoursNum >= 0 && hoursNum <= 23 && minutesNum >= 0 && minutesNum <= 59) {
        return hours + minutes;
      }
      return '';
    }

    // If it's a valid 4-digit number string, return as-is
    if (/^\d{4}$/.test(time)) {
      return time;
    }
  }

  return '';
}

/**
 * Format date and time to a standard extended format
 * Returns "dd/MM/yyyy HHmm" or "dd/MM/yyyy"
 * Optional fallbackDate used if primary date has 0000 time
 */
export function formatDateTimeExtended(date: string | Date | undefined | null, fallbackDate?: string | Date | undefined | null): string {
  if (!date) return '';

  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    // Format date as dd/MM/yyyy
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    // Format time as HHmm
    let formattedTime = formatTimeToMilitary(d);

    // If time is 0000 (midnight) and we have a fallback date, try using it for time
    if ((!formattedTime || formattedTime === '0000') && fallbackDate) {
      const fallback = fallbackDate instanceof Date ? fallbackDate : new Date(fallbackDate);
      if (!isNaN(fallback.getTime())) {
        const fallbackTime = formatTimeToMilitary(fallback);
        if (fallbackTime && fallbackTime !== '0000') {
          formattedTime = fallbackTime;
        }
      }
    }

    return formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate;
  } catch {
    return '';
  }
}

