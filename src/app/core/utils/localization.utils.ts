export interface Localizable {
  nameEn?: string | null;
  nameAr?: string | null;
}

export const getLocalizedName = (
  item: Localizable,
  currentLang: string = 'en',
  defaultLang: string = 'en'
): string => {
  const lang = currentLang || defaultLang || 'en';
  if (lang === 'ar') return item.nameAr?.trim() || item.nameEn?.trim() || '';

  return item.nameEn?.trim() || item.nameAr?.trim() || '';
}

