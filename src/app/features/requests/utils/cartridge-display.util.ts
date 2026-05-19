import { Cartridge } from '@models/cartridge.model';
import { getLocalizedName } from '@utils/localization.utils';

/** Issue / return catalog rows: Arabic when UI + `nameAr` allow, else English (`nameEn` / `name`). */
export function localizedCartridgeDisplayName(cartridge: Cartridge, lang: string): string {
  const en = (cartridge.nameEn ?? '').trim() || (cartridge.name ?? '').trim();
  const ar = (cartridge.nameAr ?? '').trim();
  return (
    getLocalizedName({ name: en || undefined, nameAr: ar || undefined }, lang)?.trim() ||
    cartridge.name ||
    ''
  );
}
