/**
 * Status Class Utilities
 * CSS class mappings for status badges and indicators
 */

/**
 * Get CSS classes for request status badge
 */
export function getRequestStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Approved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Rejected':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Returned':
    case 'ReturnedForReview':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-[var(--color-background-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]';
  }
}

/**
 * Get CSS classes for priority badge
 */
export function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'Critical':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'VeryUrgent':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Urgent':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Normal':
      return 'bg-green-50 text-green-700 border-green-200';
    // Legacy support for old priority values
    case 'High':
      return 'bg-orange-50 text-orange-700 border-orange-200';
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
  switch (status) {
    case 'Approved':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'Rejected':
      return 'text-red-700 bg-red-50 border-red-200';
    case 'Returned':
    case 'ReturnedForReview':
      return 'text-purple-700 bg-purple-50 border-purple-200';
    case 'Pending':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'Submitted':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    default:
      return 'text-[var(--color-text-muted)] bg-[var(--color-background-muted)] border-[var(--color-border)]';
  }
}

// Legacy exports for backward compatibility (deprecated - use BadgeClass versions)
export const getRequestStatusClass = getRequestStatusBadgeClass;
export const getPriorityClass = getPriorityBadgeClass;
export const getApprovalStatusClass = getApprovalStatusBadgeClass;

