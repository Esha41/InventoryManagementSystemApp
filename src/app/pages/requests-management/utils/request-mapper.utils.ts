/**
 * Requests Management Mapper Utilities
 * Maps backend DTOs to UI models for requests management page
 */

import { BaseRequestDto } from '@models/workflow-approval.model';
import { Request } from '../models/requests-management.model';
import { formatDate } from '@utils/format.utils';

/**
 * Map BaseRequestDto to Request UI model
 */
export function mapBaseRequestToRequest(dto: BaseRequestDto): Request {
  return {
    id: dto.id,
    orderId: `#${dto.requestNo || dto.id.toString().padStart(4, '0')}`,
    requestDate: formatRequestDate(dto.requestDate),
    creationDate: formatRequestDate(dto.creationDate || dto.requestDate), // Use creationDate if available, fallback to requestDate
    priority: mapPriority(dto.priority),
    requestType: mapRequestType(dto.requestType),
    status: mapStatus(dto.status),
    isMyTurn: !!dto.isMyTurn
  };
}

/**
 * Format date for display
 */
function formatRequestDate(date: string | Date | undefined | null): string {
  if (!date) return 'N/A';

  try {
    return formatDate(date as string);
  } catch (error) {
    return 'N/A';
  }
}

/**
 * Map priority enum to display string
 * RequestPriority enum: High = 1, Medium = 2, Low = 3
 * Handles both number and string priority values for robustness
 */
function mapPriority(priority: number | string | null | undefined): 'High' | 'Medium' | 'Low' | 'Critical' {
  // Handle null/undefined
  if (priority === null || priority === undefined) {
    return 'Low';
  }

  // Convert to number if it's a string
  let priorityNum: number;
  if (typeof priority === 'string') {
    const lowerPriority = priority.toLowerCase().trim();
    if (lowerPriority === 'high' || lowerPriority === '1') {
      priorityNum = 1;
    } else if (lowerPriority === 'medium' || lowerPriority === 'normal' || lowerPriority === '2') {
      priorityNum = 2;
    } else if (lowerPriority === 'low' || lowerPriority === '3') {
      priorityNum = 3;
    } else {
      // Try to parse as number
      priorityNum = parseInt(priority, 10);
      if (isNaN(priorityNum)) {
        return 'Low'; // Default to 'Low' if can't parse
      }
    }
  } else {
    priorityNum = priority;
  }

  switch (priorityNum) {
    case 1: return 'High';
    case 2: return 'Medium';
    case 3: return 'Low';
    default: return 'Low';
  }
}

/**
 * Map request type enum to display string
 * RequestType enum: 1=Order, 2=Return, 3=Discard
 * Handles both number and string request types for robustness
 */
function mapRequestType(type: number | string | null | undefined): 'Order' | 'Return' | 'Discard' {
  // Handle null/undefined
  if (type === null || type === undefined) {
    return 'Order';
  }

  // Convert to number if it's a string
  let typeNum: number;
  if (typeof type === 'string') {
    // Try to parse string request type values
    const lowerType = type.toLowerCase().trim();
    if (lowerType === 'order') {
      typeNum = 1;
    } else if (lowerType === 'return') {
      typeNum = 2;
    } else if (lowerType === 'discard') {
      typeNum = 3;
    } else {
      // Try to parse as number
      typeNum = parseInt(type, 10);
      if (isNaN(typeNum)) {
        return 'Order'; // Default to 'Order' if can't parse
      }
    }
  } else {
    typeNum = type;
  }

  switch (typeNum) {
    case 1: return 'Order';
    case 2: return 'Return';
    case 3: return 'Discard';
    default: return 'Order';
  }
}

/**
 * Map status enum to display string
 * RequestStatus enum: 1=New, 2=UnderProcess, 3=Approved, 4=Rejected, 6=ReturnedForReview
 * Handles both number and string status values for robustness
 */
function mapStatus(status: number | string | null | undefined): 'New' | 'Pending' | 'Confirmed' | 'Rejected' | 'Returned' | 'ReturnedForReview' {
  // Handle null/undefined
  if (status === null || status === undefined) {
    return 'New';
  }

  // Convert to number if it's a string
  let statusNum: number;
  if (typeof status === 'string') {
    // Try to parse string status values
    const lowerStatus = status.toLowerCase().trim();
    if (lowerStatus === 'new') {
      statusNum = 1;
    } else if (lowerStatus === 'pending' || lowerStatus === 'underprocess' || lowerStatus === 'under process' || lowerStatus === 'inprogress' || lowerStatus === 'in progress') {
      statusNum = 2;
    } else if (lowerStatus === 'approved' || lowerStatus === 'completed' || lowerStatus === 'confirmed') {
      statusNum = 3;
    } else if (lowerStatus === 'rejected' || lowerStatus === 'declined') {
      statusNum = 4;
    } else if (lowerStatus === 'returned' || lowerStatus === 'returnedforreview') {
      statusNum = 6;
    } else {
      // Try to parse as number
      statusNum = parseInt(status, 10);
      if (isNaN(statusNum)) {
        return 'New'; // Default to 'New' if can't parse
      }
    }
  } else {
    statusNum = status;
  }

  switch (statusNum) {
    case 1: return 'New';
    case 2: return 'Pending';
    case 3: return 'Confirmed';
    case 4: return 'Rejected';
    case 6: return 'Returned';
    default: return 'New';
  }
}


