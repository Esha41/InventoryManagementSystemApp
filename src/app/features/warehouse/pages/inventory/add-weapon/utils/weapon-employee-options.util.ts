import { EmployeeDto } from '@models/asset.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';

/**
 * Build sorted employee dropdown options from active employees (same labels as add-weapon-asset legacy).
 */
export function buildEmployeeDropdownOptions(
  employees: EmployeeDto[],
  currentLang: string
): DropdownOption<number>[] {
  return employees
    .map(emp => {
      const name =
        currentLang === 'ar'
          ? (emp.nameAr || emp.nameEn || String(emp.id))
          : (emp.nameEn || emp.nameAr || String(emp.id));
      const militaryId =
        emp.militaryId || (emp as { militoryId?: string }).militoryId;
      const label = militaryId ? `${name} (${militaryId})` : name;
      return { value: emp.id, label, description: militaryId ? '' : (emp.email || '') };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
