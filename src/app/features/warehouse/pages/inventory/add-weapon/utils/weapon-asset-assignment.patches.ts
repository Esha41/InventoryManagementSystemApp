import { FormGroup } from '@angular/forms';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupItem } from '@services/lookup.service';
import type { WeaponAssignMode } from './weapon-asset-assign.types';
import { coerceEmployeeOptionSelectionId, coerceLookupSelectionId } from './weapon-asset-dropdown.coerce';

export function patchAssignControlsForMode(mode: WeaponAssignMode, target: FormGroup): void {
  if (mode === 'none') {
    target.patchValue({
      assignToEmployeeId: null,
      assignToDepartmentId: null,
      assignmentNotes: ''
    });
  } else if (mode === 'department') {
    target.patchValue({ assignToEmployeeId: null });
  } else if (mode === 'employee') {
    target.patchValue({ assignToDepartmentId: null });
  }
}

export function patchDepartmentSelectionOnSingleRow(
  g: FormGroup,
  value: number | LookupItem | LookupItem[] | null | undefined
): boolean {
  const departmentId = coerceLookupSelectionId(value);
  if (departmentId != null) {
    g.patchValue({ assignMode: 'department' as const, assignToEmployeeId: null }, { emitEvent: false });
  }
  return departmentId != null;
}

export function patchEmployeeSelectionOnSingleRow(
  g: FormGroup,
  value: number | DropdownOption<number> | DropdownOption<number>[] | null | undefined
): boolean {
  const employeeId = coerceEmployeeOptionSelectionId(value);
  if (employeeId != null) {
    g.patchValue({ assignMode: 'employee' as const, assignToDepartmentId: null }, { emitEvent: false });
  }
  return employeeId != null;
}

export function patchDepartmentSelectionOnBulkForm(
  bulkForm: FormGroup,
  value: number | LookupItem | LookupItem[] | null | undefined
): boolean {
  const departmentId = coerceLookupSelectionId(value);
  if (departmentId != null) {
    bulkForm.patchValue({ assignMode: 'department' as const, assignToEmployeeId: null }, { emitEvent: false });
  }
  return departmentId != null;
}

export function patchEmployeeSelectionOnBulkForm(
  bulkForm: FormGroup,
  value: number | DropdownOption<number> | DropdownOption<number>[] | null | undefined
): boolean {
  const employeeId = coerceEmployeeOptionSelectionId(value);
  if (employeeId != null) {
    bulkForm.patchValue({ assignMode: 'employee' as const, assignToDepartmentId: null }, { emitEvent: false });
  }
  return employeeId != null;
}
