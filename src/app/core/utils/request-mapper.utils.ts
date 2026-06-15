/**
 * Request Mapper Utilities
 * Functions for mapping backend DTOs to frontend models
 */

import { RequestType, Priority, RequestStatus, RequestItem, WorkflowApprovalStep, RequestDetail, BaseRequestDto } from '@models/workflow-approval.model';
import { formatTimeToMilitary, formatDateShort } from '@utils/format.utils';
import { normalizeItemType } from '@models/inventory.model';
import type { RequestManagementRequestItemWeaponAssociationDto } from '@models/request-management-base.model';

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

import {
  RequestPriority as PriorityEnum,
  RequestStatus as RequestStatusEnum,
  RequestType as RequestTypeEnum
} from '@models/backend-enums';

export {
  RequestType as RequestTypeEnum,
  RequestPriority as PriorityEnum,
  RequestStatus as RequestStatusEnum
} from '@models/backend-enums';


export interface StatusMetadata {
  id: RequestStatusEnum;
  translationKey: string;
  badgeClass: string; // Keys for `getRequestStatusBadgeClass` (e.g. New, InProgress, Approved)
  cardStatus: string; // 'new' | 'on-progress' | 'completed' | 'declined' | 'cancelled' | 'returned'
}

export const STATUS_METADATA: Record<RequestStatusEnum, StatusMetadata> = {
  [RequestStatusEnum.New]: {
    id: RequestStatusEnum.New,
    translationKey: 'dashboard.statusLabels.new',
    badgeClass: 'New',
    cardStatus: 'new'
  },
  [RequestStatusEnum.UnderProcess]: {
    id: RequestStatusEnum.UnderProcess,
    translationKey: 'dashboard.statusLabels.underProcess',
    badgeClass: 'InProgress',
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
    cardStatus: 'cancelled'
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


export function getStatusMetadata(status: number | null | undefined): StatusMetadata {
  if (status === null || status === undefined) {
    return STATUS_METADATA[RequestStatusEnum.New];
  }
  const statusNum = status as RequestStatusEnum;
  return STATUS_METADATA[statusNum] ?? STATUS_METADATA[RequestStatusEnum.New];
}

/**
 * Map numeric or string request type to string
 */
export function mapRequestType(type: number): RequestType {
  switch (type) {
    case RequestTypeEnum.Return:
      return 'Return';
    case RequestTypeEnum.Discard:
      return 'Discard';
    case RequestTypeEnum.Order:
    default:
      return 'Order';
  }
}


export function mapPriority(priority: number): Priority {
  switch (priority) {
    case PriorityEnum.Normal:
      return 'Normal';
    case PriorityEnum.VeryUrgent:
      return 'VeryUrgent';
    case PriorityEnum.Urgent:
    default:
      return 'Urgent';
  }
}

/**
 * Map numeric or string request status to string
 */
export function mapRequestStatus(status: number): RequestStatus {
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
function mapWeaponAssociationRows(
  rows: unknown
): RequestManagementRequestItemWeaponAssociationDto[] | undefined {
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }

  const mapped = rows
    .map(row => asRecord(row))
    .filter((row): row is LooseRecord => !!row)
    .map(row => ({
      id: Number(readField<unknown>(row, 'id', 'Id') ?? 0),
      associatedWeaponItemId: readField<number | null>(row, 'associatedWeaponItemId', 'AssociatedWeaponItemId') ?? null,
      associatedWeaponOtherName: readField<string | null>(row, 'associatedWeaponOtherName', 'AssociatedWeaponOtherName') ?? null,
      associatedWeaponCaliberId: readField<number | null>(row, 'associatedWeaponCaliberId', 'AssociatedWeaponCaliberId') ?? null,
      associatedWeaponName: readField<string | null>(row, 'associatedWeaponName', 'AssociatedWeaponName') ?? null,
      associatedWeaponNameAr: readField<string | null>(row, 'associatedWeaponNameAr', 'AssociatedWeaponNameAr') ?? null,
      associatedWeaponCatalogCaliberId:
        readField<number | null>(row, 'associatedWeaponCatalogCaliberId', 'AssociatedWeaponCatalogCaliberId') ?? null,
      associatedWeaponCatalogCaliberNameEn:
        readField<string | null>(row, 'associatedWeaponCatalogCaliberNameEn', 'AssociatedWeaponCatalogCaliberNameEn') ??
        null,
      associatedWeaponCatalogCaliberNameAr:
        readField<string | null>(row, 'associatedWeaponCatalogCaliberNameAr', 'AssociatedWeaponCatalogCaliberNameAr') ??
        null
    }));

  return mapped.length > 0 ? mapped : undefined;
}

export function mapRequestItems(items: unknown[]): RequestItem[] {
  if (!items || items.length === 0) {
    return [];
  }

  return items
    .map(item => asRecord(item))
    .filter((item): item is LooseRecord => !!item && !!(
      readField<unknown>(item, 'id', 'Id') || readField<unknown>(item, 'itemId', 'ItemId')
    ))
    .map(item => {
      const nestedItem = asRecord(item['item'] ?? item['Item']);
      const rawItemType = readField<unknown>(item, 'itemType', 'ItemType') ?? readField<unknown>(nestedItem ?? {}, 'itemType', 'ItemType');
      const normalizedItemType = normalizeItemType(rawItemType);

      const rawItemNameAr = readField<unknown>(item, 'itemNameAr', 'ItemNameAr');
      const itemNameAr =
        rawItemNameAr != null && String(rawItemNameAr).trim() !== '' ? String(rawItemNameAr).trim() : undefined;

      return {
        id: Number(readField<unknown>(item, 'id', 'Id') ?? 0), // RequestItem ID
        itemId: Number(readField<unknown>(item, 'itemId', 'ItemId') ?? readField<unknown>(item, 'id', 'Id')) || undefined, // Item ID (prefer itemId, fallback to id)
        itemName: String(readField<unknown>(item, 'itemName', 'ItemName') ?? item['name'] ?? 'Unknown Item'),
        itemNameAr,
        itemNo: String(readField<unknown>(item, 'itemNo', 'ItemNo') ?? item['itemCode'] ?? item['code'] ?? '-'),
        quantity: Number(readField<unknown>(item, 'quantity', 'Quantity') ?? item['requestedQuantity'] ?? 0),
        unit: String(readField<unknown>(item, 'unit', 'Unit') ?? item['unitName'] ?? '-'),
        nsn: typeof readField<unknown>(item, 'nsn', 'Nsn') === 'string' ? String(readField<unknown>(item, 'nsn', 'Nsn')) : undefined,
        itemType: normalizedItemType > 0 ? normalizedItemType : undefined,
        itemCaliberId: readField<number | null>(item, 'itemCaliberId', 'ItemCaliberId') ?? null,
        itemCaliberNameEn: readField<string | null>(item, 'itemCaliberNameEn', 'ItemCaliberNameEn') ?? null,
        itemCaliberNameAr: readField<string | null>(item, 'itemCaliberNameAr', 'ItemCaliberNameAr') ?? null,
        weaponAssociations: mapWeaponAssociationRows(
          readField<unknown[]>(item, 'weaponAssociations', 'WeaponAssociations')
        )
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


