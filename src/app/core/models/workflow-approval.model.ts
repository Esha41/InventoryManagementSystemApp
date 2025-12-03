/**
 * Workflow Approval Models
 * Models for workflow approval detail view
 */

/**
 * Approval step in the workflow (for workflow approval detail view)
 */
export interface WorkflowApprovalStep {
  id: number;
  workflowApprovalstepId?: number;
  workflowStepId?: number;
  oldRequestStatus?: number;
  newRequestStatus?: number;
  comments?: string;
  changedBy?: string;
  changedAt?: string | Date;
  steporder?: number;
  applicationRoleId?: string;
  approverName?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedDate?: string;
  approvedDateTime?: string;
  applicationRoleName?: string;
  isPending?: boolean;
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string;
}

/**
 * Request type options
 */
export type RequestType = 'Order' | 'Return' | 'Discard';

/**
 * Priority levels
 */
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Request status options
 */
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';

/**
 * Request item in a request
 */
export interface RequestItem {
  id: number; // RequestItem ID (the ID of the request item record)
  itemId?: number; // Item/Ammunition ID (the actual item ID for navigation)
  itemName: string;
  itemNo?: string;
  quantity: number;
  unit?: string;
}

/**
 * Request detail view model
 */
export interface RequestDetail {
  id: number;
  requestNo: string;
  requestType: RequestType;
  priority: Priority;
  status: RequestStatus;
  requestDate: string;
  reason?: string;
  notes?: string;
  departmentName?: string;
  requesterName?: string;
  requesterId?: string;
  requesterUserName?: string;
  requestPurposeName?: string;
  requestItems?: RequestItem[];
  approvalHistory?: WorkflowApprovalStep[];
}

/**
 * Base request DTO from backend
 */
export interface BaseRequestDto {
  id: number;
  requestNo: string;
  requestType: number;
  reason?: string;
  priority: number;
  status: number;
  notes?: string;
  departmentId: number;
  requesterId?: string;
  requestPurposeId: number;
  requestDate: string | Date;
  departmentName?: string;
  requesterName?: string;
  requesterUserName?: string;
  requestPurposeName?: string;
  requestItems?: any[];
  approvalHistory?: any[];
  [key: string]: any;
}

