/**
 * Order Report Utilities
 * Component-specific utilities for order report functionality
 */

import { OrderDto } from '@models/order.model';
import { OrderSummary, OrderReportItem, OrderReportApprovalStep, WorkflowDetail } from '@models/order-report.model';
import { WorkflowApprovalStep } from '@models/workflow-approval.model';
import { getStatusMetadata } from '@utils/request-mapper.utils';
import { getPriorityText } from '@utils/priority.utils';
import { formatDate, formatTimeToMilitary, formatDateShort } from '@utils/format.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';

/**
 * Map OrderDto to OrderSummary for report display
 */
export function mapOrderToSummary(order: OrderDto, baseRequestStatus?: number | string | null, translateService?: TranslateService): OrderSummary {
  // Use requestNo/orderNo if available, otherwise fallback to #${id}
  const requestNo = order.requestNo?.trim() || '';
  const orderNo = order.orderNo?.trim() || '';
  const orderId = requestNo || orderNo || (order.id ? `#${order.id}` : 'N/A');

  const statusSource: number | string | null | undefined =
    baseRequestStatus !== undefined && baseRequestStatus !== null ? baseRequestStatus : order.status;
  const statusMeta = getStatusMetadata(statusSource);
  const statusValue = statusMeta.id;
  const statusTranslationKey = statusMeta.translationKey;

  // Keep submittedOn as formatted string since it's a complex date range with times
  // Format submitted date with time (for submittedOn field) - use DD/MM/YYYY for dates
  const fromDate = order.usageDateFrom ? formatDateShort(order.usageDateFrom) : '';
  const toDate = order.usageDateTo ? formatDateShort(order.usageDateTo) : '';
  const fromTime = formatTimeToMilitary(order.usageTimeFrom);
  const toTime = formatTimeToMilitary(order.usageTimeTo);

  const submittedDateTime = toDate
    ? `${fromDate}${fromTime ? ' · ' + fromTime : ''} - ${toDate}${toTime ? ' · ' + toTime : ''}`.trim()
    : `${fromDate}${fromTime ? ' · ' + fromTime : ''}`;

  // Get localized department name
  const currentLang = translateService ? getCurrentLang(translateService) : 'en';
  let departmentName = 'N/A';
  if (order.department) {
    departmentName = getLocalizedName(order.department, currentLang) || 'N/A';
  } else if (order.departmentNameEn || order.departmentNameAr) {
    departmentName = getLocalizedName(
      { nameEn: order.departmentNameEn, nameAr: order.departmentNameAr },
      currentLang
    ) || 'N/A';
  }

  // Get requester name
  let requesterName = 'N/A';
  if (order.requester) {
    requesterName = getLocalizedName(order.requester, currentLang) || order.requester.userName || 'N/A';
  } else if (order.requesterName) {
    requesterName = order.requesterName;
  }

  // Get localized request purpose
  let usagePurpose = 'N/A';
  if (order.requestPurpose) {
    usagePurpose = getLocalizedName(order.requestPurpose, currentLang) || 'N/A';
  } else if (order.requestPurposeNameEn || order.requestPurposeNameAr) {
    usagePurpose = getLocalizedName(
      { nameEn: order.requestPurposeNameEn, nameAr: order.requestPurposeNameAr },
      currentLang
    ) || order.usagePurpose || 'N/A';
  } else if (order.usagePurpose) {
    usagePurpose = order.usagePurpose;
  }

  // Map request type to string
  let requestType = 'Order'; // Default
  if (order.requestType !== undefined && order.requestType !== null) {
    if (typeof order.requestType === 'number') {
      switch (order.requestType) {
        case 1:
          requestType = 'Order';
          break;
        case 2:
          requestType = 'Return';
          break;
        case 3:
          requestType = 'Discard';
          break;
        default:
          requestType = 'Order';
      }
    } else if (typeof order.requestType === 'string') {
      const typeLower = order.requestType.toLowerCase().trim();
      if (typeLower === 'return' || typeLower === '2') {
        requestType = 'Return';
      } else if (typeLower === 'discard' || typeLower === '3') {
        requestType = 'Discard';
      } else {
        requestType = 'Order';
      }
    }
  }

  // Return raw dates for pipe formatting
  // Try to get requestDate from order creationDate or usageDateFrom as fallback
  let requestDate: string | Date | null = null;
  if (order.creationDate) {
    requestDate = order.creationDate;
  } else if (order.usageDateFrom) {
    requestDate = order.usageDateFrom;
  }

  // Return raw date for lastUpdated (usageDateFrom)
  const lastUpdated: string | Date | null = order.usageDateFrom || null;

  return {
    orderId: orderId,
    status: statusTranslationKey, // This will be a translation key like 'dashboard.statusLabels.new'
    priority: getPriorityText(order.priority),
    submittedOn: submittedDateTime, // Keep as formatted string (complex date range)
    requestDate: requestDate, // Raw date for pipe formatting
    department: departmentName,
    requester: requesterName,
    usagePurpose: usagePurpose,
    usagePurposeNotes:
      order.requestPurposeNotes != null && String(order.requestPurposeNotes).trim() !== ''
        ? String(order.requestPurposeNotes)
        : '',
    requestPurposeNameEn: order.requestPurpose?.nameEn || order.requestPurposeNameEn,
    requestPurposeNameAr: order.requestPurpose?.nameAr || order.requestPurposeNameAr,
    totalItems: order.requestItems?.length || 0,
    totalQuantity: order.requestItems?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    lastUpdated: lastUpdated, // Raw date for pipe formatting
    isFromAllowance: order.isFromAllowance || false,
    requestType: requestType,
    supplyDate: order.supplyDate ?? null,
    requestStatusCode: statusValue
  };
}

