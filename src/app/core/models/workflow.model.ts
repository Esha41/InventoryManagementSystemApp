/**
 * Workflow Models
 * Matches Ettad.Workflows.Service.Dtos (JSON camelCase)
 */

import type { RoleDto } from './backend-user.model';

export interface WorkflowTypeItem {
  id: number;
  name: string;
}
export enum WorkflowType {
  NormalOrder = 1,
  OrderFromAllowance = 2,
  Return = 3,
  Discard = 4,
  NormalOrderForTrainingPurpose = 5,
  NormalOrder_Weapon = 6,
  OrderFromAllowance_Weapon = 7,
  NormalOrderForTrainingPurpose_Weapon = 8,
  Return_Weapon = 9
}
export interface WorkflowDto {
  id: number;
  name: string;
  approvalStages: number;
  status: 'Active' | 'Inactive';
  workflowType: number;
  workflowTypeName?: string;
  visitorType?: string;
  locations?: string;
  gate?: string;
  department?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Full workflow returned by GET/POST/PUT Workflows APIs (matches backend WorkflowDto).
 */
export interface BackendWorkflowDto {
  id: number;
  workflowName: string;
  workflowType: number | string;
  workflowTypeName?: string;
  isActive: boolean;
  isDeleted?: boolean;
  isSpecialOrReserved?: boolean;
  workflowSteps?: WorkflowStepDto[];
}

/** Alias for callers that prefer an "API shape" name. */
export type ApiWorkflowDto = BackendWorkflowDto;

export interface CreateWorkflowDto {
  name: string;
  status: 'Active' | 'Inactive';
}

export interface UpdateWorkflowDto {
  id: number;
  name: string;
  status: 'Active' | 'Inactive';
}

// Backend create payloads 
export interface BackendWorkflowStepDto {
  id?: number;
  workflowId?: number;
  stepOrder: number;
  applicationRoleId: string; // roleId (GUID)
  applicationEntityId: number; // entity id
  mustApprove?: boolean;
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string | null;
  higherApplicationEntityId?: number | null;
  reserveQty?: boolean;
  canReturn?: boolean;
  parallelRoleIds?: string[];
}

export interface BackendCreateWorkflowDto {
  workflowName: string;
  workflowType: number;       // e.g., 1
  isActive: boolean;
  isSpecialOrReserved: boolean;
  workflowSteps: BackendWorkflowStepDto[];
}
export const WORKFLOW_TYPE_NAMES: { [key in WorkflowType]: { en: string; ar: string } } = {
  [WorkflowType.NormalOrder]: { en: 'Order', ar: 'طلب' },
  [WorkflowType.OrderFromAllowance]: { en: 'Order From Reserved Allowance', ar: 'طلب من المخصص المحجوز' },
  [WorkflowType.Return]: { en: 'Return', ar: 'إرجاع' },
  [WorkflowType.Discard]: { en: 'Discard', ar: 'تخلص' },
  [WorkflowType.NormalOrderForTrainingPurpose]: { en: 'Order For Training Purpose', ar: 'طلب للغرض التدريبي' },
  [WorkflowType.NormalOrder_Weapon]: { en: 'Order (Weapon)', ar: 'طلب (سلاح)' },
  [WorkflowType.OrderFromAllowance_Weapon]: { en: 'Order From Reserved Allowance (Weapon)', ar: 'طلب من المخصص المحجوز (سلاح)' },
  [WorkflowType.NormalOrderForTrainingPurpose_Weapon]: { en: 'Order For Training Purpose (Weapon)', ar: 'طلب للغرض التدريبي (سلاح)' },
  [WorkflowType.Return_Weapon]: { en: 'Return (Weapon)', ar: 'إرجاع (سلاح)' }
};

/**
 * Normalize workflow type from API (number or JsonStringEnumConverter string) to numeric {@link WorkflowType}.
 */
export function workflowTypeToNumber(workflowType: number | string): number {
  if (typeof workflowType === 'number') {
    return workflowType;
  }
  const stringValue = String(workflowType);
  switch (stringValue) {
    case 'NormalOrder':
      return WorkflowType.NormalOrder;
    case 'OrderFromAllowance':
      return WorkflowType.OrderFromAllowance;
    case 'Return':
      return WorkflowType.Return;
    case 'Discard':
      return WorkflowType.Discard;
    case 'NormalOrderForTrainingPurpose':
      return WorkflowType.NormalOrderForTrainingPurpose;
    case 'NormalOrder_Weapon':
      return WorkflowType.NormalOrder_Weapon;
    case 'OrderFromAllowance_Weapon':
      return WorkflowType.OrderFromAllowance_Weapon;
    case 'NormalOrderForTrainingPurpose_Weapon':
      return WorkflowType.NormalOrderForTrainingPurpose_Weapon;
    case 'Return_Weapon':
      return WorkflowType.Return_Weapon;
    default:
      return 0;
  }
}
export interface BackendUpdateWorkflowDto extends BackendCreateWorkflowDto {
  id: number;
}

/**
 * Workflow Step Notifier DTOs
 */
export interface WorkflowStepNotifierDto {
  id: number;
  workflowStepId: number;
  userId?: string | null;
  roleId?: string | null;
  userName?: string | null;
  userFullNameEn?: string | null;
  userFullNameAr?: string | null;
  roleName?: string | null;
  roleNameAr?: string | null;
}

export interface UpdateWorkflowStepNotifiersDto {
  workflowStepId: number;
  userIds?: string[];
  roleIds?: string[];
}

export interface CreateWorkflowStepNotifierDto {
  workflowStepId: number;
  userIds?: string[];
  roleIds?: string[];
}

/** Transition from one workflow step to another (backend WorkflowStepTransitionDto) */
export interface WorkflowStepTransitionDto {
  id?: number;
  sourceWorkflowStepId?: number;
  targetWorkflowStepId: number;
  targetStep?: TargetStepDetailsDto | null;
}

/** Target step details (backend TargetStepDetailsDto) */
export interface TargetStepDetailsDto {
  id: number;
  workflowId: number;
  stepOrder: number;
  applicationEntityId: number;
  applicationRole?: RoleDto | null;
  requireHigherApproval?: boolean;
  higherApprovalRole?: RoleDto | null;
  higherApplicationEntityId?: number | null;
  mustApprove?: boolean;
  reserveQty?: boolean;
  canSkip?: boolean;
  canReturn?: boolean;
}

/** Parallel approver role on a step (backend WorkflowStepParallelRoleDto) */
export interface WorkflowStepParallelRoleDto {
  id: number;
  workflowStepId: number;
  roleId: string;
  roleName?: string | null;
  roleNameAr?: string | null;
}

/** Approval line for a workflow step (backend WorkflowApprovalStepDto) */
export interface WorkflowApprovalStepDto {
  id: number;
  workflowStepId: number;
  targetRequestId: number;
  requestType: number | string;
  approverUserId?: string | null;
  approverRoleId?: string | null;
  isDelegation: boolean;
  approvedDate?: string | null;
  status: number | string;
  comments?: string | null;
  isCurrent: boolean;
  returnToStepId?: number | null;
  oldRequestStatus?: number | string | null;
  newRequestStatus?: number | string | null;
  changedBy?: string | null;
  createdBy?: string | null;
  changedAt?: string | null;
}

/** Step notifier (user or role) */
export interface WorkflowStepNotifier {
  id?: number;
  userId?: string | null;
  roleId?: string | null;
  userName?: string | null;
  userFullNameEn?: string | null;
  userFullNameAr?: string | null;
  roleName?: string | null;
  roleNameAr?: string | null;
}

/**
 * Workflow Step DTO - matches backend WorkflowStepDto
 */
export interface WorkflowStepDto {
  id: number;
  workflowId: number;
  stepOrder: number;
  applicationRoleId: string;
  applicationRoleName?: string;
  applicationRoleNameAr?: string | null;
  applicationEntityId: number;
  applicationEntityName?: string;
  mustApprove?: boolean;
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string | null;
  higherApplicationEntityId?: number | null;
  higherApprovalApplicationEntityId?: number | null;
  higherApprovalEntityId?: number | null;
  higherRoleId?: string | null;
  reserveQty?: boolean;
  canSkip?: boolean;
  canReturn?: boolean;
  allowedSkipTargetIds?: number[];
  transitions?: WorkflowStepTransitionDto[];
  notifiers?: WorkflowStepNotifier[];
  parallelRoles?: WorkflowStepParallelRoleDto[];
  approvalSteps?: WorkflowApprovalStepDto[];
}

