/**
 * UI Helper Utilities
 * Functions for UI-related operations like CSS classes, formatting, etc.
 */

import { formatDate } from '@utils/format.utils';
import { CheckCircle, AlertTriangle, Clock, Package } from 'lucide-angular';
import { OrderDto } from '@models/order.model';
import { OrderItem } from '@models/supply-request.model';

/**
 * Get lot condition CSS classes
 */
export function getLotConditionClass(condition: string): string {
  switch (condition) {
    case 'Near Expiry': return 'bg-red-100 text-red-800 border-red-300';
    case 'Fair': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'Good': return 'bg-green-100 text-green-800 border-green-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Format date for display
 * @deprecated Use formatDate from @utils/format.utils instead
 */
export function formatDateForDisplay(date: Date | string | undefined): string {
  return formatDate(date as string);
}

/**
 * Get approval status icon
 */
export function getApprovalStatusIcon(status: string): any {
  switch (status) {
    case 'Approved': return CheckCircle;
    case 'Rejected': return AlertTriangle;
    case 'Returned':
    case 'ReturnedForReview': return CheckCircle;
    case 'Pending': return Clock;
    default: return Clock;
  }
}

/**
 * Get item type icon
 */
export function getItemTypeIcon(type: string): any {
  return Package;
}

/**
 * Get department name from order data with proper localization
 * @deprecated Use resolveDepartmentName method in component instead for proper localization
 * This function doesn't have access to TranslateService to determine current language
 */
export function getDepartmentName(orderData: OrderDto | null): string {
  if (!orderData) return 'N/A';

  // Try nested department object first
  if (orderData.department) {
    // Return English name as default since we don't have language context here
    return orderData.department.nameEn || orderData.department.nameAr || 'N/A';
  }

  // Fallback to flattened properties
  return orderData.departmentNameEn || orderData.departmentNameAr || 'N/A';
}

/**
 * Get item product ID from order data
 */
export function getItemProductId(item: OrderItem, orderData: OrderDto | null): string {
  if (orderData?.requestItems) {
    const orderItem = orderData.requestItems.find(ri => ri.id === item.requestItemId);
    if (orderItem?.itemNo) {
      return orderItem.itemNo;
    }
  }
  return '-';
}

/**
 * Get status CSS classes for request status badges (aligned with dashboard list pills).
 */
export function getRequestStatusClass(status: string): string {
  const s = status ?? '';
  switch (s) {
    case 'New':
    case 'new':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'Pending':
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    case 'Confirmed':
    case 'confirmed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    case 'Rejected':
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    case 'AutoRejected':
    case 'Auto-Rejected':
    case 'auto-rejected':
    case 'autorejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    case 'Returned':
    case 'ReturnedForReview':
    case 'returned':
    case 'returnedforreview':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
    default:
      return 'bg-[var(--color-background-muted)] text-[var(--color-text-muted)]';
  }
}

