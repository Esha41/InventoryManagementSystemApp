/**
 * Item Assignment models
 */

export interface ItemDepartmentAssignmentDto {
  id: number;
  itemId: number;
  itemName?: string;
  itemNo?: string;
  itemType: number | string; // Backend may return as string ("Ammunition") or number (1)
  departmentId: number;
  departmentCode?: string;
  departmentNameAr?: string;
  departmentNameEn?: string;
  notes?: string;
}

export interface CreateUpdateItemDepartmentAssignmentDto {
  itemId: number;
  departmentId: number;
  notes?: string;
}
