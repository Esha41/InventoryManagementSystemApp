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
 * Get CSS classes for approval status badge
 */
export function getApprovalStatusClass(status: string): string {
  switch (status) {
    case 'Approved':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'Rejected':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'Pending':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
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

