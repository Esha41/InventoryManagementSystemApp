/**
 * Dashboard Order Formatting Utilities
 * Formatting functions for displaying order data in dashboard
 */

import { TranslateService } from '@ngx-translate/core';
import { OrderDto } from '@services/order.service';
import { getLocalizedName, getCurrentLang } from './localization.utils';
import { formatTimeToMilitary } from './format.utils';
import { getRequestStatusTranslationKey } from './dashboard.utils';

/**
 * Format date to MM/DD/YYYY format (month first)
 * Helper function to ensure consistent date formatting across all modals
 */
function formatDateMMDDYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A';
  
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    
    // Format date as MM/DD/YYYY (month first)
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  } catch {
    return 'N/A';
  }
}

/**
 * Format order date for display
 */
export function formatOrderDate(order: OrderDto): string {
  if (!order.usageDateFrom) return 'N/A';

  const fromDate = formatDateMMDDYYYY(order.usageDateFrom);
  const toDate = order.usageDateTo ? formatDateMMDDYYYY(order.usageDateTo) : '';

  return toDate ? `${fromDate} - ${toDate}` : fromDate;
}

/**
 * Format creation date for display with military time
 * Format: "MM/DD/YYYY HHMM"
 */
export function formatCreationDate(order: OrderDto | null): string {
  if (!order) return 'N/A';
  const creationDate = order.creationDate;
  if (!creationDate) return 'N/A';
  
  try {
    const date = new Date(creationDate);
    if (isNaN(date.getTime())) return 'N/A';
    
    // Format date as MM/DD/YYYY (month first)
    const dateStr = formatDateMMDDYYYY(date);
    
    // Format time as military time (HHMM)
    const timeStr = formatTimeToMilitary(date);
    
    return timeStr ? `${dateStr} ${timeStr}` : dateStr;
  } catch {
    return 'N/A';
  }
}

/**
 * Resolve request purpose name with fallback
 */
export function resolveRequestPurpose(order: OrderDto | null, translateService: TranslateService): string {
  if (!order) {
    return 'N/A';
  }
  const currentLang = getCurrentLang(translateService);

  // Try nested object first (current backend structure)
  if (order.requestPurpose) {
    return getLocalizedName(
      {
        nameEn: order.requestPurpose.nameEn,
        nameAr: order.requestPurpose.nameAr
      },
      currentLang
    ) || order.usagePurpose || 'N/A';
  }

  // Fallback to flattened properties (if they exist)
  return getLocalizedName(
    {
      nameEn: order.requestPurposeNameEn,
      nameAr: order.requestPurposeNameAr
    },
    currentLang
  ) || order.usagePurpose || 'N/A';
}

/**
 * Resolve order department name with localization
 */
export function resolveOrderDepartmentName(order: OrderDto | null, translateService: TranslateService): string {
  if (!order) {
    return 'N/A';
  }
  const currentLang = getCurrentLang(translateService);

  // Use nested department object if available (for proper localization)
  if (order.department) {
    const localized = getLocalizedName(order.department, currentLang);
    if (localized) return localized;
  }

  // Fallback to flattened properties
  if (order.departmentNameEn || order.departmentNameAr) {
    const localized = getLocalizedName(
      {
        nameEn: order.departmentNameEn,
        nameAr: order.departmentNameAr
      },
      currentLang
    );
    if (localized) return localized;
  }

  return 'N/A';
}

/**
 * Resolve requester name with localization
 */
export function resolveRequesterName(order: OrderDto | null, translateService: TranslateService): string {
  if (!order) {
    return 'N/A';
  }
  const currentLang = getCurrentLang(translateService);

  // Use nested requester object if available (for proper localization)
  if (order.requester) {
    const localized = getLocalizedName(order.requester, currentLang);
    if (localized) return localized;
    if (order.requester.userName) return order.requester.userName;
  }

  // Fallback to flattened property
  if (order.requesterName) return order.requesterName;

  return 'N/A';
}

/**
 * Resolve depot name with fallback
 */
export function resolveDepotName(order: OrderDto | null): string {
  if (!order) {
    return 'N/A';
  }
  return order.depotNameEn || order.depotNameAr || 'N/A';
}

/**
 * Get translation key for order priority
 * Handles both number and string priority values
 */
