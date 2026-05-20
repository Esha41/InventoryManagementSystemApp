/**
 * Explosive enum utilities (catalog Type.NameEn filter keys).
 */

import { ExplosiveType } from '@models/backend-enums';
import { getExplosiveTypeLabel, spacedEnumKeyLabel } from '@utils/enum-label.utils';

export { ExplosiveType } from '@models/backend-enums';

export const getExplosiveTypeOptions = (): { label: string; value: string }[] => {
  return Object.keys(ExplosiveType)
    .filter(key => Number.isNaN(Number(key)))
    .map(key => ({
      label: spacedEnumKeyLabel(key),
      value: key
    }));
};

export const getExplosiveTypeName = (value: number): string => {
  return getExplosiveTypeLabel(value as ExplosiveType);
};
