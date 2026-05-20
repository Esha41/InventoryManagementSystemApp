/**
 * Interface for objects that have localized names
 * Supports multiple naming conventions used across the application
 */
export interface Localizable {
  // Note: some backend DTOs model these as `string | null | undefined` even when
  // our UI only cares about the localized string. Accept `undefined` explicitly
  // so we can pass DTO-shaped objects without type assertions.
  nameEn?: string | null | undefined;
  nameAr?: string | null | undefined;
  nameEN?: string | null | undefined;  // Alternative casing
  nameAR?: string | null | undefined;  // Alternative casing
  fullNameEN?: string | null | undefined;  // For user names
  fullNameAR?: string | null | undefined;  // For user names
  name?: string | null | undefined;  // Fallback generic name
}

/**
 * Get localized name based on current language
 * @param item - Object with localized name properties
 * @param currentLang - Current language code ('en' or 'ar')
 * @param defaultLang - Default language to fall back to
 * @returns Localized name string
 */
export const getLocalizedName = (
  item: Localizable | null | undefined,
  currentLang: string = 'en',
  defaultLang: string = 'en'
): string => {
  if (!item) return '';

  const lang = currentLang || defaultLang || 'en';

  // Helper function to detect if text contains Arabic characters
  const isArabicText = (text: string | null | undefined): boolean => {
    if (!text) return false;
    // Arabic Unicode range: \u0600-\u06FF
    return /[\u0600-\u06FF]/.test(text);
  };

  if (lang === 'ar') {
    // Prefer Arabic, fallback to English, then generic name
    return (
      item.nameAr?.trim() ||
      item.nameAR?.trim() ||
      item.fullNameAR?.trim() ||
      // If 'name' field contains Arabic, use it for Arabic language
      (isArabicText(item.name) ? item.name?.trim() : null) ||
      item.nameEn?.trim() ||
      item.nameEN?.trim() ||
      item.fullNameEN?.trim() ||
      item.name?.trim() ||
      ''
    );
  }

  // Prefer English, fallback to Arabic, then generic name
  return (
    item.nameEn?.trim() ||
    item.nameEN?.trim() ||
    item.fullNameEN?.trim() ||

    (!isArabicText(item.name) ? item.name?.trim() : null) ||
    item.nameAr?.trim() ||
    item.nameAR?.trim() ||
    item.fullNameAR?.trim() ||

    item.name?.trim() ||
    ''
  );
}

/**
 * Helper to get current language from TranslateService
 * Can be used when TranslateService is available in component
 */
export const getCurrentLang = (
  translateService: { currentLang?: string | null; defaultLang?: string | null } | null | undefined
): string => {
  return translateService?.currentLang || translateService?.defaultLang || 'en';
}

/**
 * UI label from bilingual API fields; picks EN/AR from currentLang with the same fallbacks as getLocalizedName.
 */
export const localizedBilingualLabel = (
  nameEn?: string | null,
  nameAr?: string | null,
  legacySingle?: string | null,
  currentLang: string = 'en'
): string => {
  const fromPair = getLocalizedName(
    { nameEn: nameEn ?? undefined, nameAr: nameAr ?? undefined },
    currentLang
  );
  if (fromPair) return fromPair;
  const legacy = legacySingle?.trim();
  if (legacy) return legacy;
  return 'N/A';
};

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

/** Issue / return catalog rows: Arabic when UI + `nameAr` allow, else English (`nameEn` / `name`). */
export interface LocalizedCartridgeFields {
  name?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
}

export function localizedCartridgeDisplayName(
  cartridge: LocalizedCartridgeFields,
  lang: string
): string {
  const en = (cartridge.nameEn ?? '').trim() || (cartridge.name ?? '').trim();
  const ar = (cartridge.nameAr ?? '').trim();
  return (
    getLocalizedName({ name: en || undefined, nameAr: ar || undefined }, lang)?.trim() ||
    cartridge.name ||
    ''
  );
}

