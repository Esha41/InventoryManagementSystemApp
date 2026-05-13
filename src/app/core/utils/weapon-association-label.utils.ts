import { ItemType, normalizeItemType } from '@models/inventory.model';
import type { RequestManagementRequestItemWeaponAssociationDto } from '@models/request-management-base.model';

export interface WeaponAssociationLabelItem {
  itemType?: number | string;
  weaponAssociations?: RequestManagementRequestItemWeaponAssociationDto[] | null;
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
  association: RequestManagementRequestItemWeaponAssociationDto | null | undefined
): WeaponAssociationDisplay {
  const customName = association?.associatedWeaponOtherName?.trim();
  if (customName) {
    return { title: customName, isCustom: true };
  }

  if (association?.associatedWeaponName) {
    return { title: association.associatedWeaponName, isCustom: false };
  }

  if (association?.associatedWeaponItemId) {
    return { title: `Weapon #${association.associatedWeaponItemId}`, isCustom: false };
  }

  return { title: '—', isCustom: false };
}

export function getWeaponAssociationLabel(
  association: RequestManagementRequestItemWeaponAssociationDto | null | undefined,
  customSuffix = 'Custom'
): string {
  const display = getWeaponAssociationDisplay(association);
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
