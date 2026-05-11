/**
 * Supply Order Formatting Utilities
 * Extracted formatting/display logic from supply-order.component.ts
 * Following Angular best practices: extract formatting logic to utils
 */

import { OrderDto, OrderRequestItemDto } from '@models/order.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { ExplosiveDto } from '@models/explosive.model';
import { SupplyItemDisplay } from '@models/supply-order.model';
import { WorkflowApprovalStep } from '@models/workflow-approval.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
import { getPriorityKey } from '@utils/priority.utils';

/**
 * Get priority translation key
 * Handles both number and string priority values
 * Returns translation key (e.g., 'common.priorityLevels.Normal')
 */
export function getPriorityTranslationKey(priority?: number | string | null): string {
  if (priority === null || priority === undefined) {
    return 'common.priorityLevels.Urgent';
  }

  return `common.priorityLevels.${getPriorityKey(priority)}`;
}

/**
 * Resolve usage purpose with proper localization
 */
export function resolveUsagePurpose(orderData: OrderDto | null, translateService: TranslateService): string {
  if (!orderData) {
    return 'N/A';
  }
  const currentLang = getCurrentLang(translateService);

  // Try nested object first (current backend structure)
  if (orderData.requestPurpose) {
    return getLocalizedName(
      {
        nameEn: orderData.requestPurpose.nameEn,
        nameAr: orderData.requestPurpose.nameAr
      },
      currentLang
    ) || orderData.usagePurpose || 'N/A';
  }

  // Fallback to flattened properties
  return getLocalizedName(
    {
      nameEn: orderData.requestPurposeNameEn,
      nameAr: orderData.requestPurposeNameAr
    },
    currentLang
  ) || orderData.usagePurpose || 'N/A';
}

/**
 * Resolve department name with proper localization
 */
export function resolveDepartmentName(orderData: OrderDto | null, translateService: TranslateService): string {
  if (!orderData) return 'N/A';
  const currentLang = getCurrentLang(translateService);

  // Use nested department object if available (for proper localization)
  if (orderData.department) {
    const localized = getLocalizedName(orderData.department, currentLang);
    if (localized) return localized;
  }

  // Fallback to flattened properties
  if (orderData.departmentNameEn || orderData.departmentNameAr) {
    const localized = getLocalizedName(
      {
        nameEn: orderData.departmentNameEn,
        nameAr: orderData.departmentNameAr
      },
      currentLang
    );
    if (localized) return localized;
  }

  return 'N/A';
}

/**
 * Resolve requester name with proper localization
 */
export function resolveRequesterName(orderData: OrderDto | null, translateService: TranslateService): string {
  if (!orderData) return 'N/A';
  const currentLang = getCurrentLang(translateService);

  // Use nested requester object if available (for proper localization)
  if (orderData.requester) {
    const localized = getLocalizedName(orderData.requester, currentLang);
    if (localized) return localized;
    if (orderData.requester.userName) return orderData.requester.userName;
  }

  // Fallback to flattened property
  if (orderData.requesterName) return orderData.requesterName;

  return 'N/A';
}

/**
 * Get approval status translation key
 */
export function getApprovalStatusTranslationKey(status: string): string {
  const statusLower = status?.toLowerCase().trim() || '';
  if (statusLower === 'approved') {
    return 'requestsManagement.orderReport.workflowStatus.completed';
  } else if (statusLower === 'rejected') {
    return 'dashboard.statusLabels.rejected';
  } else if (statusLower === 'pending') {
    return 'dashboard.statusLabels.underProcess';
  }
  return 'dashboard.statusLabels.new';
}

/**
 * Get localized approver name based on current language
 */
