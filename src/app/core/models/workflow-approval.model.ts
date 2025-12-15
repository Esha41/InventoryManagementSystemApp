
/**
 * File upload DTO matching backend structure
 */
export interface FileUploadDto {
  id: number;
  fileUrl: string;
  fileName: string;
  originalName: string;
  isMain: boolean;
  entity: number;
  entityId: number;
}

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
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned' | 'ReturnedForReview';
  approvedDate?: string;
  approvedDateTime?: string;
  applicationRoleName?: string;
  applicationRoleNameAr?: string;
  isPending?: boolean;
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string;
  isCurrentUserApprover?: boolean;
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
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

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
  departmentName?: string;
  requesterName?: string;
  requesterUserName?: string;
  requestPurposeName?: string;
  requestItems?: any[];
  approvalHistory?: any[];
  files?: FileUploadDto[];
  [key: string]: any;
}

