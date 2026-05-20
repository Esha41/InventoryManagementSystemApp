/**
 * Status utility functions
 * Uses centralized STATUS_METADATA from request-mapper.utils for single source of truth
 */

import { RequestStatusEnum, getStatusMetadata } from './request-mapper.utils';

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

export type CardStatus = 'new' | 'on-progress' | 'completed' | 'declined' | 'returned' | 'action-required';
export type DisplayableStatus = typeof RequestStatusEnum[keyof typeof RequestStatusEnum];

// Re-export approved constant for backward compatibility
export const REQUEST_STATUS_APPROVED = RequestStatusEnum.Approved;

/**
 * Check if a request status should be displayed on the dashboard
 * Uses centralized metadata for single source of truth
 */
export function isDisplayableRequestStatus(status: number | null | undefined): boolean {
  if (status === null || status === undefined) {
    return false;
  }

  const metadata = getStatusMetadata(status);
  return metadata !== null;
}

/**
 * Map request status to dashboard card status
 * Uses centralized metadata for single source of truth
 */
export function mapRequestStatusToCardStatus(status: number | null | undefined): CardStatus {
  if (status === null || status === undefined) {
    return 'new';
  }

  return getStatusMetadata(status).cardStatus as CardStatus;
}

/**
 * Get translation key for request status
 * Uses centralized metadata for single source of truth
 */
export function getRequestStatusTranslationKey(status?: number | null): string {
  return getStatusMetadata(status).translationKey;
}

/**
 * Order Status Utilities
 * For handling order status mapping
 */

/**
 * Map order status number to string
 * Maps to backend RequestStatus enum: New=1, UnderProcess=2, Approved=3, Rejected=4, AutoRejected=7, Cancelled=5, ReturnedForReview=6
 */
export function mapOrderStatusToString(status: number): string {
  switch (status) {
    case RequestStatusEnum.New:
      return 'New';
    case RequestStatusEnum.UnderProcess:
      return 'In Progress';
    case RequestStatusEnum.Approved:
      return 'Approved';
    case RequestStatusEnum.Rejected:
      return 'Rejected';
    case RequestStatusEnum.AutoRejected:
      return 'Auto-Rejected';
    case RequestStatusEnum.Cancelled:
      return 'Cancelled';
    case RequestStatusEnum.ReturnedForReview:
      return 'Returned for Review';
    default:
      return 'New';
  }
}

/**
 * Map order status from API to standardized string
 * @param status Status value from API (can be number or string)
 * @returns Standardized status string
 */
export function mapOrderStatusFromApi(status: string | number): string {
  if (typeof status === 'number') {
    return mapOrderStatusToString(status);
  }
  if (typeof status === 'string') {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'new') return 'New';
    if (lowerStatus === 'underprocess' || lowerStatus === 'under process') return 'In Progress';
    if (lowerStatus === 'approved') return 'Approved';
    if (lowerStatus === 'rejected') return 'Rejected';
    if (lowerStatus === 'autorejected' || lowerStatus === 'auto rejected' || lowerStatus === 'auto-rejected') return 'Auto-Rejected';
    if (lowerStatus === 'cancelled') return 'Cancelled';
    if (lowerStatus === 'returned' || lowerStatus === 'returnedforreview') return 'Returned for Review';
    if (lowerStatus === 'pending') return 'New';
  }
  return 'New';
}