export function getApproverName(approval: WorkflowApprovalStep, translationService: TranslationService): string {
  const currentLang = translationService.getCurrentLanguage();

  // For pending steps, use role name (not user name)
  if (approval.isPending) {
    if (currentLang === 'ar' && approval.applicationRoleNameAr) {
      return approval.applicationRoleNameAr;
    } else if (approval.applicationRoleName) {
      return approval.applicationRoleName;
    }
  }

  // For completed steps, use user name
  if (currentLang === 'ar' && approval.approverNameAr) {
    return approval.approverNameAr;
  } else if (approval.approverNameEn) {
    return approval.approverNameEn;
  } else if (approval.approverName) {
    return approval.approverName;
  }

  return '';
}

/**
 * Get item display name fallback
 */
function getItemDisplayName(itemId: number): string {
  return `Item #${itemId}`;
}

/**
 * Get localized display name for an order item (request item)
 */
export function getLocalizedOrderItemName(
  item: OrderRequestItemDto | null | undefined,
  translateService: TranslateService
): string {
  if (!item) return '';

  const lang = getCurrentLang(translateService);
  type OrderRequestItemWithMaybeNestedItem = OrderRequestItemDto & {
    item?: { nameEn?: string | null; nameAr?: string | null; name?: string | null } | null;
  };
  const typed = item as OrderRequestItemWithMaybeNestedItem;

  // Prefer localizing the nested item object if available; otherwise fall back to itemName.
  const localizedFromNested = getLocalizedName(typed.item ?? null, lang);
  const localized = localizedFromNested || typed.itemName;

  const id = typed.itemId || typed.id || 0;

  return localized || getItemDisplayName(id);
}

/**
 * Get localized name for a supply item display row
 */
export function getSupplyItemDisplayName(
  item: SupplyItemDisplay,
  translateService: TranslateService
): string {
  const lang = getCurrentLang(translateService);
  type SupplyItemDisplayWithMaybeNestedItem = SupplyItemDisplay & {
    item?: { nameEn?: string | null; nameAr?: string | null; name?: string | null } | null;
  };
  const typed = item as SupplyItemDisplayWithMaybeNestedItem;

  const localizedFromNested = getLocalizedName(typed.item ?? null, lang);
  const localized = localizedFromNested || typed.itemName;

  const id = typed.itemId || (typed as { id?: number }).id || 0;

  return localized || getItemDisplayName(id);
}

/**
 * Get department name (simple version without nested object support)
 * Used for backward compatibility
 */
export function getDepartmentName(orderData: OrderDto | null, translateService: TranslateService): string {
  if (!orderData) return 'N/A';
  const lang = getCurrentLang(translateService);
  const nameEn = orderData.departmentNameEn;
  const nameAr = orderData.departmentNameAr;

  if (lang === 'ar') {
    return nameAr || nameEn || 'N/A';
  }

  return nameEn || nameAr || 'N/A';
}

export type ItemManagementOptionSource = OrderRequestItemDto | AmmunitionReadDto | ExplosiveDto;

function isOrderRequestItemOption(item: ItemManagementOptionSource): item is OrderRequestItemDto {
  return 'itemId' in item;
}

/**
 * Get item management option label
 */
export function getItemManagementOptionLabel(
  item: ItemManagementOptionSource | null | undefined,
  translateService: TranslateService
): string {
  if (!item) return '';

  if (!isOrderRequestItemOption(item)) {
    const lang = getCurrentLang(translateService);
    const localizedName = getLocalizedName(
      { nameEn: item.name, nameAr: item.name, name: item.name },
      lang
    );
    return localizedName || item.itemNo || `Item #${item.id}`;
  }

  const lang = getCurrentLang(translateService);
  type OrderRequestItemOptionLike = OrderRequestItemDto & {
    item?: { nameEn?: string | null; nameAr?: string | null; name?: string | null } | null;
  };
  const typed = item as OrderRequestItemOptionLike;
  const localizedName = getLocalizedName(typed.item ?? null, lang);

  return localizedName || typed.itemNo || `Item #${typed.id}`;
}

/**
 * Get item product ID
 */
export function getItemProductId(item: OrderRequestItemDto): string {
  if (item.itemNo) {
    return item.itemNo;
  }
  return '-';
}
