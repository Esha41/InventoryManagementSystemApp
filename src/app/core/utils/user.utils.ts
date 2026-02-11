// Resolves the best display name from available user name fields
export const resolveUserDisplayName = (
  nameEn?: string | null,
  nameAr?: string | null,
  userName?: string | null
): string | null => {
  if (nameEn && nameEn.trim().length > 0) return nameEn;
  if (nameAr && nameAr.trim().length > 0) return nameAr;
  if (userName && userName.trim().length > 0) return userName;
  return null;
}

