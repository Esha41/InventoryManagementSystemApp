/**
 * Item type utilities for Ammunition (1), Weapon (2), Explosive (3).
 * Backend may return itemType as number or string.
 */

export function isAmmunitionType(itemType: number | string | undefined): boolean {
  if (itemType === undefined || itemType === null) return false;
  if (typeof itemType === 'string') return itemType.trim().toLowerCase() === 'ammunition';
  return itemType === 1;
}

export function isWeaponType(itemType: number | string | undefined): boolean {
  if (itemType === undefined || itemType === null) return false;
  if (typeof itemType === 'string') return itemType.trim().toLowerCase() === 'weapon';
  return itemType === 2;
}

export function isExplosiveType(itemType: number | string | undefined): boolean {
  if (itemType === undefined || itemType === null) return false;
  if (typeof itemType === 'string') return itemType.trim().toLowerCase() === 'explosive';
  return itemType === 3;
}

export function getItemTypeName(itemType: number | string | undefined): string {
  if (itemType === undefined || itemType === null) return 'Unknown';
  if (typeof itemType === 'string') {
    const normalized = itemType.trim();
    if (normalized === 'Ammunition' || normalized === 'Weapon' || normalized === 'Explosive') return normalized;
    const numValue = parseInt(normalized, 10);
    if (!isNaN(numValue)) return getItemTypeName(numValue);
    return normalized || 'Unknown';
  }
  if (typeof itemType === 'number') {
    switch (itemType) {
      case 1: return 'Ammunition';
      case 2: return 'Weapon';
      case 3: return 'Explosive';
      default: return 'Unknown';
    }
  }
  return 'Unknown';
}

/** Map itemType to asset-list tab query param. */
export function getAssetDetailsTab(itemType: number | string | undefined): 'ammunition' | 'weapon' | 'explosive' | null {
  if (itemType === undefined || itemType === null) return null;
  if (typeof itemType === 'string') {
    const n = itemType.trim().toLowerCase();
    if (n === 'ammunition') return 'ammunition';
    if (n === 'weapon') return 'weapon';
    if (n === 'explosive') return 'explosive';
    return null;
  }
  switch (itemType) {
    case 1: return 'ammunition';
    case 2: return 'weapon';
    case 3: return 'explosive';
    default: return null;
  }
}
