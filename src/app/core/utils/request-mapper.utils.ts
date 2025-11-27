/**
 * Request Mapper Utilities
 * Functions for mapping backend DTOs to frontend models
 */

import { RequestType, Priority, RequestStatus, RequestItem, WorkflowApprovalStep, RequestDetail, BaseRequestDto } from '@models/workflow-approval.model';

/**
 * Request Type enum values (matching backend)
 */
export enum RequestTypeEnum {
  Order = 1,
  Return = 2,
  Discard = 3
}

/**
 * Priority enum values (matching backend)
 * Backend RequestPriority enum: High = 1, Medium = 2, Low = 3
 */
export enum PriorityEnum {
  High = 1,
  Medium = 2,
  Low = 3
}

/**
 * Request Status enum values (matching backend)
 */
export enum RequestStatusEnum {
  New = 1,
  UnderProcess = 2,
  Approved = 3,
  Rejected = 4
}

/**
 * Map numeric request type to string
 */
export function mapRequestType(type: number): RequestType {
  switch (type) {
    case RequestTypeEnum.Order:
      return 'Order';
    case RequestTypeEnum.Return:
      return 'Return';
    case RequestTypeEnum.Discard:
      return 'Discard';
    default:
      return 'Order';
  }
}

/**
 * Map numeric priority to string
 * Backend RequestPriority enum: High = 1, Medium = 2, Low = 3
 */
export function mapPriority(priority: number): Priority {
  switch (priority) {
    case PriorityEnum.High:
      return 'High';
    case PriorityEnum.Medium:
      return 'Medium';
    case PriorityEnum.Low:
      return 'Low';
    default:
      return 'Low';
  }
}

/**
 * Map numeric request status to string
 */
export function mapRequestStatus(status: number): RequestStatus {
  switch (status) {
    case RequestStatusEnum.Approved:
      return 'Confirmed';
    case RequestStatusEnum.Rejected:
      return 'Rejected';
    case RequestStatusEnum.New:
    case RequestStatusEnum.UnderProcess:
    default:
      return 'Pending';
  }
}

/**
 * Map numeric approval status to string
 */
export function mapApprovalStatus(status: number): 'Pending' | 'Approved' | 'Rejected' {
  switch (status) {
    case RequestStatusEnum.Approved:
      return 'Approved';
    case RequestStatusEnum.Rejected:
      return 'Rejected';
    case RequestStatusEnum.New:
    case RequestStatusEnum.UnderProcess:
    default:
      return 'Pending';
  }
}

/**
 * Map request items from backend format
 */
export function mapRequestItems(items: any[]): RequestItem[] {
  if (!items || items.length === 0) {
    return [];
  }

  return items
    .filter(item => item && (item.id || item.itemId))
    .map(item => ({
      id: item.id || 0,
      itemName: item.itemName || item.name || 'Unknown Item',
      itemNo: item.itemNo || item.itemCode || item.code || '-',
      quantity: item.quantity || item.requestedQuantity || 0,
      unit: item.unit || item.unitName || '-'
    }));
}

/**
 * Map approval history from backend format
 * @param history - Approval history array from backend
 * @param requestStatus - Optional base request status to filter pending steps if confirmed
 */
export function mapApprovalHistory(history: any[], requestStatus?: RequestStatus): WorkflowApprovalStep[] {
  if (!history || history.length === 0) {
    return [];
  }

  const mappedHistory = history
    .filter(h => h && (h.id || h.workflowApprovalstepId || h.workflowStepId || h.workflowstepId))
    .map((h, index) => {
      const isPending = h.isPending === true || (!h.changedBy && (h.oldRequestStatus === RequestStatusEnum.New || h.oldRequestStatus === RequestStatusEnum.UnderProcess));
      
      const status = isPending 
        ? 'Pending' 
        : mapApprovalStatus(h.newRequestStatus ?? h.oldRequestStatus ?? 0);
      
      const approverName = isPending 
        ? (h.applicationRoleName || h.applicationRoleId || 'Pending Approval')
        : getApproverName(h.changedBy);
      
      return {
        id: h.id || index,
        workflowApprovalstepId: h.workflowApprovalstepId,
        workflowStepId: h.workflowStepId || h.workflowstepId,
        oldRequestStatus: h.oldRequestStatus,
        newRequestStatus: h.newRequestStatus,
        comments: h.comments,
        changedBy: h.changedBy,
        changedAt: h.changedAt,
        steporder: h.steporder || h.stepOrder || index + 1,
        applicationRoleId: h.applicationRoleId,
        approverName: approverName,
        status: status,
        approvedDate: h.changedAt && !isPending ? formatApprovalDate(h.changedAt) : undefined,
        applicationRoleName: h.applicationRoleName,
        isPending: isPending,
        requireHigherApproval: h.requireHigherApproval || false,
        higherApprovalRoleId: h.higherApprovalRoleId
      };
    })
    .sort((a, b) => (a.steporder || 0) - (b.steporder || 0));

  // If base request is confirmed, filter out pending steps
  if (requestStatus === 'Confirmed') {
    return mappedHistory.filter(step => step.status !== 'Pending');
  }

  return mappedHistory;
}

/**
 * Extract approver name from changedBy field
 */
export function getApproverName(changedBy?: string): string {
  if (!changedBy) return 'Unknown Approver';
  
  const parts = changedBy.split('@');
  if (parts.length > 0) {
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  
  return changedBy;
}

/**
 * Format date for approval display
 */
export function formatApprovalDate(date: string | Date | undefined): string {
  if (!date) return '';
  
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format date for request display
 */
export function formatRequestDate(date: string | Date | undefined): string {
  if (!date) return '';
  
  const d = new Date(date);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Map base request DTO to request detail
 */
export function mapToRequestDetail(data: BaseRequestDto): RequestDetail {
  const requestStatus = mapRequestStatus(data.status);
  
  return {
    id: data.id,
    requestNo: data.requestNo,
    requestType: mapRequestType(data.requestType),
    priority: mapPriority(data.priority),
    status: requestStatus,
    requestDate: formatRequestDate(data.requestDate),
    reason: data.reason,
    notes: data.notes,
    departmentName: data.departmentName,
    requesterName: data.requesterName,
    requesterId: data.requesterId,
    requesterUserName: data.requesterUserName,
    requestPurposeName: data.requestPurposeName,
    requestItems: mapRequestItems(data.requestItems || []),
    approvalHistory: mapApprovalHistory(data.approvalHistory || [], requestStatus)
  };
}

