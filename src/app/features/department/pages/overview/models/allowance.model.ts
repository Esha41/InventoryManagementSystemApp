import type { AllowanceItemType } from '@models/allowance.model';

export type { AllowanceItemType };

export interface AllowanceApiItem {
  itemId: number | string;
  itemType?: number | string;
  quantity: number | string;
}

export interface AllowanceItem {
  itemId: string;
  quantity: string;
  selectedItem?: AllowanceItemType;
}

export type AllowanceItemTypeKey = 'Ammunition' | 'Weapon' | 'Explosive';

export interface AllowanceItemTypeOption {
  value: AllowanceItemTypeKey;
  label: string;
}
