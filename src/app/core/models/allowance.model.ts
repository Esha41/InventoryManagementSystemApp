/**
 * Allowance Models
 */

export interface AllowanceItemDto {
  id: number;
  itemId: number;
  departmentId: number;
  year: number;
  quantity: number;
  itemType?: number;
  usedQuantityFromAllowance: number;
  reservedQuantityByOrdersOnProcessing: number;
  remainingQuantityFromAllowance: number;
}

export interface AllowanceItemDetailDto {
  id: number;
  itemId: number;
  year: number;
  quantity: number;
  itemType?: number;
  itemName?: string;
  itemNo?: string;
  batchNo?: string;
  usedQuantityFromAllowance: number;
  reservedQuantityByOrdersOnProcessing: number;
  remainingQuantityFromAllowance: number;
}

export interface AllowanceItemByDepartmentDto {
  departmentId: number;
  departmentCode: string;
  departmentNameAr: string;
  departmentNameEn: string;
  year: number;
  itemType?: number;
  items: AllowanceItemDetailDto[];
}

export interface AllowanceTableRow {
  id: number;
  departmentId: number;
  departmentName: string;
  year: number;
  itemId: number;
  itemName: string;
  itemNo: string;
  batchNo: string;
  quantity: number;
  items: AllowanceItemDetailDto[];
}

export interface AllowanceItemReserveDetailsDto {
  itemId: number;
  itemName: string;
  itemNo: string;
  batchNo?: string;
  originalQuantity: number;
  remainingQuantity: number;
  reservedQuantityByOrdersOnProcessing: number;
  usedQuantity: number;
}

export interface AllowanceReserveDetailsByItemDto {
  departmentId: number;
  departmentCode: string;
  departmentNameAr: string;
  departmentNameEn: string;
  year: number;
  totalOriginalQuantity: number;
  totalRemainingQuantity: number;
  totalReservedQuantityByOrdersOnProcessing: number;
  totalUsedQuantity: number;
  items: AllowanceItemReserveDetailsDto[];
}

