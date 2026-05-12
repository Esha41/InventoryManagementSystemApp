/**
 * Request Mapper Utilities
 * Functions for mapping backend DTOs to frontend models
 */

import { RequestType, Priority, RequestStatus, RequestItem, WorkflowApprovalStep, RequestDetail, BaseRequestDto } from '@models/workflow-approval.model';
import { formatTimeToMilitary, formatDateShort } from '@utils/format.utils';

type LooseRecord = Record<string, unknown>;

const asRecord = (value: unknown): LooseRecord | null =>
  value !== null && typeof value === 'object' ? (value as LooseRecord) : null;

const readField = <T>(obj: LooseRecord, ...keys: string[]): T | undefined => {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null) {
      return value as T;
    }
  }
  return undefined;
};

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
  Cancelled = 5,
  ReturnedForReview = 6,
  AutoRejected = 7
}


export interface StatusMetadata {
  id: RequestStatusEnum;
  translationKey: string;
  badgeClass: string; // 'Approved' | 'Rejected' | 'AutoRejected' | 'Pending' | 'Returned'
  cardStatus: string; // 'new' | 'on-progress' | 'completed' | 'declined' | 'returned'
}

export const STATUS_METADATA: Record<RequestStatusEnum, StatusMetadata> = {
  [RequestStatusEnum.New]: {
    id: RequestStatusEnum.New,
    translationKey: 'dashboard.statusLabels.new',
    badgeClass: 'Pending',
    cardStatus: 'new'
  },
  [RequestStatusEnum.UnderProcess]: {
    id: RequestStatusEnum.UnderProcess,
    translationKey: 'dashboard.statusLabels.underProcess',
    badgeClass: 'Pending',
    cardStatus: 'on-progress'
  },
  [RequestStatusEnum.Approved]: {
    id: RequestStatusEnum.Approved,
    translationKey: 'requestsManagement.orderReport.workflowStatus.completed',
    badgeClass: 'Approved',
    cardStatus: 'completed'
  },
  [RequestStatusEnum.Rejected]: {
    id: RequestStatusEnum.Rejected,
    translationKey: 'dashboard.statusLabels.rejected',
    badgeClass: 'Rejected',
    cardStatus: 'declined'
  },
  [RequestStatusEnum.Cancelled]: {
    id: RequestStatusEnum.Cancelled,
    translationKey: 'dashboard.statusLabels.cancelled',
    badgeClass: 'Cancelled',
    cardStatus: 'declined'
  },
  [RequestStatusEnum.ReturnedForReview]: {
    id: RequestStatusEnum.ReturnedForReview,
    translationKey: 'dashboard.statusLabels.returnedForReview',
    badgeClass: 'Returned',
    cardStatus: 'returned'
  },
  [RequestStatusEnum.AutoRejected]: {
    id: RequestStatusEnum.AutoRejected,
    translationKey: 'dashboard.statusLabels.autoRejected',
    badgeClass: 'AutoRejected',
    cardStatus: 'declined'
  }
};


