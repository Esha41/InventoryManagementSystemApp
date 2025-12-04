/**
 * Interface for objects that have localized names
 * Supports multiple naming conventions used across the application
 */
export interface Localizable {
  nameEn?: string | null;
  nameAr?: string | null;
  nameEN?: string | null;  // Alternative casing
  nameAR?: string | null;  // Alternative casing
  fullNameEN?: string | null;  // For user names
  fullNameAR?: string | null;  // For user names
  name?: string | null;  // Fallback generic name
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

  if (lang === 'ar') {
    // Prefer Arabic, fallback to English, then generic name
    return (
      item.nameAr?.trim() ||
      item.nameAR?.trim() ||
      item.fullNameAR?.trim() ||
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
export const getCurrentLang = (translateService: any): string => {
  return translateService?.currentLang || translateService?.defaultLang || 'en';
}