/**
 * Map OrderDto request items to OrderReportItem array
 */
export function mapOrderItems(order: OrderDto): OrderReportItem[] {
  return (order.requestItems || []).map(item => ({
    name: item.itemName || 'Unknown Item',
    caliber: item.itemNo || 'N/A',
    quantity: item.quantity,
    status: mapItemStatus(order.status)
  }));
}

/**
 * Map order status to item status
 * Handles both number and string status values
 */
export function mapItemStatus(orderStatus: number | string): string {
  // Convert to number if it's a string
  let statusNum: number;
  if (typeof orderStatus === 'string') {
    const statusLower = orderStatus.toLowerCase().trim();
    if (statusLower === 'new' || statusLower === 'pending' || statusLower === '1') {
      statusNum = 1;
    } else if (statusLower === 'underprocess' || statusLower === 'under process' || statusLower === 'inprogress' || statusLower === 'in progress' || statusLower === '2') {
      statusNum = 2;
    } else if (statusLower === 'approved' || statusLower === 'completed' || statusLower === 'confirmed' || statusLower === '3') {
      statusNum = 3;
    } else if (statusLower === 'rejected' || statusLower === 'declined' || statusLower === '4') {
      statusNum = 4;
    } else {
      const parsed = parseInt(orderStatus, 10);
      statusNum = isNaN(parsed) ? 0 : parsed;
    }
  } else {
    statusNum = orderStatus;
  }

  switch (statusNum) {
    case 1: return 'Allocated';
    case 2: return 'Rejected';
    default: return 'Pending allocation';
  }
}

/**
 * Map approval status from API response
 */
export function mapApprovalStatus(status: number | string | unknown): 'pending' | 'approved' | 'rejected' | 'in-progress' | 'returned' | 'returnedforreview' {
  if (!status) return 'pending';

  const statusStr = String(status).toLowerCase();
  if (statusStr.includes('approved') || statusStr === '1' || statusStr === 'true') {
    return 'approved';
  }
  if (statusStr.includes('rejected') || statusStr === '2' || statusStr === 'false') {
    return 'rejected';
  }
  if (statusStr.includes('returned') || statusStr.includes('return')) {
    if (statusStr.includes('review')) {
      return 'returnedforreview';
    }
    return 'returned';
  }
  if (statusStr.includes('progress') || statusStr.includes('processing')) {
    return 'in-progress';
  }
  return 'pending';
}

/**
 * Map API approval records to OrderReportApprovalStep array
 */
export function mapApprovalRecordsToSteps(
  approvalRecords: WorkflowApprovalStep[],
  orders: OrderDto[],
  formatDateTime: (date?: string, time?: string) => string
): OrderReportApprovalStep[] {
  return approvalRecords.map((item: WorkflowApprovalStep, index: number) => {
    const step = item.higherApprovalRoleId || `Step ${index + 1}`;
    const role = item.applicationRoleName || 'N/A';
    const approver = item.changedBy || 'N/A';

    // Format date - handle both date-only and datetime strings
    let date = 'Pending';
    if (item.changedAt) {
      try {
        const changedAtStr = typeof item.changedAt === 'string'
          ? item.changedAt
          : item.changedAt.toISOString();

        const dateObj = new Date(changedAtStr);
        if (!isNaN(dateObj.getTime())) {
          // Extract time in military format if it's a datetime string
          const timeStr = changedAtStr.includes('T')
            ? formatTimeToMilitary(dateObj)
            : '';
          date = formatDateTime(changedAtStr, timeStr);
        }
      } catch {
        date = typeof item.changedAt === 'string' ? item.changedAt : item.changedAt.toISOString();
      }
    }

    const status = mapApprovalStatus(item.oldRequestStatus);

    return {
      step,
      role,
      approver,
      status,
      date,
      // `WorkflowApprovalStep` model only defines `comments` (see `workflow-approval.model.ts`).
      // Keep this mapping robust for any backend variations.
      notes: item.comments || ''
    };
  });
}

