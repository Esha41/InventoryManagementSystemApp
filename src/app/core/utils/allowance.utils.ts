import { AllowanceTableRow } from '@models/allowance.model';
import { ItemType } from '@models/inventory.model';

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

