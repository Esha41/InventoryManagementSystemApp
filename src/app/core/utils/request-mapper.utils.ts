/**
 * Request Mapper Utilities
 * Functions for mapping backend DTOs to frontend models
 */

import { RequestType, Priority, RequestStatus, RequestItem, WorkflowApprovalStep, RequestDetail, BaseRequestDto } from '@models/workflow-approval.model';
import { formatTimeToMilitary, formatDateShort } from '@utils/format.utils';

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
 * Backend RequestPriority enum: Normal = 1, Urgent = 2, VeryUrgent = 3
 */
export enum PriorityEnum {
  Normal = 1,
  Urgent = 2,
  VeryUrgent = 3
}

/**
 * Request Status enum values (matching backend)
 */
export enum RequestStatusEnum {
  New = 1,
  UnderProcess = 2,
  Approved = 3,
  Rejected = 4,
  ReturnedForReview = 6
}

/**
 * Map numeric or string request type to string
 */
export function mapRequestType(type: number | string): RequestType {
  // Handle numeric type
  if (typeof type === 'number') {
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

  // Handle string type (case-insensitive)
  if (typeof type === 'string') {
    const typeLower = type.toLowerCase().trim();
    if (typeLower === 'order' || typeLower === '1') {
      return 'Order';
    }
    if (typeLower === 'return' || typeLower === '2') {
      return 'Return';
    }
    if (typeLower === 'discard' || typeLower === '3') {
      return 'Discard';
    }
  }

  // Default fallback
  return 'Order';
}

/**
 * Map numeric or string priority to string
 * Backend RequestPriority enum: Normal = 1, Urgent = 2, VeryUrgent = 3
 */
export function mapPriority(priority: number | string): Priority {
  // Handle numeric type
  if (typeof priority === 'number') {
    switch (priority) {
      case PriorityEnum.Normal:
        return 'Normal';
      case PriorityEnum.Urgent:
        return 'Urgent';
      case PriorityEnum.VeryUrgent:
        return 'VeryUrgent';
      default:
        return 'Urgent';
    }
  }

  // Handle string type (case-insensitive)
  if (typeof priority === 'string') {
    const priorityLower = priority.toLowerCase().trim().replace(/\s+/g, '');
    if (priorityLower === 'normal' || priorityLower === '1') {
      return 'Normal';
    }
    if (priorityLower === 'veryurgent' || priorityLower === '3') {
      return 'VeryUrgent';
    }
    if (priorityLower === 'urgent' || priorityLower === '2') {
      return 'Urgent';
    }
  }

  // Default fallback
  return 'Urgent';
}

/**
 * Map numeric or string request status to string
 */
export function mapRequestStatus(status: number | string): RequestStatus {
  // Handle numeric type
  if (typeof status === 'number') {
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

  // Handle string type (case-insensitive)
  if (typeof status === 'string') {
    const statusLower = status.toLowerCase().trim();
    if (statusLower === 'approved' || statusLower === 'completed' || statusLower === 'confirmed' || statusLower === '3') {
      return 'Approved';
    }
    if (statusLower === 'rejected' || statusLower === 'declined' || statusLower === '4') {
      return 'Rejected';
    }
    if (statusLower === 'new' || statusLower === '1') {
      return 'Pending'; // New maps to Pending in RequestStatus type
    }
    if (statusLower === 'underprocess' || statusLower === 'under process' || statusLower === 'inprogress' || statusLower === 'in progress' || statusLower === 'pending' || statusLower === '2') {
      return 'Pending';
    }
  }

  // Default fallback
  return 'Pending';
}

/**
 * Map numeric approval status to string
 */
export function mapApprovalStatus(status: number): 'Pending' | 'Approved' | 'Rejected' | 'Returned' {
  switch (status) {
    case RequestStatusEnum.Approved:
      return 'Approved';
    case RequestStatusEnum.Rejected:
      return 'Rejected';
    case RequestStatusEnum.ReturnedForReview:
      return 'Returned';
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
      unit: item.unit || item.unitName || '-',
      nsn: item.nsn || undefined // National Stock Number
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
          if (lower === 'returnedforreview' || lower === 'returned') return RequestStatusEnum.ReturnedForReview;
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
        approverName: approverName,
        approverNameEn: h.approverNameEn || h.ApproverNameEn,
        approverNameAr: h.approverNameAr || h.ApproverNameAr,
        changedAt: h.changedAt || h.ChangedAt,
        steporder: h.steporder || h.stepOrder || h.StepOrder || index + 1,
        applicationRoleId: h.applicationRoleId || h.ApplicationRoleId,
        status: status,
        approvedDate: h.changedAt && !isPending ? formatApprovalDate(h.changedAt) : undefined,
        approvedDateTime: h.changedAt && !isPending ? formatApprovalDateTime(h.changedAt) : undefined,
        applicationRoleName: h.applicationRoleName || h.ApplicationRoleName,
        applicationRoleNameAr: h.applicationRoleNameAr || h.ApplicationRoleNameAr,
        isPending: isPending,
        requireHigherApproval: h.requireHigherApproval || h.RequireHigherApproval || false,
        higherApprovalRoleId: h.higherApprovalRoleId || h.HigherApprovalRoleId,
        isCurrentUserApprover: h.isCurrentUserApprover || h.IsCurrentUserApprover || false,
        canReturn: h.canReturn || h.CanReturn || false,
        files: h.files || h.Files || [],
        transitions: h.transitions || h.Transitions || []
      };
    })
    // Sort chronologically by ID (which represents creation order)
    // This ensures the workflow displays in the order events actually happened:
    // 1. Original steps in sequential order
    // 2. Return action
    // 3. New pending step created after return (appears at the end, not in the middle)
    .sort((a, b) => (a.id || 0) - (b.id || 0));

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

export function formatApprovalDate(date: string | Date | undefined): string {
  if (!date) return '';
  const formatted = formatDateShort(date);
  return formatted === 'N/A' ? '' : formatted;
}
/**
 * Format approval date and time for display
 * Format: "DD MMM YYYY HHmm" (e.g., "15 Jan 2024 1430")
 * Uses military time format (HHmm) for consistency across the application
 */
export function formatApprovalDateTime(date: string | Date | undefined): string {
  if (!date) return '';

  const dateStr = formatDateShort(date);
  if (dateStr === 'N/A') return '';

  // Format time in military format (HHmm)
  const timeStr = formatTimeToMilitary(new Date(date));

  return timeStr ? `${dateStr} ${timeStr}` : dateStr;
}

/**
 * Format date for request display
 */
export function formatRequestDate(date: string | Date | undefined): string {
  if (!date) return '';

  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Format date and time for request display
 * Format: "DD Month YYYY HHmm" (e.g., "7 December 2025 1430")
 * Handles UTC dates and converts to local time
 * Uses military time format (HHmm) for consistency across the application
 */
export function formatRequestDateTime(date: string | Date | undefined): string {
  if (!date) return '';

  const d = new Date(date);
  // Check if date is valid
  if (isNaN(d.getTime())) return '';

  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const time = formatTimeToMilitary(d);
  return `${day} ${month} ${year}${time ? ' ' + time : ''}`;
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
    departmentNameAr: data['departmentNameAr'],
    departmentNameEn: data['departmentNameEn'],
    requesterName: data.requesterName,
    requesterNameEn: data['requesterNameEn'],
    requesterNameAr: data['requesterNameAr'],
    requesterId: data.requesterId,
    requesterUserName: data.requesterUserName,
    requestPurposeName: data.requestPurposeName,
    requestPurposeNameAr: data['requestPurposeNameAr'],
    requestPurposeNameEn: data['requestPurposeNameEn'],
    requestItems: mapRequestItems(data.requestItems || []),
    approvalHistory: mapApprovalHistory(data.approvalHistory || [], requestStatus),
    // Usage-related fields
    usageLocation: data['usageLocation'],
    usagePurpose: data['usagePurpose'],
    usageDateFrom: data['usageDateFrom'] ? formatRequestDate(data['usageDateFrom']) : undefined,
    usageTimeFrom: data['usageTimeFrom'],
    usageDateTo: data['usageDateTo'] ? formatRequestDate(data['usageDateTo']) : undefined,
    usageTimeTo: data['usageTimeTo'],
    numberOfOfficer: data['numberOfOfficer'],
    numberOfOtherRank: data['numberOfOtherRank'],
    isFromAllowance: data['isFromAllowance'],
    creationDate: data.creationDate,
    supplyDate: data['supplyDate'] ?? undefined
  };
}


