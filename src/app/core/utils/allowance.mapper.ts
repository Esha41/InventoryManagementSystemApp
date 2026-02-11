/**
 * Allowance Mapper Utilities
 */

import { AllowanceItemDto, AllowanceItemDetailDto, AllowanceTableRow } from '@models/allowance.model';
import { DepartmentDto } from '@services/lookup.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { LookupItem } from '@models/lookup.model';
import { getLocalizedName } from './localization.utils';
import { ItemType } from '@models/inventory.model';

export type AllowanceItemType = AmmunitionReadDto | WeaponDto | ExplosiveDto;

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
  const getItemById = (itemId: number, itemType?: number): AllowanceItemType | undefined => {
    if (itemType === ItemType.Weapon) {
      return weaponMap.get(itemId);
    } else if (itemType === ItemType.Explosive) {
      return explosiveMap.get(itemId);
    } else {
      // Default to Ammunition (ItemType.Ammunition = 1)
      return ammunitionMap.get(itemId);
    }
  };

  const groupedItems = new Map<string, AllowanceItemDetailDto[]>();

  items.forEach(item => {
    const itemData = getItemById(item.itemId, item.itemType);
    const key = `${item.departmentId}_${item.year}`;

    if (!groupedItems.has(key)) {
      groupedItems.set(key, []);
    }

    // Get item name and number from itemData or fallback to DTO
    const itemName = item.itemName || (itemData ? getLocalizedName(itemData, currentLang) || (itemData as any).name || '' : '');
    const itemNo = item.itemNo || (itemData as any)?.itemNo || '';
    const batchNo = (itemData as any)?.batchNo || '';

    groupedItems.get(key)!.push({
      id: item.id,
      itemId: item.itemId,
      year: item.year,
      quantity: item.quantity,
      itemType: item.itemType,
      itemName: itemName,
      itemNo: itemNo,
      batchNo: batchNo,
      usedQuantityFromAllowance: item.usedQuantityFromAllowance || 0,
      reservedQuantityByDraftSupplies: item.reservedQuantityByOrdersOnProcessing || 0,
      remainingQuantityFromAllowance: item.remainingQuantityFromAllowance || 0
    });
  });

  const rows: AllowanceTableRow[] = items.map(item => {
    const itemData = getItemById(item.itemId, item.itemType);
    const key = `${item.departmentId}_${item.year}`;

    // Use itemName from DTO first (supports all item types), fallback to item lookup
    const itemName = item.itemName || (itemData ? getLocalizedName(itemData, currentLang) || (itemData as any).name || '' : '');
    const itemNo = item.itemNo || (itemData as any)?.itemNo || '';
    const batchNo = (itemData as any)?.batchNo || '';

    // Infer itemType if not provided by checking which map contains the item
    let inferredItemType = item.itemType || ItemType.Ammunition;
    if (!item.itemType) {
      if (weaponMap.has(item.itemId)) {
        inferredItemType = ItemType.Weapon;
      } else if (explosiveMap.has(item.itemId)) {
        inferredItemType = ItemType.Explosive;
      } else if (ammunitionMap.has(item.itemId)) {
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
      itemNo: itemNo,
      batchNo: batchNo,
      itemType: inferredItemType,
      quantity: item.quantity,
      usedQuantityFromAllowance: item.usedQuantityFromAllowance || 0,
      reservedQuantityByDraftSupplies: item.reservedQuantityByOrdersOnProcessing || 0,
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

