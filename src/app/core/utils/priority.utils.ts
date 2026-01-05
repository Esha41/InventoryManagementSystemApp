/**
 * Priority utility functions
 */

/**
 * Priority levels enum
 */
export enum Priority {
  Normal = 1,
  Urgent = 2,
  VeryUrgent = 3,
  Critical = 4
}

/**
 * Priority text mapping
 */
export const PRIORITY_TEXT_MAP: Record<Priority, string> = {
  [Priority.Normal]: 'Normal',
  [Priority.Urgent]: 'Urgent',
  [Priority.VeryUrgent]: 'VeryUrgent',
  [Priority.Critical]: 'Critical'
};

/**
 * Priority CSS class mapping
 */
export const PRIORITY_CLASS_MAP: Record<Priority, string> = {
  [Priority.Normal]: 'text-green-600',
  [Priority.Urgent]: 'text-yellow-600',
  [Priority.VeryUrgent]: 'text-orange-600',
  [Priority.Critical]: 'text-red-600'
};

/**
 * Get text representation of priority
 * Handles both number and string priority values
 */
export function getPriorityText(priority?: number | string | null): string {
  if (priority === null || priority === undefined) return 'Normal';

  // Handle string type
  if (typeof priority === 'string') {
    const priorityLower = priority.toLowerCase().trim();
    if (priorityLower === 'normal' || priorityLower === '1') {
      return PRIORITY_TEXT_MAP[Priority.Normal] || 'Normal';
    }
    if (priorityLower === 'urgent' || priorityLower === '2') {
      return PRIORITY_TEXT_MAP[Priority.Urgent] || 'Urgent';
    }
    if (priorityLower === 'veryurgent' || priorityLower === 'very urgent' || priorityLower === '3') {
      return PRIORITY_TEXT_MAP[Priority.VeryUrgent] || 'VeryUrgent';
    }
    if (priorityLower === 'critical' || priorityLower === '4') {
      return PRIORITY_TEXT_MAP[Priority.Critical] || 'Critical';
    }
    // Try to parse as number
    const parsed = parseInt(priority, 10);
    if (!isNaN(parsed)) {
      return PRIORITY_TEXT_MAP[parsed as Priority] || 'Normal';
    }
    return 'Normal';
  }

  // Handle numeric type
  return PRIORITY_TEXT_MAP[priority as Priority] || 'Normal';
}

/**
 * Get CSS class for priority badge
 * Handles both number and string priority values
 */
export function getPriorityClass(priority?: number | string | null): string {
  if (priority === null || priority === undefined) return 'text-gray-600';

  // Handle string type
  if (typeof priority === 'string') {
    const priorityLower = priority.toLowerCase().trim();
    if (priorityLower === 'normal' || priorityLower === '1') {
      return PRIORITY_CLASS_MAP[Priority.Normal] || 'text-gray-600';
    }
    if (priorityLower === 'urgent' || priorityLower === '2') {
      return PRIORITY_CLASS_MAP[Priority.Urgent] || 'text-gray-600';
    }
    if (priorityLower === 'veryurgent' || priorityLower === 'very urgent' || priorityLower === '3') {
      return PRIORITY_CLASS_MAP[Priority.VeryUrgent] || 'text-gray-600';
    }
    if (priorityLower === 'critical' || priorityLower === '4') {
      return PRIORITY_CLASS_MAP[Priority.Critical] || 'text-gray-600';
    }
    // Try to parse as number
    const parsed = parseInt(priority, 10);
    if (!isNaN(parsed)) {
      return PRIORITY_CLASS_MAP[parsed as Priority] || 'text-gray-600';
    }
    return 'text-gray-600';
  }

  // Handle numeric type
  return PRIORITY_CLASS_MAP[priority as Priority] || 'text-gray-600';
}

/**
 * Check if priority is valid
 */
export function isValidPriority(priority: number): boolean {
  return Object.values(Priority).includes(priority);
}

/**
 * Map order priority number or string to string
 * Handles null, undefined, invalid values, and string types
 */
export function mapOrderPriorityToString(priority: number | string | undefined | null): string {
  // Handle null, undefined
  if (priority === null || priority === undefined) {
    return 'Urgent';
  }

  // Handle string type (case-insensitive)
  if (typeof priority === 'string') {
    const priorityLower = priority.toLowerCase().trim();
    if (priorityLower === 'normal' || priorityLower === '1') {
      return 'Normal';
    }
    if (priorityLower === 'urgent' || priorityLower === '2') {
      return 'Urgent';
    }
    if (priorityLower === 'veryurgent' || priorityLower === 'very urgent' || priorityLower === '3') {
      return 'VeryUrgent';
    }
    if (priorityLower === 'critical' || priorityLower === '4') {
      return 'Critical';
    }
    // Try to parse as number
    const parsed = parseInt(priority, 10);
    if (!isNaN(parsed)) {
      priority = parsed;
    } else {
      return 'Urgent';
    }
  }

  // Handle numeric type
  const priorityNum = Number(priority);
  if (isNaN(priorityNum)) {
    return 'Urgent';
  }

  // Map priority values: 1 = Normal, 2 = Urgent, 3 = VeryUrgent
  switch (priorityNum) {
    case 1: return 'Normal';
    case 2: return 'Urgent';
    case 3: return 'VeryUrgent';
    case 4: return 'Critical';
    default:
      return 'Urgent';
  }
}
