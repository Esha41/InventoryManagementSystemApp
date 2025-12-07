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
 * Handles both number and string priority values
 */
export function getPriorityText(priority?: number | string | null): string {
  if (priority === null || priority === undefined) return 'Low';
  
  // Handle string type
  if (typeof priority === 'string') {
    const priorityLower = priority.toLowerCase().trim();
    if (priorityLower === 'high' || priorityLower === '1') {
      return PRIORITY_TEXT_MAP[Priority.High] || 'High';
    }
    if (priorityLower === 'medium' || priorityLower === '2') {
      return PRIORITY_TEXT_MAP[Priority.Medium] || 'Medium';
    }
    if (priorityLower === 'low' || priorityLower === '3') {
      return PRIORITY_TEXT_MAP[Priority.Low] || 'Low';
    }
    if (priorityLower === 'critical' || priorityLower === '4') {
      return PRIORITY_TEXT_MAP[Priority.Critical] || 'Critical';
    }
    // Try to parse as number
    const parsed = parseInt(priority, 10);
    if (!isNaN(parsed)) {
      return PRIORITY_TEXT_MAP[parsed as Priority] || 'Low';
    }
    return 'Low';
  }
  
  // Handle numeric type
  return PRIORITY_TEXT_MAP[priority as Priority] || 'Low';
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
    if (priorityLower === 'high' || priorityLower === '1') {
      return PRIORITY_CLASS_MAP[Priority.High] || 'text-gray-600';
    }
    if (priorityLower === 'medium' || priorityLower === '2') {
      return PRIORITY_CLASS_MAP[Priority.Medium] || 'text-gray-600';
    }
    if (priorityLower === 'low' || priorityLower === '3') {
      return PRIORITY_CLASS_MAP[Priority.Low] || 'text-gray-600';
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
    return 'Medium';
  }
  
  // Handle string type (case-insensitive)
  if (typeof priority === 'string') {
    const priorityLower = priority.toLowerCase().trim();
    if (priorityLower === 'high' || priorityLower === '1') {
      return 'High';
    }
    if (priorityLower === 'medium' || priorityLower === '2') {
      return 'Medium';
    }
    if (priorityLower === 'low' || priorityLower === '3') {
      return 'Low';
    }
    if (priorityLower === 'critical' || priorityLower === '4') {
      return 'Critical';
    }
    // Try to parse as number
    const parsed = parseInt(priority, 10);
    if (!isNaN(parsed)) {
      priority = parsed;
    } else {
      return 'Medium';
    }
  }
  
  // Handle numeric type
  const priorityNum = Number(priority);
  if (isNaN(priorityNum)) {
    return 'Medium';
  }
  
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

