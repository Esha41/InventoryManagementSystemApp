/**
 * Priority utility functions
 */

/**
 * Priority levels enum
 */
export enum Priority {
  Low = 1,
  Medium = 2,
  High = 3,
  Critical = 4
}

/**
 * Priority text mapping
 */
export const PRIORITY_TEXT_MAP: Record<Priority, string> = {
  [Priority.Low]: 'Low',
  [Priority.Medium]: 'Medium',
  [Priority.High]: 'High',
  [Priority.Critical]: 'Critical'
};

/**
 * Priority CSS class mapping
 */
export const PRIORITY_CLASS_MAP: Record<Priority, string> = {
  [Priority.Low]: 'text-green-600',
  [Priority.Medium]: 'text-yellow-600',
  [Priority.High]: 'text-orange-600',
  [Priority.Critical]: 'text-red-600'
};

/**
 * Get text representation of priority
 */
export function getPriorityText(priority?: number | null): string {
  if (!priority) return 'Low';
  return PRIORITY_TEXT_MAP[priority as Priority] || 'Low';
}

/**
 * Get CSS class for priority badge
 */
export function getPriorityClass(priority?: number | null): string {
  if (!priority) return 'text-gray-600';
  return PRIORITY_CLASS_MAP[priority as Priority] || 'text-gray-600';
}

/**
 * Check if priority is valid
 */
export function isValidPriority(priority: number): boolean {
  return Object.values(Priority).includes(priority);
}

/**
 * Map order priority number to string
 * Handles null, undefined, and invalid values
 */
export function mapOrderPriorityToString(priority: number | undefined | null): string {
  // Handle null, undefined, or invalid values
  if (priority === null || priority === undefined || isNaN(Number(priority))) {
    return 'Medium';
  }
  
  // Convert to number in case it's a string
  const priorityNum = Number(priority);
  
  // Map priority values to match the order creation mapping:
  // 1 = High, 2 = Medium, 3 = Low (from mapPriorityToEnum in new-issue-request.component.ts)
  switch (priorityNum) {
    case 1: return 'High';
    case 2: return 'Medium';
    case 3: return 'Low';
    case 4: return 'Critical';
    default: 
      return 'Medium';
  }
}

