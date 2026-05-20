/**
 * Display labels for backend numeric enums (UI only — not sent to API).
 */

import {
  ActionType,
  AmmunitionType,
  AssetStatus,
  AutoRejectTriggerMode,
  ExplosiveType,
  ItemType,
  RequestPriority,
  RequestStatus,
  RequestType,
  SupplySubmissionStatus,
  WeaponType
} from '@models/backend-enums';

function enumKeyLabel(enumObj: Record<string, string | number>, value: number): string {
  const key = Object.keys(enumObj).find(
    k => enumObj[k as keyof typeof enumObj] === value && Number.isNaN(Number(k))
  );
  if (!key) return 'Unknown';
  return key.replace(/([A-Z])/g, ' $1').trim();
}

export function getRequestTypeLabel(type: RequestType): string {
  return enumKeyLabel(RequestType, type);
}

export function getRequestStatusLabel(status: RequestStatus): string {
  return enumKeyLabel(RequestStatus, status);
}

export function getRequestPriorityLabel(priority: RequestPriority): string {
  return enumKeyLabel(RequestPriority, priority);
}

export function getItemTypeLabel(type: ItemType): string {
  return enumKeyLabel(ItemType, type);
}

export function getAssetStatusLabel(status: AssetStatus): string {
  return enumKeyLabel(AssetStatus, status);
}

export function getAmmunitionTypeLabel(type: AmmunitionType): string {
  return enumKeyLabel(AmmunitionType, type);
}

export function getWeaponTypeLabel(type: WeaponType): string {
  return enumKeyLabel(WeaponType, type);
}

export function getActionTypeLabel(type: ActionType): string {
  return enumKeyLabel(ActionType, type);
}

export function getExplosiveTypeLabel(type: ExplosiveType): string {
  return enumKeyLabel(ExplosiveType, type);
}

export function getAutoRejectTriggerModeLabel(mode: AutoRejectTriggerMode): string {
  return enumKeyLabel(AutoRejectTriggerMode, mode);
}

export function getSupplySubmissionStatusLabel(status: SupplySubmissionStatus): string {
  return enumKeyLabel(SupplySubmissionStatus, status);
}

/** i18n key under `dashboard.statusLabels.*` */
export function getRequestStatusTranslationKey(status: RequestStatus): string {
  const keys: Record<RequestStatus, string> = {
    [RequestStatus.New]: 'dashboard.statusLabels.new',
    [RequestStatus.UnderProcess]: 'dashboard.statusLabels.underProcess',
    [RequestStatus.Approved]: 'dashboard.statusLabels.approved',
    [RequestStatus.Rejected]: 'dashboard.statusLabels.rejected',
    [RequestStatus.Cancelled]: 'dashboard.statusLabels.cancelled',
    [RequestStatus.ReturnedForReview]: 'dashboard.statusLabels.returnedForReview',
    [RequestStatus.AutoRejected]: 'dashboard.statusLabels.autoRejected'
  };
  return keys[status] ?? 'dashboard.statusLabels.new';
}

/** i18n key for draft supply list submission status */
export function getSupplySubmissionStatusTranslationKey(status: SupplySubmissionStatus): string {
  return status === SupplySubmissionStatus.Submitted
    ? 'workflowApprovalDetail.workflowSupplySummary.submissionSubmitted'
    : 'workflowApprovalDetail.workflowSupplySummary.submissionDraft';
}

/** Spaced label for lookup NameEn contains filters (weapon/explosive catalog). */
export function spacedEnumKeyLabel(enumKey: string): string {
  return enumKey.replace(/([A-Z])/g, ' $1').trim();
}
