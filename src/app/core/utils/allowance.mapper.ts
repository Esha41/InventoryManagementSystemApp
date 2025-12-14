/**
 * Allowance Mapper Utilities
 */

import { AllowanceItemDto, AllowanceItemDetailDto, AllowanceTableRow } from '@models/allowance.model';
import { DepartmentDto } from '@services/lookup.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { LookupItem } from '@models/lookup.model';
import { getLocalizedName } from './localization.utils';

export interface ProcessedAllowanceData {
  departments: LookupItem[];
  allItems: AmmunitionReadDto[];
  allAllowances: AllowanceTableRow[];
}

export function processAllowanceData(
  items: AllowanceItemDto[],
  departments: DepartmentDto[],
  ammunitionItems: AmmunitionReadDto[],
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

  const ammunitionMap = new Map<number, AmmunitionReadDto>();
  ammunitionItems.forEach(ammo => {
    ammunitionMap.set(ammo.id, ammo);
  });

  const groupedItems = new Map<string, AllowanceItemDetailDto[]>();

  items.forEach(item => {
    const ammunition = ammunitionMap.get(item.itemId);
    const key = `${item.departmentId}_${item.year}`;

    if (!groupedItems.has(key)) {
      groupedItems.set(key, []);
    }

    groupedItems.get(key)!.push({
      id: item.id,
      itemId: item.itemId,
      year: item.year,
      quantity: item.quantity,
      itemType: item.itemType,
      // Use itemName from DTO first (supports all item types), fallback to ammunition lookup
      itemName: item.itemName || ammunition?.name,
      itemNo: item.itemNo || ammunition?.itemNo,
      batchNo: ammunition?.batchNo,
      usedQuantityFromAllowance: item.usedQuantityFromAllowance || 0,
      reservedQuantityByDraftSupplies: item.reservedQuantityByOrdersOnProcessing || 0,
      remainingQuantityFromAllowance: item.remainingQuantityFromAllowance || 0
    });
  });

  const rows: AllowanceTableRow[] = items.map(item => {
    const ammunition = ammunitionMap.get(item.itemId);
    const key = `${item.departmentId}_${item.year}`;

    // Use itemName from DTO first (supports all item types), fallback to ammunition lookup
    const itemName = item.itemName || (ammunition ? getLocalizedName(ammunition, currentLang) || ammunition.name || '' : '');
    const itemNo = item.itemNo || ammunition?.itemNo || '';

    return {
      id: item.id,
      departmentId: item.departmentId,
      departmentName: departmentMap.get(item.departmentId) || `Department ${item.departmentId}`,
      year: item.year,
      itemId: item.itemId,
      itemName: itemName,
      itemNo: itemNo,
      batchNo: ammunition?.batchNo || '',
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

  return {
    departments: departmentsList,
    allItems: ammunitionItems || [],
    allAllowances: sortedRows
  };
}

