/**
 * Workflow Models
 * Matches backend DTOs
 */

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
  NormalOrderForTrainingPurpose_Weapon = 8
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
 * Raw workflow shape returned by backend 
 */
export interface BackendWorkflowDto {
  id: number;
  workflowName: string;
  workflowType: number | string; // Can be string enum from backend or numeric
  workflowTypeName?: string;
  isActive: boolean;
  isDeleted?: boolean;
  isSpecialOrReserved?: boolean;
  workflowSteps?: unknown[];
}

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
  [WorkflowType.NormalOrderForTrainingPurpose_Weapon]: { en: 'Order For Training Purpose (Weapon)', ar: 'طلب للغرض التدريبي (سلاح)' }
};
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

/**
 * Workflow Step DTO - matches backend WorkflowStepDto
 */
export interface WorkflowStepDto {
  id: number;
  workflowId: number;
  stepOrder: number;
  applicationRoleId: string;
  applicationRoleName?: string;
  applicationEntityId: number;
  mustApprove?: boolean;
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string | null;
  higherApplicationEntityId?: number | null;
  reserveQty?: boolean;
  canSkip?: boolean;
  canReturn?: boolean;
  allowedSkipTargetIds?: number[];
}

