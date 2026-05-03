import { DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupItem } from '@services/lookup.service';
import { WeaponDto } from '@models/weapon.model';

export type LocalizedLookupFn = (entity: { nameAr?: string; nameEn?: string } | null | undefined) => string;

export function departmentOrLookupDropdownLabelFactory(
  getLocalizedEntity: LocalizedLookupFn
): (option: DropdownOption<LookupItem> | LookupItem | null) => string {
  return (option) => {
    if (!option) return '';
    const item =
      typeof option === 'object' &&
      option !== null &&
      'value' in option &&
      (option as DropdownOption<LookupItem>).value != null
        ? (option as DropdownOption<LookupItem>).value!
        : (option as LookupItem);
    return getLocalizedEntity(item);
  };
}

export function weaponDropdownLabel(option: DropdownOption<WeaponDto> | WeaponDto | null): string {
  if (!option) return '';
  const weapon = 'value' in option ? option.value : option;
  const name = weapon?.name || '';
  const itemNo = weapon?.itemNo || '';
  return itemNo ? `${name} (${itemNo})` : name;
}
