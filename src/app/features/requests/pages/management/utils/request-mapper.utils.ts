/**
 * Requests Management Mapper Utilities
 * Maps backend DTOs to UI models for requests management page
 */

import type { UnifiedListRequestDto } from '@models/unified-list-request.model';
import { Request } from '../models/requests-management.model';
import { formatDate } from '@utils/format.utils';

/**
 * Map unified Request Management list item to Request UI model.
 */
export function mapBaseRequestToRequest(dto: UnifiedListRequestDto): Request {
  // Helper to convert date to string format that pipes can parse
  const dateToString = (date: string | Date | null | undefined): string => {
    if (!date) return '';
    if (date instanceof Date) {
      return date.toISOString();
    }
    return String(date);
  };

  return {
    id: dto.id,
    orderId: `#${dto.requestNo || dto.id.toString().padStart(4, '0')}`,
    // Keep raw date values (Date objects converted to ISO strings, or ISO strings) and let shared pipes handle formatting in the UI
    // requestDate falls back to creationDate if not available
    requestDate: dateToString(dto.requestDate ?? dto.creationDate),
    creationDate: dateToString(dto.creationDate ?? dto.requestDate),
    priority: mapPriority(dto.priority),
    requestType: mapRequestType(dto.requestType),
    status: mapStatus(dto.status),
    isMyTurn: !!dto.isMyTurn
  };
}

/**
 * Format date for display
 */
function _formatRequestDate(date: string | Date | undefined | null): string {
  if (!date) return 'N/A';

  try {
    return formatDate(date as string);
  } catch (_error) {
    return 'N/A';
  }
}

/**
 * Map priority enum to display string
 * RequestPriority enum: Normal = 1, Urgent = 2, VeryUrgent = 3
 * Handles both number and string priority values for robustness
 */
function mapPriority(priority: number | null | undefined): 'Normal' | 'Urgent' | 'VeryUrgent' | 'Very Urgent' | 'Critical' {
  if (priority === null || priority === undefined) {
    return 'Urgent';
  }
  switch (priority) {
    case 1: return 'Normal';
    case 2: return 'Urgent';
    case 3: return 'Very Urgent';
    case 4: return 'Critical';
    default: return 'Urgent';
  }
}

/**
 * Map request type enum to display string
 * RequestType enum: 1=Order, 2=Return, 3=Discard
 * Handles both number and string request types for robustness
 */
function mapRequestType(type: number | null | undefined): 'Order' | 'Return' | 'Discard' {
  if (type === null || type === undefined) {
    return 'Order';
  }
  switch (type) {
    case 2: return 'Return';
    case 3: return 'Discard';
    case 1:
    default:
      return 'Order';
  }
}

/**
 * Map status enum to display string
 * RequestStatus enum: 1=New, 2=UnderProcess, 3=Approved, 4=Rejected, 6=ReturnedForReview
 * Handles both number and string status values for robustness
 */
function mapStatus(
  status: number | null | undefined
): 'New' | 'Pending' | 'Confirmed' | 'Rejected' | 'AutoRejected' | 'Returned' | 'ReturnedForReview' {
  if (status === null || status === undefined) {
    return 'New';
  }
  switch (status) {
    case 1: return 'New';
    case 2: return 'Pending';
    case 3: return 'Confirmed';
    case 4: return 'Rejected';
    case 7: return 'AutoRejected';
    case 6: return 'Returned';
    default: return 'New';
  }
}


