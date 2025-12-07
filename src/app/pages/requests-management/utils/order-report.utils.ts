/**
 * Order Report Utilities
 * Component-specific utilities for order report functionality
 */

import { OrderDto } from '@services/order.service';
import { OrderSummary, OrderReportItem, OrderReportApprovalStep, WorkflowDetail } from '@models/order-report.model';
import { mapOrderStatusToString, mapOrderStatusFromApi } from '@utils/status.utils';
import { getRequestStatusTranslationKey } from '@utils/status.utils';
import { mapOrderPriorityToString } from '@utils/priority.utils';
import { formatOrderDateTime } from '@utils/date.utils';
import { getRequestTitle } from '@utils/dashboard.utils';

/**
 * Map OrderDto to OrderSummary for report display
 */
export function mapOrderToSummary(order: OrderDto, baseRequestStatus?: number | string | null): OrderSummary {
  // Use requestNo/orderNo if available, otherwise fallback to #${id}
  const requestNo = order.requestNo?.trim() || '';
  const orderNo = order.orderNo?.trim() || '';
  const orderId = requestNo || orderNo || (order.id ? `#${order.id}` : 'N/A');
  
  let statusValue: number;
  if (typeof order.status === 'string') {
    const orderStatusLower = order.status.toLowerCase().trim();
    if (orderStatusLower === 'new' || orderStatusLower === 'pending' || orderStatusLower === '1') {
      statusValue = 1;
    } else if (orderStatusLower === 'underprocess' || orderStatusLower === 'under process' || orderStatusLower === 'inprogress' || orderStatusLower === 'in progress' || orderStatusLower === '2') {
      statusValue = 2;
    } else if (orderStatusLower === 'approved' || orderStatusLower === 'completed' || orderStatusLower === 'confirmed' || orderStatusLower === '3') {
      statusValue = 3;
    } else if (orderStatusLower === 'rejected' || orderStatusLower === 'declined' || orderStatusLower === '4') {
      statusValue = 4;
    } else {
      const parsed = parseInt(order.status, 10);
      statusValue = isNaN(parsed) ? 1 : parsed;
    }
  } else {
    statusValue = order.status;
  }
  
  // Override with baseRequestStatus if provided
  if (baseRequestStatus !== undefined && baseRequestStatus !== null) {
    if (typeof baseRequestStatus === 'number') {
      statusValue = baseRequestStatus;
    } else if (typeof baseRequestStatus === 'string') {
      // Try to parse string status to number
      const statusLower = baseRequestStatus.toLowerCase().trim();
      if (statusLower === 'new' || statusLower === '1') {
        statusValue = 1;
      } else if (statusLower === 'underprocess' || statusLower === 'under process' || statusLower === 'inprogress' || statusLower === 'in progress' || statusLower === 'pending' || statusLower === '2') {
        statusValue = 2;
      } else if (statusLower === 'approved' || statusLower === 'completed' || statusLower === 'confirmed' || statusLower === '3') {
        statusValue = 3;
      } else if (statusLower === 'rejected' || statusLower === 'declined' || statusLower === '4') {
        statusValue = 4;
      } else {
        const parsed = parseInt(baseRequestStatus, 10);
        if (!isNaN(parsed)) {
          statusValue = parsed;
        }
      }
    }
  }
  
  // Use the same status translation key system as dashboard
  const statusTranslationKey = getRequestStatusTranslationKey(statusValue);
  
  // Format date/time range - handle military format (HHMM) and legacy format (HH:mm)
  const formatTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return '';
    // Military format (HHMM - 4 digits) - display as-is
    if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
      return timeStr;
    }
    // Legacy format (HH:mm) - convert to military
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1] ? parts[1].padStart(2, '0') : '00';
      return hours + minutes;
    }
    return timeStr;
  };
  
  const fromDate = order.usageDateFrom ? new Date(order.usageDateFrom).toLocaleDateString() : 'N/A';
  const toDate = order.usageDateTo ? new Date(order.usageDateTo).toLocaleDateString() : '';
  const fromTime = formatTime(order.usageTimeFrom);
  const toTime = formatTime(order.usageTimeTo);
  
  const formattedDateTime = toDate 
    ? `${fromDate} ${fromTime} - ${toDate} ${toTime}` 
    : `${fromDate} ${fromTime}`;

  return {
    orderId: orderId,
    status: statusTranslationKey, // This will be a translation key like 'dashboard.statusLabels.new'
    priority: mapOrderPriorityToString(order.priority),
    submittedOn: formattedDateTime,
    department: order.departmentNameEn || order.departmentNameAr || 'N/A',
    requester: order.requesterName || 'N/A',
    usagePurpose: order.usagePurpose || 'N/A',
    totalItems: order.requestItems?.length || 0,
    totalQuantity: order.requestItems?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    lastUpdated: formattedDateTime
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
export function mapApprovalStatus(status: any): 'pending' | 'approved' | 'rejected' | 'in-progress' {
  if (!status) return 'pending';
  
  const statusStr = String(status).toLowerCase();
  if (statusStr.includes('approved') || statusStr === '1' || statusStr === 'true') {
    return 'approved';
  }
  if (statusStr.includes('rejected') || statusStr === '2' || statusStr === 'false') {
    return 'rejected';
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
  approvalRecords: any[],
  orders: OrderDto[],
  formatDateTime: (date?: string, time?: string) => string
): OrderReportApprovalStep[] {
  return approvalRecords.map((item: any, index: number) => {
    const step = item.higherApprovalRoleId || `Step ${index + 1}`;
    const role = item.applicationRoleName || 'N/A';
    const approver = item.changedBy || 'N/A';
    
    // Format date - handle both date-only and datetime strings
    let date = 'Pending';
    if (item.changedAt) {
      try {
        const dateObj = new Date(item.changedAt);
        if (!isNaN(dateObj.getTime())) {
          // Extract time if it's a datetime string
          const timeStr = item.changedAt.includes('T') 
            ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : '';
          date = formatDateTime(item.changedAt, timeStr);
        }
      } catch {
        date = item.changedAt;
      }
    }
    
    const status = mapApprovalStatus(item.oldRequestStatus);
    
    return {
      step,
      role,
      approver,
      status,
      date,
      notes: item.comments || item.notes || item.comment || item.reason || ''
    };
  });
}

/**
 * Generate fallback approval workflow steps from order data
 */
export function generateApprovalWorkflowFallback(
  order: OrderDto,
  formatDateTime: (date?: string, time?: string) => string
): OrderReportApprovalStep[] {
  // Format date/time range - handle military format (HHMM) and legacy format (HH:mm)
  const formatTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return '';
    // Military format (HHMM - 4 digits) - display as-is
    if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
      return timeStr;
    }
    // Legacy format (HH:mm) - convert to military
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1] ? parts[1].padStart(2, '0') : '00';
      return hours + minutes;
    }
    return timeStr;
  };
  
  const fromDate = order.usageDateFrom ? new Date(order.usageDateFrom).toLocaleDateString() : 'N/A';
  const toDate = order.usageDateTo ? new Date(order.usageDateTo).toLocaleDateString() : '';
  const fromTime = formatTime(order.usageTimeFrom);
  const toTime = formatTime(order.usageTimeTo);
  
  const formattedDateTime = toDate 
    ? `${fromDate} ${fromTime} - ${toDate} ${toTime}` 
    : `${fromDate} ${fromTime}`;

  const steps: OrderReportApprovalStep[] = [
    {
      step: 'Submission',
      role: 'Request Owner',
      approver: order.requesterName || 'N/A',
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
      status: orderStatusNum === 1 ? 'Completed' : orderStatusNum === 2 ? 'Rejected' : 'In progress'
    },
    {
      phase: 'Issuance & Tracking',
      owner: 'Depot',
      description: 'Issue order and register tracking information.',
      sla: 'Pending',
      status: orderStatusNum === 1 ? 'In progress' : 'Pending'
    }
  ];
}

