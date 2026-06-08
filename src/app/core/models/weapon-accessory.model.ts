/**
 * Weapon–accessory link models matching backend DTOs
 */

export interface WeaponAccessoryItemSummaryDto {
  id: number;
  itemNo: string;
  name: string;
  nameAr?: string | null;
}

export interface WeaponAccessoryDto {
  weaponId: number;
  accessoryId: number;
  defaultQuantity: number;
  accessory?: WeaponAccessoryItemSummaryDto | null;
  weapon?: WeaponAccessoryItemSummaryDto | null;
}

export interface CreateUpdateWeaponAccessoryDto {
  weaponId: number;
  accessoryId: number;
  defaultQuantity: number;
}

export interface WeaponAccessoryQuantityDto {
  accessoryId: number;
  defaultQuantity: number;
}

export interface BulkReplaceWeaponAccessoriesDto {
  weaponId: number;
  accessories: WeaponAccessoryQuantityDto[];
}
