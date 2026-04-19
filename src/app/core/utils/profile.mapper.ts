/**
 * Profile Mapper Utilities
 * Maps API responses to application models
 */

import { AuthenticatedUser, ClaimDto } from '@models/auth.model';
import { UserMeResponse } from '@models/profile.model';
import { TranslateService } from '@ngx-translate/core';
import { getLocalizedName, getCurrentLang } from './localization.utils';

/**
 * Map API response to AuthenticatedUser
 * @param apiUser - User data from /Users/me API endpoint
 * @param permissions - User permissions/claims
 * @param translateService - Translation service for localized names
 * @returns Mapped AuthenticatedUser object
 */
export function mapApiResponseToAuthenticatedUser(
  apiUser: UserMeResponse,
  permissions: ClaimDto[] = [],
  translateService: TranslateService
): AuthenticatedUser {
  // Extract role names from roles array
  const roleNames: string[] = apiUser.roles
    ? apiUser.roles.map(role => role.name).filter(name => !!name)
    : [];

  // Extract department names from nested department object
  const departmentNameEn = apiUser.department?.nameEn ?? undefined;
  const departmentNameAr = apiUser.department?.nameAr ?? undefined;
  const departmentName = apiUser.department
    ? getLocalizedName(apiUser.department, getCurrentLang(translateService))
    : undefined;

  const departmentId = apiUser.department?.id ?? apiUser.departmentId ?? undefined;

  // Extract rank name from nested rank object
  const rankNameEn = apiUser.rank?.nameEn ?? undefined;
  const rankNameAr = apiUser.rank?.nameAr ?? undefined;
  const rankId = apiUser.rank?.id ?? apiUser.rankId ?? undefined;

  // Handle military ID - can be string or number from API, filter out empty strings
  const militaryId = apiUser.militoryId !== null && apiUser.militoryId !== undefined && apiUser.militoryId !== ''
    ? String(apiUser.militoryId)
    : undefined;

  return {
    id: apiUser.id,
    userName: apiUser.userName || '',
    email: apiUser.email || '',
    roles: roleNames,
    permissions: permissions || [],
    isLdapUser: apiUser.isLdapUser || false,
    ldapUserName: apiUser.ldapUserName ?? undefined,
    organizationId: undefined, // Not in API response
    departmentId: departmentId,
    departmentName: departmentName,
    departmentNameEn: departmentNameEn,
    departmentNameAr: departmentNameAr,
    nameEn: apiUser.fullNameEN ?? undefined,
    nameAr: apiUser.fullNameAR ?? undefined,
    rankId: rankId,
    rankNameEn: rankNameEn,
    rankNameAr: rankNameAr,
    militaryId: militaryId
  };
}