/**
 * Generate QR code data for order
 * Includes comprehensive order information for scanning and verification
 * Format: Human-readable text that can be easily parsed
 */
export function generateQrCodeData(orderSummary: OrderSummary): string {
  // Get actual status text (not translation key) for QR code
  // Status is a translation key like 'dashboard.statusLabels.new', so we extract readable text
  const statusText = orderSummary.status.includes('new') ? 'NEW' :
                     orderSummary.status.includes('approved') ? 'APPROVED' :
                     orderSummary.status.includes('rejected') ? 'REJECTED' :
                     orderSummary.status.includes('underProcess') ? 'UNDER PROCESS' :
                     orderSummary.status.includes('cancelled') ? 'CANCELLED' : 
                     orderSummary.status.includes('Pending') ? 'PENDING' : 'NEW';
  
  // Create a human-readable format that's easy to scan and verify
  const qrLines = [
    '=== ORDER REPORT ===',
    `Order ID: ${orderSummary.orderId}`,
    `Department: ${orderSummary.department}`,
    `Requester: ${orderSummary.requester}`,
    `Status: ${statusText}`,
    `Priority: ${orderSummary.priority}`,
    `Usage Purpose: ${orderSummary.usagePurpose}`,
    `Submitted: ${orderSummary.submittedOn}`,
    `Total Items: ${orderSummary.totalItems}`,
    `Total Quantity: ${orderSummary.totalQuantity}`,
    `Last Updated: ${orderSummary.lastUpdated}`,
    '==================='
  ];
  
  // Also include JSON format for programmatic parsing
  const qrData = {
    type: 'order-report',
    orderId: orderSummary.orderId,
    department: orderSummary.department,
    requester: orderSummary.requester,
    status: statusText,
    priority: orderSummary.priority,
    usagePurpose: orderSummary.usagePurpose,
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
export function filterApprovalRecordsByOrderId(
  dataArray: any[],
  orderId: number
): any[] {
  return dataArray.filter((item: any) => {
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

