/**
 * Dashboard utility functions
 * Helper functions specific to dashboard functionality
 */

import { 
  isDisplayableRequestStatus, 
  mapRequestStatusToCardStatus, 
  getRequestStatusTranslationKey,
  CardStatus 
} from './status.utils';

// Re-export types and functions for convenience
export type { CardStatus, DisplayableStatus } from './status.utils';
export { mapRequestStatusToCardStatus, getRequestStatusTranslationKey };

/**
 * Common interface for request items
 */
export interface RequestItemBase {
  itemName?: string;
  itemNo?: string;
  quantity: number;
  notes?: string;
}

/**
 * Common interface for requests that can be displayed on dashboard
 */
export interface DisplayableRequest {
  id: number;
  status: number | string;
  departmentId?: number;
  requestNo?: string;
  requesterName?: string;
  requestItems?: RequestItemBase[];
  creationDate?: string | Date;
  isMyTurn?: boolean;
  /** Present on `OrderDto` after mapping; used as title fallback alongside `requestNo`. */
  orderNo?: string;
}

/**
 * Filter requests by user's department if user has department restriction
 */
export function filterRequestsByDepartment<T extends DisplayableRequest>(
  requests: T[],
  userDepartmentId?: number | null
): T[] {
  if (userDepartmentId) {
    return requests.filter(req => req.departmentId === userDepartmentId);
  }
  return requests;
}

/**
 * Filter requests to only include displayable statuses
 */
export function filterDisplayableRequests<T extends DisplayableRequest>(requests: T[]): T[] {
  return requests.filter(req => isDisplayableRequestStatus(req.status));
}

/**
 * Get request title/identifier with fallback
 * Accepts DisplayableRequest or any object with id, requestNo, and optionally orderNo
 */
export function getRequestTitle(
  request: DisplayableRequest | { id: number; requestNo?: string; orderNo?: string },
  fallbackNo?: string
): string {
  const requestNo = 'requestNo' in request ? request.requestNo : undefined;
  const orderNo = 'orderNo' in request ? request.orderNo : undefined;
  return requestNo || orderNo || fallbackNo || `#${request.id}`;
}

/**
 * Map request items to a common format
 */
export interface RequestItem {
  itemName: string;
  itemNo: string;
  quantity: number;
  notes?: string;
}

export function mapRequestItems(
  items?: Array<{ itemName?: string; itemNo?: string; quantity?: number; notes?: string | null }>
): RequestItem[] {
  if (!items || items.length === 0) {
    return [];
  }
  return items.map(item => ({
    itemName: item.itemName || item.itemNo || 'Unknown',
    itemNo: item.itemNo || '',
    quantity: item.quantity ?? 0,
    notes: item.notes || undefined
  }));
}

