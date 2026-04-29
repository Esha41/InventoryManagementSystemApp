/**
 * Authentication Models
 * Aligned with backend DTOs
 */

/**
 * Login request matching backend LoginInformation
 */
export interface LoginRequest {
  username: string;
  password: string;
  isLdap?: boolean;
  captchaId?: string;
  captchaCode?: string;
  forceLogin?: boolean;
}

/**
 * Captcha response from backend
 */
export interface CaptchaResponse {
  captchaId: string; // ID to fetch/validate captcha
  captchaCode: string; // The captcha text code (for reference, not for display)
}

/** Role option when the user must pick an active role (multi-role account). */
export interface RoleForSelection {
  id: string;
  name: string;
  /** Arabic display name from AspNetRoles.NameAr when present. */
  nameAr?: string | null;
}

/**
 * Login response from backend - matches C# AuthenticatedResponse
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO date string from backend
  departmentId?: number;
  departmentName?: string;
  userName?: string;
  nameEn?: string;
  nameAr?: string;
  requiresRoleSelection?: boolean;
  availableRoles?: RoleForSelection[];
  roleSelectionToken?: string;
}

/** Role row from /Users/me (aligned with UserRoleSummaryDto). */
export interface UserRoleDetail {
  id: string;
  name: string;
  nameAr?: string | null;
  /** True when this role is the user's default / active session role. */
  isDefaultRole?: boolean;
}

/**
 * Authenticated user response
 */
export interface AuthenticatedUser {
  id: string;
  userName: string;
  email: string;
  roles: string[];
  /** AspNetUsers.DefaultRoleId when provided by API. */
  defaultRoleId?: string | null;
  /** Rich roles from profile API; prefer for display over `roles` strings. */
  roleDetails?: UserRoleDetail[];
  permissions: ClaimDto[];
  isLdapUser?: boolean;
  ldapUserName?: string;
  departmentId?: number;
  departmentName?: string;
  departmentNameEn?: string;
  departmentNameAr?: string;
  nameEn?: string;
  nameAr?: string;
  rankId?: number;
  rankNameEn?: string;
  rankNameAr?: string;
  militaryId?: string;
}

/**
 * User claims/permissions from backend - matches C# ClaimDto exactly
 * Backend properties: Id (string), ClaimType (string)
 */
export interface ClaimDto {
  id: string;
  claimType: string;
}

/**
 * Forgot password request
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Reset password request
 */
export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * JWT Token payload (decoded)
 */
export interface JwtPayload {
  sub: string;
  userId: string;
  userName: string;
  email?: string;
  role?: string;
  exp: number;
  iat: number;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: AuthenticatedUser | null;
  token: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
}

