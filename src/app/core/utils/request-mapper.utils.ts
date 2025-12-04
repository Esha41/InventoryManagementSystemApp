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
      id: item.id || 0, // RequestItem ID
      itemId: item.itemId || item.id || undefined, // Item/Ammunition ID (prefer itemId, fallback to id)
      itemName: item.itemName || item.name || 'Unknown Item',
      itemNo: item.itemNo || item.itemCode || item.code || '-',
      quantity: item.quantity || item.requestedQuantity || 0,
      unit: item.unit || item.unitName || '-'
    }));
}

/**
 * Map approval history from backend format
 * @param history - Approval history array from backend
 * @param requestStatus - Optional base request status to filter pending steps if approved
 */
export function mapApprovalHistory(history: any[], requestStatus?: RequestStatus): WorkflowApprovalStep[] {
  if (!history || history.length === 0) {
    return [];
  }

  const mappedHistory = history
    .filter(h => h && (h.id || h.workflowApprovalstepId || h.workflowStepId || h.workflowstepId))
    .map((h, index) => {
      // Backend now properly sets IsPending flag - trust it first
      // Fallback to checking changedBy and status if IsPending is not explicitly set
      const backendIsPending = h.isPending === true || h.IsPending === true;
      const hasChangedBy = !!h.changedBy || !!h.ChangedBy;
      
      // Handle both string and number status values (backend might return either)
      const normalizeStatus = (status: any): number => {
        if (typeof status === 'number') return status;
        if (typeof status === 'string') {
          const lower = status.toLowerCase();
          if (lower === 'new' || lower === 'pending') return RequestStatusEnum.New;
          if (lower === 'underprocess' || lower === 'under process' || lower === 'inprogress' || lower === 'in progress') return RequestStatusEnum.UnderProcess;
          if (lower === 'approved' || lower === 'completed') return RequestStatusEnum.Approved;
          if (lower === 'rejected' || lower === 'declined') return RequestStatusEnum.Rejected;
        }
        return 0;
      };
      
      const oldStatusNum = normalizeStatus(h.oldRequestStatus || h.OldRequestStatus);
      const newStatusNum = normalizeStatus(h.newRequestStatus || h.NewRequestStatus);
      
      const isNewOrUnderProcess = oldStatusNum === RequestStatusEnum.New || 
                                   oldStatusNum === RequestStatusEnum.UnderProcess ||
                                   newStatusNum === RequestStatusEnum.New ||
                                   newStatusNum === RequestStatusEnum.UnderProcess;
      
      // Step is pending if:
      // 1. Backend explicitly says it's pending (IsPending = true), OR
      // 2. No one has changed it yet (no changedBy) AND status is New/UnderProcess
      const isPending = backendIsPending || (!hasChangedBy && isNewOrUnderProcess);
      
      // Determine status: if pending, show "Pending", otherwise map the actual status
      // Use the normalized status number for mapping
      const status = isPending 
        ? 'Pending' 
        : mapApprovalStatus(newStatusNum || oldStatusNum || 0);
      
      // Get approver name: if pending, show role name, otherwise show who approved it
      const approverName = isPending 
        ? (h.applicationRoleName || h.ApplicationRoleName || h.applicationRoleId || 'Pending Approval')
        : getApproverName(h.changedBy);
      
      return {
        id: h.id || index,
        workflowApprovalstepId: h.workflowApprovalstepId || h.WorkflowApprovalStepId,
        workflowStepId: h.workflowStepId || h.workflowstepId || h.WorkflowStepId,
        oldRequestStatus: h.oldRequestStatus || h.OldRequestStatus,
        newRequestStatus: h.newRequestStatus || h.NewRequestStatus,
        comments: h.comments || h.Comments,
        changedBy: h.changedBy || h.ChangedBy,
        changedAt: h.changedAt || h.ChangedAt,
        steporder: h.steporder || h.stepOrder || h.StepOrder || index + 1,
        applicationRoleId: h.applicationRoleId || h.ApplicationRoleId,
        approverName: approverName,
        status: status,
        approvedDate: h.changedAt && !isPending ? formatApprovalDate(h.changedAt) : undefined,
        approvedDateTime: h.changedAt && !isPending ? formatApprovalDateTime(h.changedAt) : undefined,
        applicationRoleName: h.applicationRoleName || h.ApplicationRoleName,
        isPending: isPending,
        requireHigherApproval: h.requireHigherApproval || h.RequireHigherApproval || false,
        higherApprovalRoleId: h.higherApprovalRoleId || h.HigherApprovalRoleId
      };
    })
    .sort((a, b) => (a.steporder || 0) - (b.steporder || 0));

  // If base request is approved, filter out pending steps
  if (requestStatus === 'Approved') {
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
 * Format date for approval display assuming backend stores UTC
 * and we want to show Qatar local time (UTC+3), independent of browser time zone.
 */
export function formatApprovalDate(date: string | Date | undefined): string {
  if (!date) return '';

  const utc = new Date(date);
  const qatarTime = new Date(utc.getTime() + 3 * 60 * 60 * 1000); // UTC+3

  return qatarTime.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
export function formatApprovalDateTime(date: string | Date | undefined): string {
  if (!date) return '';

  const utc = new Date(date);
  const qatarTime = new Date(utc.getTime() + 3 * 60 * 60 * 1000); // UTC+3

  return qatarTime.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
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

