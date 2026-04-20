import { FileUploadDto } from './file-upload.model';
import { RequestItemDto } from './common.model';

// Re-export for backward compatibility
export { FileUploadDto };


/**
 * Approval step in the workflow (for workflow approval detail view)
 */
export interface WorkflowStepTransition {
  id: number;
  sourceWorkflowStepId: number;
  targetWorkflowStepId: number;
  targetStep?: {
    id: number;
    workflowId: number;
    stepOrder: number;
    applicationRoleId?: string;
    applicationRoleName?: string;
    applicationRole?: {
      id: string;
      name?: string;
      nameEn?: string;
      nameAr?: string;
    };
    applicationEntityId?: number;
    requireHigherApproval?: boolean;
    higherApprovalRoleId?: string | null;
    higherApplicationEntityId?: number | null;
    mustApprove?: boolean;
    reserveQty?: boolean;
    canSkip?: boolean;
  };
}

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
  approverNameEn?: string;
  approverNameAr?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned' | 'ReturnedForReview' | 'Submitted';
  approvedDate?: string;
  approvedDateTime?: string | Date;
  applicationRoleName?: string;
  applicationRoleNameAr?: string;
  isPending?: boolean;
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string;
  isCurrentUserApprover?: boolean;
  canReturn?: boolean;
  files?: FileUploadDto[];
  transitions?: WorkflowStepTransition[];
}

/**
 * Request type options
 */
export type RequestType = 'Order' | 'Return' | 'Discard';

/**
 * Priority levels
 */
export type Priority = 'Normal' | 'Urgent' | 'VeryUrgent' | 'Critical';

/**
 * Request status options
 */
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Returned' | 'ReturnedForReview';

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
  nsn?: string; // National Stock Number
  /** 1=Ammunition, 2=Weapon, 3=Explosive — when present, drives return summary column labels. */
  itemType?: number;
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
  departmentNameAr?: string;
  departmentNameEn?: string;
  requesterName?: string;
  requesterNameEn?: string;
  requesterNameAr?: string;
  requesterId?: string;
  requesterUserName?: string;
  requestPurposeName?: string;
  requestPurposeNameAr?: string;
  requestPurposeNameEn?: string;
  requestPurposeNotes?: string;
  requestItems?: RequestItem[];
  approvalHistory?: WorkflowApprovalStep[];
  // Usage-related fields
  usageLocation?: string;
  usagePurpose?: string;
  usageDateFrom?: string;
  usageTimeFrom?: string;
  usageDateTo?: string;
  usageTimeTo?: string;
  numberOfOfficer?: number;
  numberOfOtherRank?: number;
  isFromAllowance?: boolean;
  creationDate?: string | Date;
  supplyDate?: string | Date | null;
  // Return-specific fields
  returnToDepotId?: number;
  returnToDepotNameAr?: string;
  returnToDepotNameEn?: string;
  deliveryDate?: string | Date | null;
  /** True when backend marks this request as the current user's action (list APIs); may be absent on some detail payloads. */
  isMyTurn?: boolean;
}

/**
 * Base request DTO from backend
 */
export interface BaseRequestDto {
  id: number;
  requestNo: string;
  requestType: number | string; // Can be number (1, 2, 3) or string ('Order', 'Return', 'Discard')
  reason?: string;
  priority: number | string; // Can be number (1, 2, 3) or string ('High', 'Medium', 'Low')
  status: number | string; // Can be number (1, 2, 3, 4) or string ('New', 'UnderProcess', 'Approved', 'Rejected')
  notes?: string;
  departmentId: number;
  requesterId?: string;
  requestPurposeId: number;
  requestDate: string | Date;
  creationDate?: string | Date; // Actual creation date from backend audit fields
  departmentName?: string;
  requesterName?: string;
  requesterNameEn?: string;
  requesterNameAr?: string;
  requesterUserName?: string;
  requestPurposeName?: string;
  requestPurposeNotes?: string;
  requestItems?: RequestItemDto[];
  approvalHistory?: WorkflowApprovalStep[];
  files?: FileUploadDto[];
  isMyTurn?: boolean;
  [key: string]: any;
}


