/**
 * Workflow Models
 * Matches backend DTOs
 */

export interface WorkflowDto {
  id: number;
  name: string;
  approvalStages: number;
  status: 'Active' | 'Inactive';
  workflowType?: number;
  workflowTypeName?: string;
  visitorType?: string;
  locations?: string;
  gate?: string;
  department?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Raw workflow shape returned by backend (from Swagger screenshot)
 */
export interface BackendWorkflowDto {
  id: number;
  workflowName: string;
  workflowType?: number;
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

// Backend create payloads (match Swagger)
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

export interface BackendUpdateWorkflowDto extends BackendCreateWorkflowDto {
  id: number;
}

