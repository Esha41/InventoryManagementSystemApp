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
  submittedOn: string | Date | null; // Raw date for pipe formatting
  requestDate: string | Date | null; // Raw date for pipe formatting
  department: string;
  requester: string;
  usagePurpose: string;
  requestPurposeNameEn?: string;
  requestPurposeNameAr?: string;
  totalItems: number;
  totalQuantity: number;
  lastUpdated: string | Date | null; // Raw date for pipe formatting
  isFromAllowance?: boolean;
  requestType?: string;
  supplyDate?: string | Date | null; // Supply/pickup date (permission-gated)
  /** Numeric request status (e.g. 3 = approved); used for permission-gated sections. */
  requestStatusCode?: number;
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
  status:
    | 'pending'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'auto-rejected'
    | 'autorejected'
    | 'in-progress'
    | 'returned'
    | 'returnedforreview';
  date: string | Date | null; // Raw date for pipe formatting
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

