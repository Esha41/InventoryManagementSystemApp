/**
 * Profile Models
 * Models related to user profile data and API responses
 */

/**
 * Department information from API
 */
export interface ProfileDepartment {
  id: number;
  code?: string;
  nameEn?: string;
  nameAr?: string;
  isDeleted?: boolean;
}

/**
 * Rank information from API
 */
export interface ProfileRank {
  id: number;
  nameEn?: string;
  nameAr?: string;
  isDeleted?: boolean;
}

/**
 * Role information from API
 */
export interface ProfileRole {
  id: string;
  name: string;
}

/**
 * API response from /Users/me endpoint
 * Note: API has typos in field names (deparmentId, militoryId)
 */
export interface UserMeResponse {
  id: string;
  userName: string;
  email: string;
  isLdapUser?: boolean;
  ldapUserName?: string;
  isSuperAdmin?: boolean;
  extraEmployeesView?: string;
  deparmentId?: number | null; // Note: API has typo "deparmentId"
  roles?: ProfileRole[];
  fullNameEN?: string;
  fullNameAR?: string;
  rankId?: number | null;
  militoryId?: string | number | null; // Note: API has typo "militoryId"
  department?: ProfileDepartment;
  rank?: ProfileRank;
}

