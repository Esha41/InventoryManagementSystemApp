
import type { AmmunitionReadDto } from '@models/ammunition.model';
import type { WeaponDto } from '@models/weapon.model';
import type { ExplosiveDto } from '@models/explosive.model';
import type { ItemType } from '@models/inventory.model';

/** Union type for allowance item (ammunition, weapon, or explosive) - shared across list and form */
export type AllowanceItemType = AmmunitionReadDto | WeaponDto | ExplosiveDto;

export interface AllowanceItemDto {
  id: number;
  itemId: number;
  itemName?: string | null;
  itemNo?: string | null;
  departmentId: number;
  year: number;
  quantity: number;
  itemType: ItemType;
  usedQuantityFromAllowance: number;
  reservedQuantityByOrdersOnProcessing: number;
  remainingQuantityFromAllowance: number;
}

export interface AllowanceItemDetailDto {
  id: number;
  itemId: number;
  year: number;
  quantity: number;
  itemType: ItemType;
  itemName: string;
  itemNo: string;
  batchNo?: string | null;
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
  itemType?: ItemType | null;
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
  itemType: ItemType;
  quantity: number;
  usedQuantityFromAllowance: number;
  reservedQuantityByOrdersOnProcessing: number;
  remainingQuantityFromAllowance: number;
  items: AllowanceItemDetailDto[];
}

export interface AllowanceItemReserveDetailsDto {
  itemId: number;
  itemName: string;
  itemNo: string;
  batchNo?: string | null;
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
