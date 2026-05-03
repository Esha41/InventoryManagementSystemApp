import { DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupItem } from '@services/lookup.service';

export function coerceLookupSelectionId(
  value: number | LookupItem | LookupItem[] | null | undefined
): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value > 0 ? value : null;
  if (Array.isArray(value)) return null;
  const id = (value as LookupItem).id;
  return id != null && id > 0 ? id : null;
}

export function coerceEmployeeOptionSelectionId(
  value: number | DropdownOption<number> | DropdownOption<number>[] | null | undefined
): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value > 0 ? value : null;
  if (Array.isArray(value)) return null;
  if (typeof value === 'object' && 'value' in value) {
    const v = (value as DropdownOption<number>).value;
    return typeof v === 'number' && v > 0 ? v : null;
  }
  return null;
}
