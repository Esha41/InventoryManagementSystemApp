/**
 * Status Class Utilities
 * CSS class mappings for status badges and indicators
 */
import { mapOrderStatusFromApi } from './status.utils';

const BADGE_CLASS_MAP: Record<string, string> = {
  /** Request just created (`RequestStatusEnum.New`) — aligns with dashboard `new` / `new-issue`. */
  'New': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/25 dark:text-blue-200 dark:border-blue-700/60',
  /** Request in workflow (`UnderProcess`) — aligns with dashboard `on-progress`. */
  'InProgress': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/25 dark:text-yellow-200 dark:border-yellow-700/60',
  'Pending': 'bg-amber-50 text-amber-700 border-amber-200',
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Rejected': 'bg-red-50 text-red-700 border-red-200',
  'AutoRejected': 'bg-red-50 text-red-700 border-red-200',
  'Returned': 'bg-purple-50 text-purple-700 border-purple-200',
  'ReturnedForReview': 'bg-purple-50 text-purple-700 border-purple-200',
  'Cancelled': 'bg-red-50 text-red-700 border-red-200',
};

const APPROVAL_BADGE_CLASS_MAP: Record<string, string> = {
  'Pending': 'text-amber-700 bg-amber-50 border-amber-200',
  'Approved': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Rejected': 'text-red-700 bg-red-50 border-red-200',
  'AutoRejected': 'text-red-700 bg-red-50 border-red-200',
  'Returned': 'text-purple-700 bg-purple-50 border-purple-200',
  'ReturnedForReview': 'text-purple-700 bg-purple-50 border-purple-200',
  'Submitted': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Cancelled': 'text-red-700 bg-red-50 border-red-200',
};


const ORDER_REPORT_STATUS_TRANSLATION_KEY_TO_BADGE: Record<string, string> = {
  'dashboard.statusLabels.new': 'New',
  'dashboard.statusLabels.underProcess': 'InProgress',
  'requestsManagement.orderReport.workflowStatus.completed': 'Approved',
  'dashboard.statusLabels.rejected': 'Rejected',
  'dashboard.statusLabels.autoRejected': 'AutoRejected',
  'dashboard.statusLabels.cancelled': 'Cancelled',
  'dashboard.statusLabels.returnedForReview': 'ReturnedForReview'
};

const ORDER_REPORT_STATUS_BADGE_UNKNOWN =
  'text-[var(--color-text-muted)] bg-[var(--color-background-muted)] border border-[var(--color-border)]';

/**
 * Order / request workflow badge classes from API numeric (or string) status — aligned with sidebar order list.
 */
export function getOrderWorkflowStatusBadgeClassesFromApi(status: number): string {
  const label = mapOrderStatusFromApi(status);
  switch (label) {
    case 'Approved':
      return `${getRequestStatusBadgeClass('Approved')} border`;
    case 'New':
      return `${getRequestStatusBadgeClass('New')} border`;
    case 'In Progress':
      return `${getRequestStatusBadgeClass('InProgress')} border`;
    case 'Auto-Rejected':
      return `${getRequestStatusBadgeClass('AutoRejected')} border`;
    case 'Rejected':
      return `${getRequestStatusBadgeClass('Rejected')} border`;
    case 'Cancelled':
      return `${getRequestStatusBadgeClass('Cancelled')} border`;
    case 'Returned for Review':
      return `${getRequestStatusBadgeClass('ReturnedForReview')} border`;
    default:
      return ORDER_REPORT_STATUS_BADGE_UNKNOWN;
  }
}

/**
 * Badge for Order Information panel: prefers {@link OrderSummary.requestStatusCode}; falls back to exact i18n key map.
 */
export function getOrderSummaryStatusBadgeNgClass(
  requestStatusCode?: number | null,
  statusTranslationKey?: string | null
): string {
  if (typeof requestStatusCode === 'number' && !Number.isNaN(requestStatusCode)) {
    return getOrderWorkflowStatusBadgeClassesFromApi(requestStatusCode);
  }
  const tk = (statusTranslationKey ?? '').trim();
  if (!tk) {
    return ORDER_REPORT_STATUS_BADGE_UNKNOWN;
  }
  let badgeShape = ORDER_REPORT_STATUS_TRANSLATION_KEY_TO_BADGE[tk];
  if (!badgeShape) {
    const lower = tk.toLowerCase();
    const match = Object.keys(ORDER_REPORT_STATUS_TRANSLATION_KEY_TO_BADGE).find(
      k => k.toLowerCase() === lower
    );
    badgeShape = match ? ORDER_REPORT_STATUS_TRANSLATION_KEY_TO_BADGE[match] : '';
  }
  if (badgeShape) {
    return `${getRequestStatusBadgeClass(badgeShape)} border`;
  }
  return ORDER_REPORT_STATUS_BADGE_UNKNOWN;
}

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
