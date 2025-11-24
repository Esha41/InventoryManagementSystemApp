/**
 * UI Helper Utilities
 * Functions for UI-related operations like CSS classes, formatting, etc.
 */

import { formatDate } from '@utils/format.utils';

/**
 * Get lot condition CSS classes
 */
export function getLotConditionClass(condition: string): string {
  switch (condition) {
    case 'Near Expiry': return 'bg-red-100 text-red-800 border-red-300';
    case 'Fair': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'Good': return 'bg-green-100 text-green-800 border-green-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Format date for display
 * @deprecated Use formatDate from @utils/format.utils instead
 */
export function formatDateForDisplay(date: Date | string | undefined): string {
  return formatDate(date as string);
}

