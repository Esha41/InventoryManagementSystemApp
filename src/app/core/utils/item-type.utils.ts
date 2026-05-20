/**
 * Item type utilities for Ammunition (1), Weapon (2), Explosive (3).
 */

import { ItemType } from '@models/backend-enums';

export function isAmmunitionType(itemType: number | undefined): boolean {
  return itemType === ItemType.Ammunition;
}

export function isWeaponType(itemType: number | undefined): boolean {
  return itemType === ItemType.Weapon;
}

export function isExplosiveType(itemType: number | undefined): boolean {
  return itemType === ItemType.Explosive;
}

export function getItemTypeName(itemType: number | undefined): string {
  if (itemType === undefined || itemType === null) return 'Unknown';
  switch (itemType) {
    case ItemType.Ammunition:
      return 'Ammunition';
    case ItemType.Weapon:
      return 'Weapon';
    case ItemType.Explosive:
      return 'Explosive';
    case ItemType.Accessory:
      return 'Accessory';
    default:
      return 'Unknown';
  }
}

/** Map itemType to asset-list tab query param. */
export function getAssetDetailsTab(itemType: number | undefined): 'ammunition' | 'weapon' | 'explosive' | null {
  if (itemType === undefined || itemType === null) return null;
  switch (itemType) {
    case ItemType.Ammunition:
      return 'ammunition';
    case ItemType.Weapon:
      return 'weapon';
    case ItemType.Explosive:
      return 'explosive';
    default:
      return null;
  }
}
