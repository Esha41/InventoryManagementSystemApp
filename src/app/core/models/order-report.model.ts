/**
 * Order Report Models
 * Interfaces for order report display and data structures
 */

/**
 * Order summary information for report display
 */
export interface OrderSummary {
  orderId: string;
  status: string;
  priority: string;
  submittedOn: string;
  requestDate: string;
  department: string;
  requester: string;
  usagePurpose: string;
  totalItems: number;
  totalQuantity: number;
  lastUpdated: string;
}

/**
 * Order item for report display
 */
export interface OrderReportItem {
  name: string;
  caliber: string;
  quantity: number;
  status: string;
}

/**
 * Approval step in the workflow for order report
 */
export interface OrderReportApprovalStep {
  step: string;
  role: string;
  approver: string;
  status: 'pending' | 'approved' | 'rejected' | 'in-progress';
  date: string;
  notes: string;
}

/**
 * Workflow detail information
 */
export interface WorkflowDetail {
  phase: string;
  owner: string;
  description: string;
  sla: string;
  status: string;
}

