import { FileUploadDto } from './file-upload.model';
import { RequestItemDto } from './common.model';
import type { RequestManagementRequestItemWeaponAssociationDto } from './request-management-base.model';

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
  status: 'Pending' | 'Approved' | 'Rejected' | 'AutoRejected' | 'Returned' | 'ReturnedForReview' | 'Submitted' | 'Cancelled';
  approvedDate?: string;
  approvedDateTime?: string | Date;
  applicationRoleName?: string;
  applicationRoleNameAr?: string;
  isPending?: boolean;
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string;
  isCurrentUserApprover?: boolean;
  canReturn?: boolean;
  /** Backend: user acted via delegation (1) or not (0). */
  isDelegation?: boolean | number;
  changedByRoleId?: string;
  changedByRoleName?: string;
  changedByRoleNameAr?: string;
  /** Pending/future: other roles that may approve this step in parallel. */
  eligibleParallelRoleNamesEn?: string;
  eligibleParallelRoleNamesAr?: string;
  files?: FileUploadDto[];
  transitions?: WorkflowStepTransition[];
  /** True only for the virtual system auto-reject terminal node appended by the frontend. */
  isSystemAutoReject?: boolean;
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
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'AutoRejected' | 'Returned' | 'ReturnedForReview' | 'Cancelled';

/**
 * Request item in a request
 */
export interface RequestItem {
  id: number; // RequestItem ID (the ID of the request item record)
  itemId?: number; // Item/Ammunition ID (the actual item ID for navigation)
  itemName: string;
  /** Arabic catalog name when provided by Request Management API. */
  itemNameAr?: string | null;
  itemNo?: string;
  quantity: number;
  unit?: string;
  nsn?: string; // National Stock Number
  /** 1=Ammunition, 2=Weapon, 3=Explosive — when present, drives return summary column labels. */
  itemType?: number;
  weaponAssociations?: RequestManagementRequestItemWeaponAssociationDto[];
}


/**
 * Request detail view model
 */
export interface RequestDetail {
  id: number;
  requestNo: string;
  requestType: RequestType;
  priority: Priority;
  /** Normalized badge label (historical); prefer {@link rawStatus} for dashboard-aligned i18n. */
  status: RequestStatus;
  /** Backend request status as returned by API (numeric enum or string) — matches dashboard translation keys. */
  rawStatus?: number;
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
  /**
   * Populated only when status is AutoRejected.
   * Reflects the exact moment the auto-reject job fired.
   * Null/undefined for all other statuses.
   */
  autoRejectedAt?: string | Date;
}

/**
 * Workflow / single-request **detail** payloads (approval screens, order report, supply flow).
 * For **unified list** endpoints with explicit nested `department` / `requester`, use `UnifiedListRequestDto`
 * in `unified-list-request.model.ts` (and the `BaseRequestDto` name alias from `UnifiedRequestService`).
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
  creationDate?: string | Date; // Actual creation date from backend audit fields
  departmentName?: string;
  departmentNameAr?: string;
  departmentNameEn?: string;
  requesterName?: string;
  requesterNameEn?: string;
  requesterNameAr?: string;
  requesterRoleNameAr?: string;
  requesterUserName?: string;
  requestPurposeName?: string;
  requestPurposeNotes?: string;
  requestPurposeNameAr?: string;
  requestPurposeNameEn?: string;
  requestItems?: RequestItemDto[];
  approvalHistory?: WorkflowApprovalStep[];
  files?: FileUploadDto[];
  usageLocation?: string;
  usagePurpose?: string;
  usageDateFrom?: string | Date;
  usageTimeFrom?: string;
  usageDateTo?: string | Date;
  usageTimeTo?: string;
  numberOfOfficer?: number;
  numberOfOtherRank?: number;
  isFromAllowance?: boolean;
  supplyDate?: string | Date | null;
  deliveryDate?: string | Date | null;
  returnToDepotId?: number;
  returnToDepot?: {
    nameAr?: string;
    nameEn?: string;
  };
  // Present for some order/return detail payloads (nested localization object).
  department?: {
    id: number;
    code: string;
    nameAr: string;
    nameEn: string;
    isDeleted: boolean;
  };
  isMyTurn?: boolean;
  /** Populated only when status is AutoRejected. Mirrors RequestDetail.autoRejectedAt. */
  autoRejectedAt?: string | Date;
}


