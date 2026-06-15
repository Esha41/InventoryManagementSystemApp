/**
 * Profile Utility Functions
 * Helper functions for user profile data manipulation and display
 */

import { AuthenticatedUser } from '@models/auth.model';
import { TranslateService } from '@ngx-translate/core';
import { getLocalizedName, getCurrentLang } from './localization.utils';

/**
 * Get localized user name
 * @param user - AuthenticatedUser object
 * @param translateService - Translation service for language detection
 * @returns Localized user name or fallback
 */
export function getUserName(user: AuthenticatedUser | null, translateService: TranslateService): string {
  if (!user) return '';
  return getLocalizedName({ nameEn: user.nameEn, nameAr: user.nameAr }, getCurrentLang(translateService))
    || user.userName || '';
}

/**
 * Get roles as comma-separated string
 * @param user - AuthenticatedUser object
 * @param translateService - Translation service for fallback text
 * @returns Comma-separated roles or translated "no roles" message
 */
export function getRolesString(user: AuthenticatedUser | null, translateService: TranslateService): string {
  if (!user || !user.roles || user.roles.length === 0) {
    return translateService.instant('profile.noRoles');
  }
  return user.roles.join(', ');
}

/**
 * Localized label for the user's active / default role (session role).
 */
export function getActiveRoleDisplay(user: AuthenticatedUser | null, translateService: TranslateService): string {
  if (!user) return '';
  const lang = getCurrentLang(translateService);
  const defId = user.defaultRoleId?.toLowerCase().trim();
  const details = user.roleDetails;
  if (details?.length) {
    const active = defId
      ? details.find(r => r.id?.toLowerCase().trim() === defId)
      : details.find(r => r.isDefaultRole);
    const pick = active ?? details[0];
    const label = getLocalizedName({ name: pick.name, nameAr: pick.nameAr }, lang);
    return label || pick.name || '';
  }
  if (user.roles?.length) {
    return user.roles[0];
  }
  return '';
}

/**
 * Get localized department name
 * @param user - AuthenticatedUser object
 * @param translateService - Translation service for language detection
 * @returns Localized department name or empty string
 */
export function getDepartmentName(user: AuthenticatedUser | null, translateService: TranslateService): string {
  if (!user) return '';
  return getLocalizedName(
    { nameEn: user.departmentNameEn ?? user.departmentName, nameAr: user.departmentNameAr },
    getCurrentLang(translateService)
  );
}

/**
 * Get localized rank name
 * @param user - AuthenticatedUser object
 * @param translateService - Translation service for language detection
 * @returns Localized rank name or empty string
 */
export function getRankName(user: AuthenticatedUser | null, translateService: TranslateService): string {
  if (!user) return '';
  return getLocalizedName(
    { nameEn: user.rankNameEn, nameAr: user.rankNameAr },
    getCurrentLang(translateService)
  );
}

/**
 * Get user initials for avatar display
 * @param user - AuthenticatedUser object
 * @param translateService - Translation service for getting localized name
 * @returns User initials (1-2 characters)
 */
export function getUserInitials(user: AuthenticatedUser | null, translateService: TranslateService): string {
  if (!user) return 'U';
  
  const name = getUserName(user, translateService);
  if (!name || name === '') {
    return user.userName?.[0]?.toUpperCase() || 'U';
  }
  
  // Remove email-like patterns and split by space
  const cleanName = name.split('@')[0].trim();
  const parts = cleanName.split(/\s+/);
  
  if (parts.length >= 2) {
    // Get first letter of first and last name
    const first = parts[0][0]?.toUpperCase() || '';
    const last = parts[parts.length - 1][0]?.toUpperCase() || '';
    return (first + last) || 'U';
  }
  
  // Single name - use first two letters if available
  if (cleanName.length >= 2) {
    return cleanName.substring(0, 2).toUpperCase();
  }
  
  return cleanName[0]?.toUpperCase() || 'U';
}

