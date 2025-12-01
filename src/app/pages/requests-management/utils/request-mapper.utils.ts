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
 */
function mapRequestType(type: number): 'Order' | 'Return' | 'Discard' {
  switch (type) {
    case 1: return 'Order';
    case 2: return 'Return';
    case 3: return 'Discard';
    default: return 'Order';
  }
}

/**
 * Map status enum to display string
 * RequestStatus enum: 1=New, 2=UnderProcess, 3=Approved, 4=Rejected
 */
function mapStatus(status: number): 'Pending' | 'Confirmed' | 'Rejected' {
  switch (status) {
    case 1:
    case 2: return 'Pending';
    case 3: return 'Confirmed';
    case 4: return 'Rejected';
    default: return 'Pending';
  }
}