/**
 * Generate fallback approval workflow steps from order data
 */
export function generateApprovalWorkflowFallback(
  order: OrderDto
): OrderReportApprovalStep[] {
  const fromDate = order.usageDateFrom ? formatDate(order.usageDateFrom) : 'N/A';
  const toDate = order.usageDateTo ? formatDate(order.usageDateTo) : '';
  const fromTime = formatTimeToMilitary(order.usageTimeFrom);
  const toTime = formatTimeToMilitary(order.usageTimeTo);

  const formattedDateTime = toDate
    ? `${fromDate} ${fromTime ? '· ' + fromTime : ''} - ${toDate} ${toTime ? '· ' + toTime : ''}`.trim()
    : `${fromDate}${fromTime ? ' · ' + fromTime : ''}`;

  // Get requester name with fallback
  let requesterName = 'N/A';
  if (order.requester) {
    requesterName = order.requester.fullNameEN || order.requester.fullNameAR || order.requester.userName || 'N/A';
  } else if (order.requesterName) {
    requesterName = order.requesterName;
  }

  const steps: OrderReportApprovalStep[] = [
    {
      step: 'Submission',
      role: 'Request Owner',
      approver: requesterName,
      status: 'approved',
      date: formattedDateTime,
      notes: 'Initial request submitted.'
    }
  ];

  // Normalize order.status to number for comparison
  let orderStatusNum: number;
  if (typeof order.status === 'string') {
    const statusLower = order.status.toLowerCase().trim();
    if (statusLower === 'new' || statusLower === 'pending' || statusLower === '1') {
      orderStatusNum = 1;
    } else if (statusLower === 'underprocess' || statusLower === 'under process' || statusLower === 'inprogress' || statusLower === 'in progress' || statusLower === '2') {
      orderStatusNum = 2;
    } else if (statusLower === 'approved' || statusLower === 'completed' || statusLower === 'confirmed' || statusLower === '3') {
      orderStatusNum = 3;
    } else if (statusLower === 'rejected' || statusLower === 'declined' || statusLower === '4') {
      orderStatusNum = 4;
    } else {
      const parsed = parseInt(order.status, 10);
      orderStatusNum = isNaN(parsed) ? 0 : parsed;
    }
  } else {
    orderStatusNum = order.status;
  }

  if (orderStatusNum === 1) {
    steps.push({
      step: 'Review',
      role: 'Reviewer',
      approver: 'System',
      status: 'approved',
      date: formattedDateTime,
      notes: 'Order approved.'
    });
  } else if (orderStatusNum === 2) {
    steps.push({
      step: 'Review',
      role: 'Reviewer',
      approver: 'System',
      status: 'rejected',
      date: formattedDateTime,
      notes: order.reason || 'Order rejected.'
    });
  } else {
    steps.push({
      step: 'Review',
      role: 'Reviewer',
      approver: 'System',
      status: 'pending',
      date: 'Pending',
      notes: 'Awaiting review.'
    });
  }

  return steps;
}

/**
 * Generate fallback workflow details
 */
