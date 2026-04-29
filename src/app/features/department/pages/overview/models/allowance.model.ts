import type { AllowanceItemType } from '@models/allowance.model';

export type { AllowanceItemType };

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
