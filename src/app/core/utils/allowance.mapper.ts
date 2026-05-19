/**
 * Allowance Mapper Utilities
 */

import {
  AllowanceItemDto,
  AllowanceItemDetailDto,
  AllowanceTableRow,
  AllowanceItemType,
} from '@models/allowance.model';

/** Re-export for consumers importing from allowance.mapper */
export type { AllowanceItemType };
import { DepartmentDto } from '@services/lookup.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { LookupItem } from '@models/lookup.model';
import { getLocalizedName } from './localization.utils';
import { ItemType } from '@models/inventory.model';

interface AllowanceDisplayItem {
  name?: string;
  itemNo?: string;
  batchNo?: string;
}

export interface ProcessedAllowanceData {
  departments: LookupItem[];
  allItems: AllowanceItemType[];
  allAllowances: AllowanceTableRow[];
}

export function processAllowanceData(
  items: AllowanceItemDto[],
  departments: DepartmentDto[],
  ammunitionItems: AmmunitionReadDto[],
  weaponItems: WeaponDto[],
  explosiveItems: ExplosiveDto[],
  currentLang: string = 'en'
): ProcessedAllowanceData {
  const departmentsList: LookupItem[] = departments.map(dept => ({
    id: dept.id,
    nameEn: dept.nameEn,
    nameAr: dept.nameAr,
    code: dept.code
  } as LookupItem));

  const departmentMap = new Map<number, string>();
  departments.forEach(dept => {
    if (dept.id !== undefined) {
      departmentMap.set(dept.id, getLocalizedName(dept, currentLang) || `Department ${dept.id}`);
    }
  });

  // Create maps for all item types
  const ammunitionMap = new Map<number, AmmunitionReadDto>();
  ammunitionItems.forEach(ammo => {
    ammunitionMap.set(ammo.id, ammo);
  });

  const weaponMap = new Map<number, WeaponDto>();
  weaponItems.forEach(weapon => {
    weaponMap.set(weapon.id, weapon);
  });

  const explosiveMap = new Map<number, ExplosiveDto>();
  explosiveItems.forEach(explosive => {
    explosiveMap.set(explosive.id, explosive);
  });

  // Helper function to get item by type
  const getItemById = (itemId: number, itemType?: ItemType): AllowanceItemType | undefined => {
    if (itemType === ItemType.Weapon) {
      return weaponMap.get(itemId);
    } else if (itemType === ItemType.Explosive) {
      return explosiveMap.get(itemId);
    } else {
      // Default to Ammunition (ItemType.Ammunition = 1)
      return ammunitionMap.get(itemId);
    }
  };

  const getDisplayFields = (item: AllowanceItemType | undefined): AllowanceDisplayItem => {
    if (!item) {
      return {};
    }

    const candidate = item as Partial<AllowanceDisplayItem>;
    return {
      name: candidate.name,
      itemNo: candidate.itemNo,
      batchNo: candidate.batchNo
    };
  };

  /** Prefer full catalog row (bilingual), then API itemName/itemNameAr, then English fallbacks. */
  const resolveLocalizedItemLabel = (
    dto: AllowanceItemDto,
    itemData: AllowanceItemType | undefined,
    displayFields: AllowanceDisplayItem
  ): string => {
    const fromCatalog = itemData ? (getLocalizedName(itemData, currentLang) || '').trim() : '';
    if (fromCatalog) return fromCatalog;
    const fromApiPair = getLocalizedName(
      {
        name: dto.itemName ?? undefined,
        nameAr: dto.itemNameAr ?? (dto as { itemNameAR?: string | null }).itemNameAR ?? undefined
      },
      currentLang
    ).trim();
    if (fromApiPair) return fromApiPair;
    return dto.itemName?.trim() || displayFields.name?.trim() || '';
  };

  const groupedItems = new Map<string, AllowanceItemDetailDto[]>();

  items.forEach(item => {
    const itemData = getItemById(item.itemId, item.itemType);
    const key = `${item.departmentId}_${item.year}`;

    if (!groupedItems.has(key)) {
      groupedItems.set(key, []);
    }

    // Get item name and number from itemData or fallback to DTO
    const displayFields = getDisplayFields(itemData);
    const itemName = resolveLocalizedItemLabel(item, itemData, displayFields);
    const itemNo = item.itemNo || displayFields.itemNo || '';
    const batchNo = displayFields.batchNo || '';
    const itemNameAr =
      item.itemNameAr ??
      (item as { itemNameAR?: string | null }).itemNameAR ??
      (itemData as { nameAr?: string | null } | undefined)?.nameAr ??
      null;

    groupedItems.get(key)!.push({
      id: item.id,
      itemId: item.itemId,
      year: item.year,
      quantity: item.quantity,
      itemType: item.itemType,
      itemName: itemName,
      itemNameAr: itemNameAr,
      itemNo: itemNo,
      batchNo: batchNo,
      usedQuantityFromAllowance: item.usedQuantityFromAllowance || 0,
      reservedQuantityByOrdersOnProcessing: item.reservedQuantityByOrdersOnProcessing || 0,
      remainingQuantityFromAllowance: item.remainingQuantityFromAllowance || 0
    });
  });

  const rows: AllowanceTableRow[] = items.map(item => {
    const itemData = getItemById(item.itemId, item.itemType);
    const key = `${item.departmentId}_${item.year}`;

    // Use itemName from DTO first (supports all item types), fallback to item lookup
    const displayFields = getDisplayFields(itemData);
    const itemName = resolveLocalizedItemLabel(item, itemData, displayFields);
    const itemNo = item.itemNo || displayFields.itemNo || '';
    const batchNo = displayFields.batchNo || '';
    const itemNameAr =
      item.itemNameAr ??
      (item as { itemNameAR?: string | null }).itemNameAR ??
      (itemData as { nameAr?: string | null } | undefined)?.nameAr ??
      null;

    // Prefer API itemType; fall back to catalog maps only if value is missing/invalid
    let inferredItemType: ItemType = item.itemType;
    if (
      item.itemType !== ItemType.Ammunition &&
      item.itemType !== ItemType.Weapon &&
      item.itemType !== ItemType.Explosive
    ) {
      if (weaponMap.has(item.itemId)) {
        inferredItemType = ItemType.Weapon;
      } else if (explosiveMap.has(item.itemId)) {
        inferredItemType = ItemType.Explosive;
      } else {
        inferredItemType = ItemType.Ammunition;
      }
    }

    return {
      id: item.id,
      departmentId: item.departmentId,
      departmentName: departmentMap.get(item.departmentId) || `Department ${item.departmentId}`,
      year: item.year,
      itemId: item.itemId,
      itemName: itemName,
      itemNameAr: itemNameAr,
      itemNo: itemNo,
      batchNo: batchNo,
      itemType: inferredItemType,
      quantity: item.quantity,
      usedQuantityFromAllowance: item.usedQuantityFromAllowance || 0,
      reservedQuantityByOrdersOnProcessing: item.reservedQuantityByOrdersOnProcessing || 0,
      remainingQuantityFromAllowance: item.remainingQuantityFromAllowance || 0,
      items: groupedItems.get(key)!
    };
  });

  const sortedRows = rows.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.departmentName !== b.departmentName) return a.departmentName.localeCompare(b.departmentName);
    return (a.itemName || a.itemNo || '').localeCompare(b.itemName || b.itemNo || '');
  });

  // Combine all items for the dropdown
  const allItems: AllowanceItemType[] = [
    ...(ammunitionItems || []),
    ...(weaponItems || []),
    ...(explosiveItems || [])
  ];

  return {
    departments: departmentsList,
    allItems: allItems,
    allAllowances: sortedRows
  };
}

