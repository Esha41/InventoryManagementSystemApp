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
    priority: mapPriority(dto.priority),
    requestType: mapRequestType(dto.requestType),
    status: mapStatus(dto.status)
  };
}

/**
 * Format date for display
 */
function formatRequestDate(date: string | Date | undefined): string {
  if (!date) return '';
  return formatDate(date as string);
}

/**
 * Map priority enum to display string
 * RequestPriority enum: High = 1, Medium = 2, Low = 3
 */
function mapPriority(priority: number): 'High' | 'Medium' | 'Low' | 'Critical' {
  switch (priority) {
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
 * RequestStatus enum: 1=New, 2=UnderProcess, 3=Approved, 4=Rejected
 * Handles both number and string status values for robustness
 */
function mapStatus(status: number | string | null | undefined): 'Pending' | 'Confirmed' | 'Rejected' {
  // Handle null/undefined
  if (status === null || status === undefined) {
    return 'Pending';
  }
  
  // Convert to number if it's a string
  let statusNum: number;
  if (typeof status === 'string') {
    // Try to parse string status values
    const lowerStatus = status.toLowerCase().trim();
    if (lowerStatus === 'new' || lowerStatus === 'pending') {
      statusNum = 1;
    } else if (lowerStatus === 'underprocess' || lowerStatus === 'under process' || lowerStatus === 'inprogress' || lowerStatus === 'in progress') {
      statusNum = 2;
    } else if (lowerStatus === 'approved' || lowerStatus === 'completed' || lowerStatus === 'confirmed') {
      statusNum = 3;
    } else if (lowerStatus === 'rejected' || lowerStatus === 'declined') {
      statusNum = 4;
    } else {
      // Try to parse as number
      statusNum = parseInt(status, 10);
      if (isNaN(statusNum)) {
        return 'Pending'; // Default to 'Pending' if can't parse
      }
    }
  } else {
    statusNum = status;
  }
  
  switch (statusNum) {
    case 1:
    case 2: return 'Pending';
    case 3: return 'Confirmed';
    case 4: return 'Rejected';
    default: return 'Pending';
  }
}

