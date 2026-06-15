import { AllowanceTableRow } from '@models/allowance.model';
import { ItemType } from '@models/inventory.model';

export const filterAllowances = (
  allowances: AllowanceTableRow[],
  selectedDepartment: number | null,
  selectedItem: number | null,
  selectedItemType: ItemType | null | undefined = null
): AllowanceTableRow[] => {
  let filtered = [...allowances];

  if (selectedDepartment !== null) {
    filtered = filtered.filter(allowance =>
      allowance.departmentId !== undefined &&
      allowance.departmentId !== null &&
      allowance.departmentId === selectedDepartment
    );
  }

  if (selectedItemType !== null && selectedItemType !== undefined) {
    filtered = filtered.filter(allowance => allowance.itemType === selectedItemType);
  }

  if (selectedItem !== null) {
    filtered = filtered.filter(allowance =>
      allowance.itemId !== undefined &&
      allowance.itemId !== null &&
      allowance.itemId === selectedItem
    );
  }

  return filtered;
};
