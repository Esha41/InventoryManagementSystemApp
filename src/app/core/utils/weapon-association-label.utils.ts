import { ItemType, normalizeItemType } from '@models/inventory.model';
import type { RequestManagementRequestItemWeaponAssociationDto } from '@models/request-management-base.model';
import { getLocalizedName } from '@utils/localization.utils';

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
