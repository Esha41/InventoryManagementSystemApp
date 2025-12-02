/**
 * Allowance Mapper Utilities
 */

import { AllowanceItemDto, AllowanceItemDetailDto, AllowanceTableRow } from '@models/allowance.model';
import { DepartmentDto } from '@services/lookup.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { LookupItem } from '@models/lookup.model';

export interface ProcessedAllowanceData {
  departments: LookupItem[];
  allItems: AmmunitionReadDto[];
  allAllowances: AllowanceTableRow[];
}

export function processAllowanceData(
  items: AllowanceItemDto[],
  departments: DepartmentDto[],
  ammunitionItems: AmmunitionReadDto[]
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
      departmentMap.set(dept.id, dept.nameEn || dept.nameAr || `Department ${dept.id}`);
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
      itemName: ammunition?.name,
      itemNo: ammunition?.itemNo,
      batchNo: ammunition?.batchNo,
      usedQuantityFromAllowance: item.usedQuantityFromAllowance || 0,
      reservedQuantityByOrdersOnProcessing: item.reservedQuantityByOrdersOnProcessing || 0,
      remainingQuantityFromAllowance: item.remainingQuantityFromAllowance || 0
    });
  });

  const rows: AllowanceTableRow[] = items.map(item => {
    const ammunition = ammunitionMap.get(item.itemId);
    const key = `${item.departmentId}_${item.year}`;
    
    return {
      id: item.id,
      departmentId: item.departmentId,
      departmentName: departmentMap.get(item.departmentId) || `Department ${item.departmentId}`,
      year: item.year,
      itemId: item.itemId,
      itemName: ammunition?.name || '',
      itemNo: ammunition?.itemNo || '',
      batchNo: ammunition?.batchNo || '',
      quantity: item.quantity,
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

