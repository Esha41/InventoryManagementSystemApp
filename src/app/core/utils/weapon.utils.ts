/**
 * Weapon enum utilities — values from {@link WeaponType} / {@link ActionType} in backend-enums.
 */

import { ActionType, WeaponType } from '@models/backend-enums';
import { getActionTypeLabel, getWeaponTypeLabel, spacedEnumKeyLabel } from '@utils/enum-label.utils';

export { ActionType, WeaponType } from '@models/backend-enums';

export const getWeaponTypeOptions = (): { label: string; value: string }[] => {
  return Object.keys(WeaponType)
    .filter(key => Number.isNaN(Number(key)))
    .map(key => ({
      label: spacedEnumKeyLabel(key),
      value: key
    }));
};

export const getActionTypeOptions = (): { label: string; value: number }[] => {
  return Object.keys(ActionType)
    .filter(key => Number.isNaN(Number(key)))
    .map(key => ({
      label: spacedEnumKeyLabel(key),
      value: ActionType[key as keyof typeof ActionType]
    }));
};

export const getWeaponTypeName = (value: number): string => {
  return getWeaponTypeLabel(value as WeaponType);
};

export const getActionTypeName = (value: number): string => {
  return getActionTypeLabel(value as ActionType);
};
