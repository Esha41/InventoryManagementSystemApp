// Resolves the best display name from available user name fields (locale-aware).
export const resolveUserDisplayName = (
  nameEn?: string | null,
  nameAr?: string | null,
  userName?: string | null,
  lang: string = 'en'
): string | null => {
  const preferAr = lang.toLowerCase().startsWith('ar');
  const en = nameEn?.trim();
  const ar = nameAr?.trim();
  if (preferAr) {
    if (ar && ar.length > 0) return ar;
    if (en && en.length > 0) return en;
  } else {
    if (en && en.length > 0) return en;
    if (ar && ar.length > 0) return ar;
  }
  const u = userName?.trim();
  if (u && u.length > 0) return u;
  return null;
};

