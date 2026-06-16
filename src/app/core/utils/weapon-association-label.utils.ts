import { ItemType, normalizeItemType } from '@models/inventory.model';
import type { RequestManagementRequestItemWeaponAssociationDto } from '@models/request-management-base.model';
import { getLocalizedName } from '@utils/localization.utils';
import {
  areCatalogItemCalibersCompatible,
  hasCatalogItemCaliber
} from '@utils/catalog-caliber.utils';

export interface WeaponAssociationLabelItem {
  itemType?: number | string;
  itemCaliberId?: number | null;
  itemCaliberNameEn?: string | null;
  itemCaliberNameAr?: string | null;
  weaponAssociations?: RequestManagementRequestItemWeaponAssociationDto[] | null;
}

export interface CatalogCaliberContext {
  caliberId?: number | null;
  caliberNameEn?: string | null;
  caliberNameAr?: string | null;
  caliber?: string | null;
}

export function isAmmunitionItem(item: WeaponAssociationLabelItem | null | undefined): boolean {
  if (!item) {
    return false;
  }

  return normalizeItemType(item.itemType) === ItemType.Ammunition;
}

export function hasWeaponAssociations(item: WeaponAssociationLabelItem | null | undefined): boolean {
  return isAmmunitionItem(item) && (item?.weaponAssociations?.length ?? 0) > 0;
}

export interface WeaponAssociationDisplay {
  title: string;
  isCustom: boolean;
}

export function getWeaponAssociationDisplay(
  association: RequestManagementRequestItemWeaponAssociationDto | null | undefined,
  lang?: string
): WeaponAssociationDisplay {
  const customName = association?.associatedWeaponOtherName?.trim();
  if (customName) {
    return { title: customName, isCustom: true };
  }

  const weaponItemId = association?.associatedWeaponItemId;
  if (weaponItemId != null && weaponItemId > 0 && association) {
    const en = (association.associatedWeaponName ?? '').trim();
    const row = association as { associatedWeaponNameAR?: string | null };
    const ar = (association.associatedWeaponNameAr ?? row.associatedWeaponNameAR ?? '').trim();
    if (lang) {
      const title =
        getLocalizedName({ nameEn: en || undefined, nameAr: ar || undefined }, lang)?.trim() || en || ar;
      if (title) {
        return { title, isCustom: false };
      }
    } else if (en) {
      return { title: en, isCustom: false };
    }
    return { title: `Weapon #${weaponItemId}`, isCustom: false };
  }

  return { title: '—', isCustom: false };
}

export function getWeaponAssociationLabel(
  association: RequestManagementRequestItemWeaponAssociationDto | null | undefined,
  customSuffix = 'Custom',
  lang?: string
): string {
  const display = getWeaponAssociationDisplay(association, lang);
  if (display.isCustom) {
    return `${display.title} (${customSuffix})`;
  }

  return display.title;
}

export function isCatalogWeaponAssociation(
  association: RequestManagementRequestItemWeaponAssociationDto | null | undefined
): boolean {
  const weaponItemId = association?.associatedWeaponItemId;
  return weaponItemId != null && weaponItemId > 0;
}

export function buildAmmunitionCaliberContextFromRequestItem(
  item: WeaponAssociationLabelItem | null | undefined
): CatalogCaliberContext | null {
  if (!isAmmunitionItem(item) || !item) {
    return null;
  }

  const caliberId = item.itemCaliberId;
  const caliberNameEn = item.itemCaliberNameEn?.trim() || null;
  const caliberNameAr = item.itemCaliberNameAr?.trim() || null;
  if ((caliberId == null || caliberId <= 0) && !caliberNameEn && !caliberNameAr) {
    return null;
  }

  return {
    caliberId,
    caliberNameEn,
    caliberNameAr
  };
}

export function buildWeaponCaliberContextFromAssociation(
  association: RequestManagementRequestItemWeaponAssociationDto
): CatalogCaliberContext {
  return {
    caliberId: association.associatedWeaponCatalogCaliberId,
    caliberNameEn: association.associatedWeaponCatalogCaliberNameEn,
    caliberNameAr: association.associatedWeaponCatalogCaliberNameAr
  };
}

export function shouldShowWeaponAssociationCompatibilityBadge(
  ammunitionCaliber: CatalogCaliberContext | null | undefined,
  association: RequestManagementRequestItemWeaponAssociationDto
): boolean {
  if (!ammunitionCaliber || !isCatalogWeaponAssociation(association)) {
    return false;
  }
  return hasCatalogItemCaliber(buildWeaponCaliberContextFromAssociation(association));
}

export function isWeaponAssociationCaliberCompatible(
  ammunitionCaliber: CatalogCaliberContext | null | undefined,
  association: RequestManagementRequestItemWeaponAssociationDto
): boolean {
  if (!ammunitionCaliber) {
    return false;
  }
  return areCatalogItemCalibersCompatible(
    ammunitionCaliber,
    buildWeaponCaliberContextFromAssociation(association)
  );
}

export function isIncompatibleWeaponAssociation(
  item: WeaponAssociationLabelItem | null | undefined,
  association: RequestManagementRequestItemWeaponAssociationDto
): boolean {
  const ammoCaliber = buildAmmunitionCaliberContextFromRequestItem(item);
  if (!ammoCaliber) {
    return false;
  }
  return (
    shouldShowWeaponAssociationCompatibilityBadge(ammoCaliber, association) &&
    !isWeaponAssociationCaliberCompatible(ammoCaliber, association)
  );
}

export function hasIncompatibleWeaponAssociationsOnItem(
  item: WeaponAssociationLabelItem | null | undefined
): boolean {
  if (!hasWeaponAssociations(item)) {
    return false;
  }
  const ammoCaliber = buildAmmunitionCaliberContextFromRequestItem(item);
  if (!ammoCaliber) {
    return false;
  }
  return (item?.weaponAssociations ?? []).some(
    assoc => isIncompatibleWeaponAssociation(item, assoc)
  );
}

export function hasAnyIncompatibleWeaponAssociations(
  items: readonly WeaponAssociationLabelItem[] | null | undefined
): boolean {
  return (items ?? []).some(item => hasIncompatibleWeaponAssociationsOnItem(item));
}
