import { getLocalizedName } from '@utils/localization.utils';

/** Minimal fields for localized request line item name (workflow approval, dashboard modals, etc.). */
export interface LocalizedRequestLineItemFields {
  itemName?: string | null;
  itemNameAr?: string | null;
  itemNo?: string | null;
}

/**
 * Localized catalog line label for Order / Return / Discard request items.
 */
export function localizedRequestLineItemName(
  item: LocalizedRequestLineItemFields | null | undefined,
  lang: string
): string {
  if (!item) {
    return 'N/A';
  }

  const row = item as { itemNameAR?: string | null };
  const ar = (item.itemNameAr ?? row.itemNameAR ?? '').trim();
  const en = (item.itemName ?? '').trim();
  const label = getLocalizedName({ nameEn: en || undefined, nameAr: ar || undefined }, lang)?.trim();

  return label || en || (item.itemNo ?? '').trim() || 'N/A';
}
