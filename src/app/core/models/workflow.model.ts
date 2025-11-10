/**
 * Workflow Models
 * Matches backend DTOs
 */

export interface WorkflowTypeItem {
  id: number;
  name: string;
}
export enum WorkflowType {
  Supply = 1,
  Return = 2,
  Discard = 3
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
  workflowType: number;
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
  reserveQty?: boolean;
}

export interface BackendCreateWorkflowDto {
  workflowName: string;
  workflowType: number;       // e.g., 1
  isActive: boolean;
  isSpecialOrReserved: boolean;
  workflowSteps: BackendWorkflowStepDto[];
}
export const WORKFLOW_TYPE_NAMES: { [key in WorkflowType]: { en: string; ar: string } } = {
  [WorkflowType.Supply]: { en: 'Supply', ar: 'توريد' },
  [WorkflowType.Return]: { en: 'Return', ar: 'إرجاع' },
  [WorkflowType.Discard]: { en: 'Discard', ar: 'تخلص' }
};
export interface BackendUpdateWorkflowDto extends BackendCreateWorkflowDto {
  id: number;
}

