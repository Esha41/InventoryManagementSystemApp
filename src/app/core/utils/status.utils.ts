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
const REQUEST_STATUS_RETURNED_FOR_REVIEW = 6;

export type CardStatus = 'new' | 'on-progress' | 'completed' | 'declined' | 'returned';
export type DisplayableStatus = typeof REQUEST_STATUS_NEW | typeof REQUEST_STATUS_UNDER_PROCESS | typeof REQUEST_STATUS_APPROVED | typeof REQUEST_STATUS_REJECTED;

/**
 * Check if a request status should be displayed on the dashboard
 * Shows New, UnderProcess, Approved, and Rejected statuses
 * Handles both number and string status values for robustness
 */
export function isDisplayableRequestStatus(status: number | string | null | undefined): boolean {
  // Handle null/undefined
  if (status === null || status === undefined) {
    return false;
  }

  // Convert to number if it's a string
  let statusNum: number;
  if (typeof status === 'string') {
    // Try to parse string status values
    const lowerStatus = status.toLowerCase().trim();
    if (lowerStatus === 'new' || lowerStatus === 'pending') {
      statusNum = REQUEST_STATUS_NEW;
    } else if (lowerStatus === 'underprocess' || lowerStatus === 'under process' || lowerStatus === 'inprogress' || lowerStatus === 'in progress') {
      statusNum = REQUEST_STATUS_UNDER_PROCESS;
    } else if (lowerStatus === 'approved' || lowerStatus === 'completed') {
      statusNum = REQUEST_STATUS_APPROVED;
    } else if (lowerStatus === 'rejected' || lowerStatus === 'declined') {
      statusNum = REQUEST_STATUS_REJECTED;
    } else if (lowerStatus === 'returned' || lowerStatus === 'returnedforreview') {
      statusNum = REQUEST_STATUS_RETURNED_FOR_REVIEW;
    } else {
      // Try to parse as number
      statusNum = parseInt(status, 10);
      if (isNaN(statusNum)) {
        return false;
      }
    }
  } else {
    statusNum = status;
  }

  return statusNum === REQUEST_STATUS_NEW ||
    statusNum === REQUEST_STATUS_UNDER_PROCESS ||
    statusNum === REQUEST_STATUS_APPROVED ||
    statusNum === REQUEST_STATUS_REJECTED ||
    statusNum === REQUEST_STATUS_RETURNED_FOR_REVIEW;
}

/**
 * Map request status to dashboard card status
 * Handles both number and string status values for robustness
 */
export function mapRequestStatusToCardStatus(status: number | string | null | undefined): CardStatus {
  // Handle null/undefined
  if (status === null || status === undefined) {
    return 'new';
  }

  // Convert to number if it's a string
  let statusNum: number;
  if (typeof status === 'string') {
    // Try to parse string status values
    const lowerStatus = status.toLowerCase().trim();
    if (lowerStatus === 'new' || lowerStatus === 'pending') {
      statusNum = REQUEST_STATUS_NEW;
    } else if (lowerStatus === 'underprocess' || lowerStatus === 'under process' || lowerStatus === 'inprogress' || lowerStatus === 'in progress') {
      statusNum = REQUEST_STATUS_UNDER_PROCESS;
    } else if (lowerStatus === 'approved' || lowerStatus === 'completed') {
      statusNum = REQUEST_STATUS_APPROVED;
    } else if (lowerStatus === 'rejected' || lowerStatus === 'declined') {
      statusNum = REQUEST_STATUS_REJECTED;
    } else if (lowerStatus === 'returned' || lowerStatus === 'returnedforreview') {
      statusNum = REQUEST_STATUS_RETURNED_FOR_REVIEW;
    } else {
      // Try to parse as number
      statusNum = parseInt(status, 10);
      if (isNaN(statusNum)) {
        return 'new'; // Default to 'new' if can't parse
      }
    }
  } else {
    statusNum = status;
  }

  switch (statusNum) {
    case REQUEST_STATUS_UNDER_PROCESS:
      return 'on-progress';
    case REQUEST_STATUS_RETURNED_FOR_REVIEW:
      return 'returned';
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
 * Handles both number and string status values for robustness
 */
export function getRequestStatusTranslationKey(status?: number | string | null): string {
  // Handle null/undefined
  if (status === null || status === undefined) {
    return 'dashboard.statusLabels.new';
  }

  // Convert to number if it's a string
  let statusNum: number;
  if (typeof status === 'string') {
    const lowerStatus = status.toLowerCase().trim();
    if (lowerStatus === 'new' || lowerStatus === 'pending' || lowerStatus === '1') {
      statusNum = REQUEST_STATUS_NEW;
    } else if (lowerStatus === 'underprocess' || lowerStatus === 'under process' || lowerStatus === 'inprogress' || lowerStatus === 'in progress' || lowerStatus === '2') {
      statusNum = REQUEST_STATUS_UNDER_PROCESS;
    } else if (lowerStatus === 'approved' || lowerStatus === 'completed' || lowerStatus === 'confirmed' || lowerStatus === '3') {
      statusNum = REQUEST_STATUS_APPROVED;
    } else if (lowerStatus === 'rejected' || lowerStatus === 'declined' || lowerStatus === '4') {
      statusNum = REQUEST_STATUS_REJECTED;
    } else if (lowerStatus === 'cancelled' || lowerStatus === '5') {
      statusNum = REQUEST_STATUS_CANCELLED;
    } else if (lowerStatus === 'returned' || lowerStatus === 'returnedforreview' || lowerStatus === '6') {
      statusNum = REQUEST_STATUS_RETURNED_FOR_REVIEW;
    } else {
      // Try to parse as number
      statusNum = parseInt(status, 10);
      if (isNaN(statusNum)) {
        return 'dashboard.statusLabels.new'; // Default if can't parse
      }
    }
  } else {
    statusNum = status;
  }

  switch (statusNum) {
    case REQUEST_STATUS_UNDER_PROCESS:
      return 'dashboard.statusLabels.underProcess';
    case REQUEST_STATUS_APPROVED:
      return 'dashboard.statusLabels.approved';
    case REQUEST_STATUS_REJECTED:
      return 'dashboard.statusLabels.rejected';
    case REQUEST_STATUS_CANCELLED:
      return 'dashboard.statusLabels.cancelled';
    case REQUEST_STATUS_RETURNED_FOR_REVIEW:
      return 'dashboard.statusLabels.returnedForReview';
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
    case 6: return 'Returned for Review';
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
    if (lowerStatus === 'returned' || lowerStatus === 'returnedforreview') return 'Returned for Review';
    if (lowerStatus === 'pending') return 'New';
  }
  // Handle numeric status
  if (typeof status === 'number') {
    return mapOrderStatusToString(status);
  }
  return 'New';
}

