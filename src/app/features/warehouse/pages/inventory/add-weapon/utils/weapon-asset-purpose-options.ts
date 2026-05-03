import { LookupItem } from '@services/lookup.service';
import { WeaponDto } from '@models/weapon.model';

/**
 * Primary purpose options for a selected catalog item: weapon-linked purposes when available, else full lookup list.
 */
export function getPrimaryPurposeOptionsForItem(
  itemId: number | null,
  availableWeapons: WeaponDto[],
  allPrimaryPurposes: LookupItem[]
): LookupItem[] {
  const weapon = itemId != null ? availableWeapons.find(w => w.id === itemId) : undefined;
  const linked = weapon?.primaryPurposes;
  if (linked?.length) {
    return linked
      .filter(p => p.id != null)
      .map(p => ({ id: p.id!, nameAr: p.nameAr ?? '', nameEn: p.nameEn ?? '' }));
  }
  return allPrimaryPurposes;
}
