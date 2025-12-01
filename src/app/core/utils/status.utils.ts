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

export type CardStatus = 'new' | 'on-progress' | 'completed' | 'declined';
export type DisplayableStatus = typeof REQUEST_STATUS_NEW | typeof REQUEST_STATUS_UNDER_PROCESS | typeof REQUEST_STATUS_APPROVED | typeof REQUEST_STATUS_REJECTED;

/**
 * Check if a request status should be displayed on the dashboard
 * Shows New, UnderProcess, Approved, and Rejected statuses
 */
export function isDisplayableRequestStatus(status: number): status is DisplayableStatus {
  return status === REQUEST_STATUS_NEW || 
         status === REQUEST_STATUS_UNDER_PROCESS || 
         status === REQUEST_STATUS_APPROVED ||
         status === REQUEST_STATUS_REJECTED;
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
    case REQUEST_STATUS_REJECTED:
      return 'declined';
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
 * Maps to backend RequestStatus enum: New=1, UnderProcess=2, Approved=3, Rejected=4, Cancelled=5
 */
export function mapOrderStatusToString(status: number): string {
  switch (status) {
    case 1: return 'New';
    case 2: return 'Under Process';
    case 3: return 'Approved';
    case 4: return 'Rejected';
    case 5: return 'Cancelled';
    default: return 'New';
  }
}

/**
 * Map order status from API response (handles both string and number)
 * Maps to backend RequestStatus enum: New=1, UnderProcess=2, Approved=3, Rejected=4, Cancelled=5
 */
export function mapOrderStatusFromApi(status: any): string {
  // Handle string status
  if (typeof status === 'string') {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'new') return 'New';
    if (lowerStatus === 'underprocess' || lowerStatus === 'under process') return 'Under Process';
    if (lowerStatus === 'approved') return 'Approved';
    if (lowerStatus === 'rejected') return 'Rejected';
    if (lowerStatus === 'cancelled') return 'Cancelled';
    if (lowerStatus === 'pending') return 'New';
  }
  // Handle numeric status
  if (typeof status === 'number') {
    return mapOrderStatusToString(status);
  }
  return 'New';
}

