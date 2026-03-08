import type { AllowanceItemType } from '@models/allowance.model';

/** Re-export for feature consumers */
export type { AllowanceItemType };

/** API response item shape for allowance by department/year */
export interface AllowanceApiItem {
  itemId: number | string;
  itemType?: number | string;
  quantity: number | string;
}

/** Form item for allowance entry */
export interface AllowanceItem {
  itemId: string;
  quantity: string;
  selectedItem?: AllowanceItemType;
}

/** Item type option for dropdown */
export type AllowanceItemTypeKey = 'Ammunition' | 'Weapon' | 'Explosive';

export interface AllowanceItemTypeOption {
  value: AllowanceItemTypeKey;
  label: string;
}