export function getOrderPriorityKey(priority?: number | string | null): string {
  if (priority === null || priority === undefined) {
    return 'dashboard.priorityLabels.urgent';
  }

  // Normalize to number
  let priorityNum: number;
  if (typeof priority === 'string') {
    const priorityLower = priority.toLowerCase().trim().replace(/\s+/g, '');
    if (priorityLower === 'normal' || priorityLower === '1') {
      priorityNum = 1;
    } else if (priorityLower === 'urgent' || priorityLower === '2') {
      priorityNum = 2;
    } else if (priorityLower === 'veryurgent' || priorityLower === '3') {
      priorityNum = 3;
    } else if (priorityLower === 'critical' || priorityLower === '4') {
      priorityNum = 4;
    } else {
      const parsed = parseInt(priority, 10);
      priorityNum = isNaN(parsed) ? 2 : parsed;
    }
  } else {
    priorityNum = priority;
  }

  switch (priorityNum) {
    case 1:
      return 'dashboard.priorityLabels.normal';
    case 2:
      return 'dashboard.priorityLabels.urgent';
    case 3:
      return 'dashboard.priorityLabels.veryUrgent';
    default:
      return 'dashboard.priorityLabels.urgent';
  }
}

/**
 * Get translation key for order status
 * Handles both number and string status values
 */
export function getOrderStatusKey(status?: number | string | null): string {
  return getRequestStatusTranslationKey(status);
}

/**
 * Get translation key for allowance indicator
 */
export function getOrderAllowanceKey(isFromAllowance?: boolean | null): string {
  return isFromAllowance ? 'common.yes' : 'common.no';
}

/**
 * Format order usage time to military format (HHMM)
 * Uses centralized formatTimeToMilitary function for consistency
 */
export function formatOrderUsageTime(order: OrderDto | null): string {
  if (!order) return 'N/A';

  const fromTime = formatTimeToMilitary(order.usageTimeFrom);
  const toTime = formatTimeToMilitary(order.usageTimeTo);

  if (!fromTime) return 'N/A';
  return toTime ? `${fromTime} - ${toTime}` : fromTime;
}

/**
 * Format order usage date and time together
 * Combines usage date range with usage time range in one line
 * Format: "From Date From Time - To Date To Time"
 * Uses centralized formatTimeToMilitary function for consistency
 */
export function formatOrderUsageDateAndTime(order: OrderDto | null): string {
  if (!order) return 'N/A';

  const fromDate = order.usageDateFrom ? formatDateMMDDYYYY(order.usageDateFrom) : null;
  const toDate = order.usageDateTo ? formatDateMMDDYYYY(order.usageDateTo) : null;

  const fromTime = formatTimeToMilitary(order.usageTimeFrom);
  const toTime = formatTimeToMilitary(order.usageTimeTo);

  // Build the combined string
  let result = '';

  if (fromDate) {
    result = fromTime ? `${fromDate} ${fromTime}` : fromDate;
  }

  if (toDate) {
    const toPart = toTime ? `${toDate} ${toTime}` : toDate;
    if (result) {
      result = `${result} - ${toPart}`;
    } else {
      result = toPart;
    }
  }

  return result || 'N/A';
}

/**
 * Format usage date from with time
 */
export function formatOrderUsageDateFrom(order: OrderDto | null): string {
  if (!order || !order.usageDateFrom) return 'N/A';

  const fromDate = formatDateMMDDYYYY(order.usageDateFrom);
  const timeRange = formatOrderUsageTime(order);

  // Extract just the "from" time (before the dash)
  let timePart = 'N/A';
  if (timeRange !== 'N/A' && timeRange.includes(' - ')) {
    timePart = timeRange.split(' - ')[0];
  } else if (timeRange !== 'N/A') {
    timePart = timeRange;
  }

  return timePart !== 'N/A' ? `${fromDate} ${timePart}` : fromDate;
}

/**
 * Format usage date to with time
 */
export function formatOrderUsageDateTo(order: OrderDto | null): string {
  if (!order || !order.usageDateTo) return 'N/A';

  const toDate = formatDateMMDDYYYY(order.usageDateTo);
  const timeRange = formatOrderUsageTime(order);

  // Extract just the "to" time (after the dash)
  let timePart = 'N/A';
  if (timeRange !== 'N/A' && timeRange.includes(' - ')) {
    timePart = timeRange.split(' - ')[1];
  } else if (timeRange !== 'N/A' && !order.usageTimeFrom) {
    // If there's only one time and no from time, it might be the to time
    timePart = timeRange;
  }

  return timePart !== 'N/A' ? `${toDate} ${timePart}` : toDate;
}

