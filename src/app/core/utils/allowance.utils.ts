import { AllowanceTableRow } from '@models/allowance.model';
import { LookupItem } from '@models/lookup.model';
import { TranslateService } from '@ngx-translate/core';
import { ItemType } from '@core/models/inventory.model';

export const getLocalizedName = (item: LookupItem | null, translateService: TranslateService): string => {
  if (!item) return '';
  const currentLang = translateService.currentLang || 'en';
  if (currentLang === 'ar' && item.nameAr) return item.nameAr;

  return item.nameEn || item.nameAr || '';
}

export const filterAllowances = (
  allowances: AllowanceTableRow[],
  selectedDepartment: number | string | null | undefined,
  selectedItem: number | string | null | undefined,
  selectedItemType: ItemType | null | undefined = null
): AllowanceTableRow[] => {
  let filtered = [...allowances];

  if (selectedDepartment !== null && selectedDepartment !== undefined && selectedDepartment !== '') {
    filtered = filtered.filter(allowance => {
      const allowanceDeptId = allowance.departmentId;
      return allowanceDeptId !== undefined && allowanceDeptId !== null &&
             (allowanceDeptId === Number(selectedDepartment) || String(allowanceDeptId) === String(selectedDepartment));
    });
  }

  if (selectedItemType !== null && selectedItemType !== undefined) {
    filtered = filtered.filter(allowance => {
      return allowance.itemType === selectedItemType;
    });
  }

  if (selectedItem !== null && selectedItem !== undefined && selectedItem !== '') {
    filtered = filtered.filter(allowance => {
      const allowanceItemId = allowance.itemId;
      return allowanceItemId !== undefined && allowanceItemId !== null &&
             (allowanceItemId === Number(selectedItem) || String(allowanceItemId) === String(selectedItem));
    });
  }

  return filtered;
}