export function generateWorkflowDetailsFallback(order: OrderDto): WorkflowDetail[] {
  // Normalize order.status to number for comparison
  let orderStatusNum: number;
  if (typeof order.status === 'string') {
    const statusLower = order.status.toLowerCase().trim();
    if (statusLower === 'new' || statusLower === 'pending' || statusLower === '1') {
      orderStatusNum = 1;
    } else if (statusLower === 'underprocess' || statusLower === 'under process' || statusLower === 'inprogress' || statusLower === 'in progress' || statusLower === '2') {
      orderStatusNum = 2;
    } else if (statusLower === 'approved' || statusLower === 'completed' || statusLower === 'confirmed' || statusLower === '3') {
      orderStatusNum = 3;
    } else if (statusLower === 'rejected' || statusLower === 'declined' || statusLower === '4') {
      orderStatusNum = 4;
    } else {
      const parsed = parseInt(order.status, 10);
      orderStatusNum = isNaN(parsed) ? 0 : parsed;
    }
  } else {
    orderStatusNum = order.status;
  }

  return [
    {
      phase: 'Intake & Validation',
      owner: 'Request Management',
      description: 'Validate requester credentials and order details.',
      sla: '2 business hours',
      status: 'Completed'
    },
    {
      phase: 'Approval Process',
      owner: 'Approval System',
      description: 'Review and approve order request.',
      sla: '1 business day',
      status: orderStatusNum === 1 ? 'Completed' : orderStatusNum === 2 ? 'Rejected' : 'In Progress'
    },
    {
      phase: 'Issuance & Tracking',
      owner: 'Depot',
      description: 'Issue order and register tracking information.',
      sla: 'Pending',
      status: orderStatusNum === 1 ? 'In Progress' : 'Pending'
    }
  ];
}

/**
 * Generate QR code data for order
 * Includes comprehensive order information for scanning and verification
 * Format: Human-readable text that can be easily parsed
 *
 * @param orderSummary - Summary data for the order
 * @param localizedUsagePurpose - Optional, already-localized usage purpose string
 *   (if provided, this will be used instead of orderSummary.usagePurpose)
 */
export function generateQrCodeData(orderSummary: OrderSummary, localizedUsagePurpose?: string): string {
  // Get actual status text (not translation key) for QR code
  // Status is a translation key like 'dashboard.statusLabels.new', so we extract readable text
  const statusText = orderSummary.status.includes('new') ? 'NEW' :
    orderSummary.status.includes('approved') ? 'APPROVED' :
      orderSummary.status.includes('rejected') ? 'REJECTED' :
        orderSummary.status.includes('underProcess') ? 'IN PROGRESS' :
          orderSummary.status.includes('cancelled') ? 'CANCELLED' :
            orderSummary.status.includes('Pending') ? 'PENDING' : 'NEW';

  const usagePurpose = localizedUsagePurpose || orderSummary.usagePurpose;
  const usagePurposeNotes =
    orderSummary.usagePurposeNotes != null && String(orderSummary.usagePurposeNotes).trim() !== ''
      ? String(orderSummary.usagePurposeNotes)
      : 'N/A';

  // Create a human-readable format that's easy to scan and verify
  const qrLines = [
    '=== REQUESTS REPORT ===',
    `Order ID: ${orderSummary.orderId}`,
    `Department: ${orderSummary.department}`,
    `Requester: ${orderSummary.requester}`,
    `Status: ${statusText}`,
    `Priority: ${orderSummary.priority}`,
    `Usage Purpose: ${usagePurpose}`,
    `Use Purpose Notes: ${usagePurposeNotes}`,
    `Submitted: ${orderSummary.submittedOn}`,
    `Total Items: ${orderSummary.totalItems}`,
    `Total Quantity: ${orderSummary.totalQuantity}`,
    `Usage Date: ${orderSummary.lastUpdated}`,
    '==================='
  ];

  // Also include JSON format for programmatic parsing
  const qrData = {
    type: 'requests-report',
    orderId: orderSummary.orderId,
    department: orderSummary.department,
    requester: orderSummary.requester,
    status: statusText,
    priority: orderSummary.priority,
    usagePurpose: usagePurpose,
    usagePurposeNotes: usagePurposeNotes === 'N/A' ? '' : usagePurposeNotes,
    submittedOn: orderSummary.submittedOn,
    totalItems: orderSummary.totalItems,
    totalQuantity: orderSummary.totalQuantity,
    lastUpdated: orderSummary.lastUpdated,
    timestamp: new Date().toISOString()
  };

  // Return both human-readable and JSON format
  return qrLines.join('\n') + '\n\n' + JSON.stringify(qrData);
}

/**
 * Filter approval records by order ID
 */
export function filterApprovalRecordsByOrderId<T extends { id?: number; orderId?: number; requestId?: number; requestNo?: string }>(
  dataArray: T[],
  orderId: number
): T[] {
  return dataArray.filter((item: T) => {
    // Exact ID match (most reliable)
    if (item.id === orderId) {
      return true;
    }

    // Check other ID fields
    if (item.orderId === orderId || item.requestId === orderId) {
      return true;
    }

    // Check requestNo - extract order number from request number pattern
    if (item.requestNo) {
      const orderNumMatch = item.requestNo.match(/0*(\d+)/);
      if (orderNumMatch && parseInt(orderNumMatch[1]) === orderId) {
        return true;
      }
    }

    return false;
  });
}

