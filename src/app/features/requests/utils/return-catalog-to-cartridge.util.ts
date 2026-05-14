import { Cartridge } from '@models/cartridge.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import type { CatalogListItem, ReturnSelectedItem } from '@requests/pages/return-request/return-request.state';

function lookupLabel(lookup: { nameEn?: string | null; nameAr?: string | null } | null | undefined, lang: string): string {
  return getLocalizedName(lookup, lang);
}

/** Map a catalog row from return inventory APIs to the shared `Cartridge` list shape used by `CartridgeListComponent`. */
export function catalogListItemToCartridge(item: CatalogListItem, itemType: string, translate: TranslateService): Cartridge {
  const lang = getCurrentLang(translate);
  const id = Number(item.id);
  const base: Cartridge = {
    id,
    name: item.name || item.itemNo || '',
    selected: false,
    added: false,
    itemNo: item.itemNo,
    itemType,
    ncn: item.nsn ?? undefined,
    productId: item.partNo ?? undefined
  };

  if (itemType === 'Ammunition') {
    const a = item as AmmunitionReadDto;
    const linkedLabel = a.isLinked ? 'Linked' : 'Not Linked';
    return {
      ...base,
      ammunitionType: a.ammunitionType != null ? String(a.ammunitionType) : undefined,
      bulletDiameterLabel: lookupLabel(a.bulletDiameterUnit ?? null, lang),
      linkedLabel,
      linkedLabelEn: linkedLabel,
      natureLabel: lookupLabel(a.natureOption ?? null, lang),
      natureLabelEn: lookupLabel(a.natureOption ?? null, lang)
    };
  }

  if (itemType === 'Weapon') {
    const w = item as WeaponDto;
    const wt = lookupLabel(w.type ?? null, lang);
    return {
      ...base,
      weaponType: wt || undefined,
      caliber: lookupLabel(w.caliber ?? null, lang) || undefined
    };
  }

  const e = item as ExplosiveDto;
  const typeLabel = lookupLabel(e.type ?? null, lang);
  return {
    ...base,
    explosiveType: typeLabel || (e.explosiveType != null ? String(e.explosiveType) : undefined),
    unNumber: e.unNumber ?? undefined
  };
}

/** Minimal `Cartridge` for rows already chosen on the return flow. */
export function returnSelectedItemToCartridge(row: ReturnSelectedItem, itemType: string): Cartridge {
  return {
    id: row.itemId,
    name: row.name,
    itemNo: row.itemNo,
    selected: true,
    added: true,
    quantity: row.quantity,
    itemType: row.itemType || itemType
  };
}

/**
 * Marks rows on the current page as added/quantity without reordering the list.
 * (Issue flow prepends cached selections; for return we keep scroll position stable.)
 */
export function mergeReturnSelectionsIntoFilteredView(
  pageRows: Cartridge[],
  selectedItems: ReturnSelectedItem[],
  currentItemType: string
): Cartridge[] {
  const selectedForTab = selectedItems.filter((s) => !s.itemType || s.itemType === currentItemType);
  return pageRows.map((row) => {
    const sel = selectedForTab.find((s) => s.itemId === row.id);
    if (sel) {
      return { ...row, added: true, quantity: sel.quantity, selected: false };
    }
    return { ...row, added: false, quantity: null, selected: false };
  });
}