export function getStatusMetadata(status: number | string | null | undefined): StatusMetadata {
  if (status === null || status === undefined) {
    return STATUS_METADATA[RequestStatusEnum.New];
  }

  let statusNum: RequestStatusEnum;

  if (typeof status === 'number') {
    statusNum = status as RequestStatusEnum;
  } else {
    const lower = status.toLowerCase().trim();
    if (lower === 'new' || lower === 'pending' || lower === '1') {
      statusNum = RequestStatusEnum.New;
    } else if (lower === 'underprocess' || lower === 'under process' || lower === 'inprogress' || lower === 'in progress' || lower === '2') {
      statusNum = RequestStatusEnum.UnderProcess;
    } else if (lower === 'approved' || lower === 'completed' || lower === 'confirmed' || lower === '3') {
      statusNum = RequestStatusEnum.Approved;
    } else if (lower === 'rejected' || lower === 'declined' || lower === '4') {
      statusNum = RequestStatusEnum.Rejected;
    } else if (lower === 'cancelled' || lower === '5') {
      statusNum = RequestStatusEnum.Cancelled;
    } else if (lower === 'returned' || lower === 'returnedforreview' || lower === '6') {
      statusNum = RequestStatusEnum.ReturnedForReview;
    } else if (lower === 'autorejected' || lower === 'auto rejected' || lower === 'auto-rejected' || lower === '7') {
      statusNum = RequestStatusEnum.AutoRejected;
    } else {
      statusNum = RequestStatusEnum.New;
    }
  }

  return STATUS_METADATA[statusNum] || STATUS_METADATA[RequestStatusEnum.New];
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
      case RequestStatusEnum.AutoRejected:
        return 'AutoRejected';
      case RequestStatusEnum.Cancelled:
        return 'Cancelled';
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
    if (statusLower === 'autorejected' || statusLower === 'auto rejected' || statusLower === 'auto-rejected' || statusLower === '7') {
      return 'AutoRejected';
    }
    if (statusLower === 'cancelled' || statusLower === 'canceled' || statusLower === '5') {
      return 'Cancelled';
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
export function mapApprovalStatus(status: number): 'Pending' | 'Approved' | 'Rejected' | 'AutoRejected' | 'Returned' | 'Cancelled' {
  switch (status) {
    case RequestStatusEnum.Approved:
      return 'Approved';
    case RequestStatusEnum.Rejected:
      return 'Rejected';
    case RequestStatusEnum.AutoRejected:
      return 'AutoRejected';
    case RequestStatusEnum.Cancelled:
      return 'Cancelled';
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
export function mapRequestItems(items: unknown[]): RequestItem[] {
  if (!items || items.length === 0) {
    return [];
  }

  return items
    .map(item => asRecord(item))
    .filter((item): item is LooseRecord => !!item && !!(item['id'] || item['itemId']))
    .map(item => {
      const nestedItem = asRecord(item['item']);
      const rawItemType = item['itemType'] ?? nestedItem?.['itemType'];
      const parsedItemType =
        rawItemType != null && rawItemType !== '' ? Number(rawItemType) : undefined;

      return {
        id: Number(item['id'] ?? 0), // RequestItem ID
        itemId: Number(item['itemId'] ?? item['id']) || undefined, // Item ID (prefer itemId, fallback to id)
        itemName: String(item['itemName'] ?? item['name'] ?? 'Unknown Item'),
        itemNo: String(item['itemNo'] ?? item['itemCode'] ?? item['code'] ?? '-'),
        quantity: Number(item['quantity'] ?? item['requestedQuantity'] ?? 0),
        unit: String(item['unit'] ?? item['unitName'] ?? '-'),
        nsn: typeof item['nsn'] === 'string' ? item['nsn'] : undefined,
        itemType: Number.isFinite(parsedItemType) ? parsedItemType : undefined
      };
    });
}

/**
 * Map approval history from backend format
 * @param history - Approval history array from backend
 * @param requestStatus - Optional base request status to filter pending steps if approved
 */
export function mapApprovalHistory(history: unknown[], requestStatus?: RequestStatus): WorkflowApprovalStep[] {
  if (!history || history.length === 0) {
    return [];
  }

  const mappedHistory = history
    .map(h => asRecord(h))
    .filter((h): h is LooseRecord => !!h && !!(h['id'] || h['workflowApprovalstepId'] || h['workflowStepId'] || h['workflowstepId']))
    .map((h, index): WorkflowApprovalStep => {
      // Backend now properly sets IsPending flag - trust it first
      // Fallback to checking changedBy and status if IsPending is not explicitly set
      const backendIsPending = h['isPending'] === true || h['IsPending'] === true;
      const hasChangedBy = !!h['changedBy'] || !!h['ChangedBy'];

      // Handle both string and number status values (backend might return either)
      const normalizeStatus = (status: unknown): number => {
        if (typeof status === 'number') return status;
        if (typeof status === 'string') {
          const lower = status.toLowerCase();
          if (lower === 'new' || lower === 'pending') return RequestStatusEnum.New;
          if (lower === 'underprocess' || lower === 'under process' || lower === 'inprogress' || lower === 'in progress') return RequestStatusEnum.UnderProcess;
          if (lower === 'approved' || lower === 'completed') return RequestStatusEnum.Approved;
          if (lower === 'rejected' || lower === 'declined') return RequestStatusEnum.Rejected;
          if (lower === 'cancelled') return RequestStatusEnum.Cancelled;
          if (lower === 'returnedforreview' || lower === 'returned') return RequestStatusEnum.ReturnedForReview;
          if (lower === 'autorejected' || lower === 'auto rejected' || lower === 'auto-rejected') return RequestStatusEnum.AutoRejected;
        }
        return 0;
      };

      const oldStatusNum = normalizeStatus(readField<unknown>(h, 'oldRequestStatus', 'OldRequestStatus'));
      const newStatusNum = normalizeStatus(readField<unknown>(h, 'newRequestStatus', 'NewRequestStatus'));

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

      const changedByVal = readField<string>(h, 'changedBy', 'ChangedBy');
      const approverNameEn = readField<string>(h, 'approverNameEn', 'ApproverNameEn');
      const approverNameAr = readField<string>(h, 'approverNameAr', 'ApproverNameAr');

      let approverName: string;
      if (isPending) {
        approverName =
          readField<string>(h, 'applicationRoleName', 'ApplicationRoleName') ||
          readField<string>(h, 'applicationRoleId', 'ApplicationRoleId') ||
          'Pending Approval';
      } else if (approverNameEn || approverNameAr) {
        approverName = (approverNameEn || approverNameAr) as string;
      } else {
        approverName = getApproverName(changedByVal);
      }

      const isDel = readField<unknown>(h, 'isDelegation', 'IsDelegation');
      const isDelegationFlag = isDel === true || isDel === 1 || String(isDel).toLowerCase() === 'true';

      return {
        id: Number(readField<number | string>(h, 'id') ?? index),
        workflowApprovalstepId: readField<number>(h, 'workflowApprovalstepId', 'WorkflowApprovalStepId'),
        workflowStepId: readField<number>(h, 'workflowStepId', 'workflowstepId', 'WorkflowStepId'),
        oldRequestStatus: readField<number>(h, 'oldRequestStatus', 'OldRequestStatus'),
        newRequestStatus: readField<number>(h, 'newRequestStatus', 'NewRequestStatus'),
        comments: readField<string>(h, 'comments', 'Comments'),
        changedBy: changedByVal,
        approverName: approverName,
        approverNameEn: approverNameEn,
        approverNameAr: approverNameAr,
        changedAt: readField<string | Date>(h, 'changedAt', 'ChangedAt'),
        steporder: Number(readField<number | string>(h, 'steporder', 'stepOrder', 'StepOrder') ?? index + 1),
        applicationRoleId: readField<string>(h, 'applicationRoleId', 'ApplicationRoleId'),
        status: status,
        approvedDate: readField<string | Date>(h, 'changedAt', 'ChangedAt') && !isPending
          ? formatApprovalDate(readField<string | Date>(h, 'changedAt', 'ChangedAt'))
          : undefined,
        approvedDateTime: readField<string | Date>(h, 'changedAt', 'ChangedAt') && !isPending
          ? formatApprovalDateTime(readField<string | Date>(h, 'changedAt', 'ChangedAt'))
          : undefined,
        applicationRoleName: readField<string>(h, 'applicationRoleName', 'ApplicationRoleName'),
        applicationRoleNameAr: readField<string>(h, 'applicationRoleNameAr', 'ApplicationRoleNameAr'),
        isPending: isPending,
        requireHigherApproval: Boolean(readField<unknown>(h, 'requireHigherApproval', 'RequireHigherApproval')),
        higherApprovalRoleId: readField<string>(h, 'higherApprovalRoleId', 'HigherApprovalRoleId'),
        isCurrentUserApprover: Boolean(readField<unknown>(h, 'isCurrentUserApprover', 'IsCurrentUserApprover')),
        canReturn: Boolean(readField<unknown>(h, 'canReturn', 'CanReturn')),
        isDelegation: isDelegationFlag,
        changedByRoleId: readField<string>(h, 'changedByRoleId', 'ChangedByRoleId'),
        changedByRoleName: readField<string>(h, 'changedByRoleName', 'ChangedByRoleName'),
        changedByRoleNameAr: readField<string>(h, 'changedByRoleNameAr', 'ChangedByRoleNameAr'),
        eligibleParallelRoleNamesEn: readField<string>(h, 'eligibleParallelRoleNamesEn', 'EligibleParallelRoleNamesEn'),
        eligibleParallelRoleNamesAr: readField<string>(h, 'eligibleParallelRoleNamesAr', 'EligibleParallelRoleNamesAr'),
        files: (readField<WorkflowApprovalStep['files']>(h, 'files', 'Files') ?? []),
        transitions: (readField<WorkflowApprovalStep['transitions']>(h, 'transitions', 'Transitions') ?? [])
      };
    });

  // AutoRejected: keep API sequence — log ids can be zero for pending placeholders and diverge from workflow order.
  // Other statuses: sort by approval log id for return/re-pending so newer steps follow older ones.
  const orderedHistory =
    requestStatus === 'AutoRejected'
      ? mappedHistory
      : [...mappedHistory].sort((a, b) => (a.id || 0) - (b.id || 0));

  // If base request is approved, filter out pending steps
  if (requestStatus === 'Approved') {
    return orderedHistory.filter(step => step.status !== 'Pending');
  }

  return orderedHistory;
}

/**
 * Extract approver name from changedBy field
 */
export function getApproverName(changedBy?: string): string {
  if (!changedBy) return 'Unknown Approver';

  // User id (GUID) — do not treat as email local-part
  const guidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    changedBy.trim()
  );
  if (guidLike) {
    return 'Unknown Approver';
  }

  const parts = changedBy.split('@');
  if (parts.length > 1) {
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
    rawStatus: data.status,
    requestDate: formatRequestDate(data.requestDate),
    reason: data.reason,
    notes: data.notes,
    departmentName: data.departmentName,
    departmentNameAr: data.departmentNameAr,
    departmentNameEn: data.departmentNameEn,
    requesterName: data.requesterName,
    requesterNameEn: data.requesterNameEn,
    requesterNameAr: data.requesterNameAr,
    requesterId: data.requesterId,
    requesterUserName: data.requesterUserName,
    requestPurposeName: data.requestPurposeName,
    requestPurposeNameAr: data.requestPurposeNameAr,
    requestPurposeNameEn: data.requestPurposeNameEn,
    requestPurposeNotes: data.requestPurposeNotes,
    requestItems: mapRequestItems(data.requestItems || []),
    approvalHistory: mapApprovalHistory(data.approvalHistory || [], requestStatus),
    // Usage-related fields
    usageLocation: data.usageLocation,
    usagePurpose: data.usagePurpose,
    usageDateFrom: data.usageDateFrom ? formatRequestDate(data.usageDateFrom) : undefined,
    usageTimeFrom: data.usageTimeFrom,
    usageDateTo: data.usageDateTo ? formatRequestDate(data.usageDateTo) : undefined,
    usageTimeTo: data.usageTimeTo,
    numberOfOfficer: data.numberOfOfficer,
    numberOfOtherRank: data.numberOfOtherRank,
    isFromAllowance: data.isFromAllowance,
    creationDate: data.creationDate,
    supplyDate: data.supplyDate ?? undefined,
    // Return-specific fields
    returnToDepotId: data.returnToDepotId,
    returnToDepotNameAr: data.returnToDepot?.nameAr,
    returnToDepotNameEn: data.returnToDepot?.nameEn,
    deliveryDate: data.deliveryDate ?? undefined,
    isMyTurn: data.isMyTurn === true,
  };
}


