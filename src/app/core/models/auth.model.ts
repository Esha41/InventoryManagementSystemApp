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
  organizationId?: number;
  userName?: string;
  nameEn?: string;
  nameAr?: string;
}

/**
 * Authenticated user response
 */
export interface AuthenticatedUser {
  id: string;
  userName: string;
  email: string;
  roles: string[];
  permissions: ClaimDto[];
  isLdapUser?: boolean;
  ldapUserName?: string;
  organizationId?: number;
  departmentId?: number;
  departmentName?: string;
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

