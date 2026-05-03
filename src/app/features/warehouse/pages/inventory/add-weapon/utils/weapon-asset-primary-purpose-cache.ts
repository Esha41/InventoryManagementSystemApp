import { LookupItem } from '@services/lookup.service';
import { WeaponDto } from '@models/weapon.model';
import { getPrimaryPurposeOptionsForItem } from './weapon-asset-purpose-options';

/**
 * Memoizes primary-purpose lookup options per catalog item id.
 */
export class WeaponAssetPrimaryPurposeOptionsCache {
  private readonly store = new Map<string, LookupItem[]>();

  clear(): void {
    this.store.clear();
  }

  get(itemId: number | null, availableWeapons: WeaponDto[], allPrimaryPurposes: LookupItem[]): LookupItem[] {
    const key = itemId == null ? 'null' : String(itemId);
    let cached = this.store.get(key);
    if (!cached) {
      cached = getPrimaryPurposeOptionsForItem(itemId, availableWeapons, allPrimaryPurposes);
      this.store.set(key, cached);
    }
    return cached;
  }
}
