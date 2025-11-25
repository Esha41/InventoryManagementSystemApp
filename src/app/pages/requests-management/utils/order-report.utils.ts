/**
 * Order Report Utilities
 * Component-specific utilities for order report functionality
 */

import { OrderDto } from '@services/order.service';
import { OrderSummary, OrderReportItem, OrderReportApprovalStep, WorkflowDetail } from '@models/order-report.model';
import { mapOrderStatusToString, mapOrderStatusFromApi } from '@utils/status.utils';
import { mapOrderPriorityToString } from '@utils/priority.utils';
import { formatOrderDateTime } from '@utils/date.utils';

/**
 * Map OrderDto to OrderSummary for report display
 */
export function mapOrderToSummary(order: OrderDto): OrderSummary {
  return {
    orderId: order.orderNo || `#${order.id}`,
    status: mapOrderStatusToString(order.status),
    priority: mapOrderPriorityToString(order.priority),
    submittedOn: formatOrderDateTime(order.usageDate, order.usageTime),
    department: order.departmentNameEn || order.departmentNameAr || 'N/A',
    requester: order.requesterName || 'N/A',
    usagePurpose: order.usagePurpose || 'N/A',
    totalItems: order.requestItems?.length || 0,
    totalQuantity: order.requestItems?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    workflowVersion: `WF-${order.requestType}-${order.id}`,
    lastUpdated: formatOrderDateTime(order.usageDate, order.usageTime)
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
 */
export function mapItemStatus(orderStatus: number): string {
  switch (orderStatus) {
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
  const steps: OrderReportApprovalStep[] = [
    {
      step: 'Submission',
      role: 'Request Owner',
      approver: order.requesterName || 'N/A',
      status: 'approved',
      date: formatDateTime(order.usageDate, order.usageTime),
      notes: 'Initial request submitted.'
    }
  ];

  if (order.status === 1) {
    steps.push({
      step: 'Review',
      role: 'Reviewer',
      approver: 'System',
      status: 'approved',
      date: formatDateTime(order.usageDate, order.usageTime),
      notes: 'Order approved.'
    });
  } else if (order.status === 2) {
    steps.push({
      step: 'Review',
      role: 'Reviewer',
      approver: 'System',
      status: 'rejected',
      date: formatDateTime(order.usageDate, order.usageTime),
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
      status: order.status === 1 ? 'Completed' : order.status === 2 ? 'Rejected' : 'In progress'
    },
    {
      phase: 'Issuance & Tracking',
      owner: 'Depot',
      description: 'Issue order and register tracking information.',
      sla: 'Pending',
      status: order.status === 1 ? 'In progress' : 'Pending'
    }
  ];
}

/**
 * Generate QR code data for order
 */
export function generateQrCodeData(orderSummary: OrderSummary): string {
  return JSON.stringify({
    orderId: orderSummary.orderId,
    workflow: orderSummary.workflowVersion,
    issuedOn: orderSummary.lastUpdated,
    totalItems: orderSummary.totalItems
  });
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

