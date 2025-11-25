/**
 * Status utility functions
 */

/**
 * Approval status types
 */
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

/**
 * Submission status types (numeric mapping)
 */
export enum SubmissionStatus {
  Draft = 0,
  Submitted = 1,
  Approved = 2,
  Rejected = 3
}


/**
 * Get text representation of submission status
 */
export function getSubmissionStatusText(status: number): string {
  switch (status) {
    case SubmissionStatus.Draft:
      return 'Draft';
    case SubmissionStatus.Submitted:
      return 'Submitted';
    case SubmissionStatus.Approved:
      return 'Approved';
    case SubmissionStatus.Rejected:
      return 'Rejected';
    default:
      return 'Unknown';
  }
}

/**
 * Get CSS classes for submission status badge
 */
export function getSubmissionStatusClass(status: number): string {
  switch (status) {
    case SubmissionStatus.Draft:
      return 'bg-gray-100 text-gray-800 border border-gray-300';
    case SubmissionStatus.Submitted:
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    case SubmissionStatus.Approved:
      return 'bg-green-100 text-green-800 border border-green-300';
    case SubmissionStatus.Rejected:
      return 'bg-red-100 text-red-800 border border-red-300';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Request Status Utilities
 * For handling request statuses (Orders, Returns, Discards)
 */

// Request Status values (matching REQUEST_STATUS constants)
const REQUEST_STATUS_NEW = 1;
const REQUEST_STATUS_UNDER_PROCESS = 2;
const REQUEST_STATUS_APPROVED = 3;
const REQUEST_STATUS_REJECTED = 4;
const REQUEST_STATUS_CANCELLED = 5;

export type CardStatus = 'new' | 'on-progress' | 'completed';
export type DisplayableStatus = typeof REQUEST_STATUS_NEW | typeof REQUEST_STATUS_UNDER_PROCESS | typeof REQUEST_STATUS_APPROVED;

/**
 * Check if a request status should be displayed on the dashboard
 * Only shows New, UnderProcess, and Approved statuses
 */
export function isDisplayableRequestStatus(status: number): status is DisplayableStatus {
  return status === REQUEST_STATUS_NEW || 
         status === REQUEST_STATUS_UNDER_PROCESS || 
         status === REQUEST_STATUS_APPROVED;
}

/**
 * Map request status to dashboard card status
 */
export function mapRequestStatusToCardStatus(status: number): CardStatus {
  switch (status) {
    case REQUEST_STATUS_UNDER_PROCESS:
      return 'on-progress';
    case REQUEST_STATUS_APPROVED:
      return 'completed';
    case REQUEST_STATUS_NEW:
    default:
      return 'new';
  }
}

/**
 * Get translation key for request status
 */
export function getRequestStatusTranslationKey(status?: number | null): string {
  switch (status) {
    case REQUEST_STATUS_UNDER_PROCESS:
      return 'dashboard.statusLabels.underProcess';
    case REQUEST_STATUS_APPROVED:
      return 'dashboard.statusLabels.approved';
    case REQUEST_STATUS_REJECTED:
      return 'dashboard.statusLabels.rejected';
    case REQUEST_STATUS_CANCELLED:
      return 'dashboard.statusLabels.cancelled';
    case REQUEST_STATUS_NEW:
    default:
      return 'dashboard.statusLabels.new';
  }
}

/**
 * Order Status Utilities
 * For handling order status mapping
 */

/**
 * Map order status number to string
 */
export function mapOrderStatusToString(status: number): string {
  switch (status) {
    case 0: return 'Pending';
    case 1: return 'Approved';
    case 2: return 'Rejected';
    default: return 'Pending';
  }
}

/**
 * Map order status from API response (handles both string and number)
 */
export function mapOrderStatusFromApi(status: any): string {
  if (status === 'Approved' || status === 'approved') {
    return 'Approved';
  }
  if (status === 'Rejected' || status === 'rejected') {
    return 'Rejected';
  }
  if (status === 'Pending' || status === 'pending') {
    return 'Pending';
  }
  // Handle numeric status
  if (typeof status === 'number') {
    return mapOrderStatusToString(status);
  }
  return 'Pending';
}

