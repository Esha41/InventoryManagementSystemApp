/**
 * Status Class Utilities
 * CSS class mappings for status badges and indicators
 */


const BADGE_CLASS_MAP: Record<string, string> = {
  'Pending': 'bg-amber-50 text-amber-700 border-amber-200',
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Rejected': 'bg-red-50 text-red-700 border-red-200',
  'AutoRejected': 'bg-orange-50 text-orange-700 border-orange-200',
  'Returned': 'bg-purple-50 text-purple-700 border-purple-200',
  'ReturnedForReview': 'bg-purple-50 text-purple-700 border-purple-200',
};

const APPROVAL_BADGE_CLASS_MAP: Record<string, string> = {
  'Pending': 'text-amber-700 bg-amber-50 border-amber-200',
  'Approved': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Rejected': 'text-red-700 bg-red-50 border-red-200',
  'AutoRejected': 'text-orange-700 bg-orange-50 border-orange-200',
  'Returned': 'text-purple-700 bg-purple-50 border-purple-200',
  'ReturnedForReview': 'text-purple-700 bg-purple-50 border-purple-200',
  'Submitted': 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

/**
 * Get CSS classes for request status badge
 */
export function getRequestStatusBadgeClass(status: string): string {
  return BADGE_CLASS_MAP[status] || 'bg-[var(--color-background-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]';
}

/**
 * Get CSS classes for priority badge
 */
export function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'Critical':
    case 'VeryUrgent':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Urgent':
    case 'High':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Normal':
    case 'Medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Low':
      return 'bg-green-50 text-green-700 border-green-200';
    default:
      return 'bg-[var(--color-background-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]';
  }
}

/**
 * Get CSS classes for approval status badge
 */
export function getApprovalStatusBadgeClass(status: string): string {
  return APPROVAL_BADGE_CLASS_MAP[status] || 'text-[var(--color-text-muted)] bg-[var(--color-background-muted)] border-[var(--color-border)]';
}

// Legacy exports for backward compatibility (deprecated - use BadgeClass versions)
export const getRequestStatusClass = getRequestStatusBadgeClass;
export const getPriorityClass = getPriorityBadgeClass;
export const getApprovalStatusClass = getApprovalStatusBadgeClass;
