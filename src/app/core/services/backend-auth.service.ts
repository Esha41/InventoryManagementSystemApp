import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { map, tap, catchError, switchMap, finalize, shareReplay } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import {
  LoginRequest,
  LoginResponse,
  AuthenticatedUser,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ClaimDto,
  AuthState,
  CaptchaResponse
} from '@models/auth.model';
import { ChangePasswordRequest } from '@models/change-password.model';
import { ApiResponse } from '@models/api-response.model';
import { ProfileDataService } from './profile-data.service';

/**
 * Backend Authentication Service
 * Handles real API authentication with the backend
 */
@Injectable({
  providedIn: 'root'
})
export class BackendAuthService {
  private authStateSubject = new BehaviorSubject<AuthState>(this.getInitialState());
  public authState$ = this.authStateSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<AuthenticatedUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private isClearingAuthData = false; // Flag to prevent recursive calls
  private refreshInProgress: Observable<LoginResponse> | null = null;

  constructor(
    private apiService: ApiService,
    private storageService: StorageService,
    private configService: ConfigService,
    private profileDataService: ProfileDataService
  ) {
    this.checkAuthStatus();
  }

  private userContextService: { clearCache: () => void } | null = null;

  setUserContextService(service: { clearCache: () => void }): void {
    this.userContextService = service;
  }

  /**
   * Get initial auth state from storage
   */
  private getInitialState(): AuthState {
    const token = this.storageService.get<string>('auth_token');
    const user = this.storageService.get<AuthenticatedUser>('current_user');

    return {
      isAuthenticated: !!token && !!user,
      user: user,
      token: token,
      refreshToken: null,
      expiresAt: this.storageService.get<Date>('token_expires_at')
    };
  }

  /**
   * Check authentication status on service initialization
   * When token is expired, we keep the session - the next API call will get 401,
   * trigger the refresh flow (using HttpOnly cookie), and either succeed or redirect to login.
   */
  private checkAuthStatus(): void {
    try {
      const state = this.getInitialState();

      if (state.isAuthenticated && state.user) {
        this.currentUserSubject.next(state.user);
        this.isAuthenticatedSubject.next(true);
        this.authStateSubject.next(state);

        if (this.isTokenExpired()) {
          this.configService.log('Token expired - session kept; refresh will run on next API call');
        } else {
          this.configService.log('User session restored', { userId: state.user.id });
        }
      }
    } catch (error) {
      this.configService.logError('Failed to restore session', error);
      this.clearAuthData();
    }
  }

  /**
   * Generate captcha
   */
  generateCaptcha(): Observable<CaptchaResponse> {
    const endpoint = API_ENDPOINTS.AUTH.GENERATE_CAPTCHA;
    this.configService.log('Generating captcha', { endpoint, fullUrl: `${this.configService.apiUrl}${endpoint}` });
    return this.apiService.getRaw<any>(
      endpoint
    ).pipe(
      map(response => {
        this.configService.log('Captcha response received', response);

        // Handle wrapped response (ApiResponse)
        if (response && typeof response === 'object' && 'succeeded' in response) {
          const apiResponse = response as APIOperationResponse<CaptchaResponse>;
          if (!apiResponse.succeeded) {
            throw new Error(apiResponse.message || 'Failed to generate captcha');
          }
          if (!apiResponse.data || !(apiResponse.data as any).captchaId) {
            // Handle case where data might be the ID itself if backend is weird, 
            // but assuming standard data structure:
            if ((apiResponse.data as any).captchaId) return apiResponse.data as CaptchaResponse;
            throw new Error('Invalid captcha response: missing captchaId');
          }
          return apiResponse.data as CaptchaResponse;
        }

        // Handle direct response (Legacy/Fallback)
        if (response && typeof response === 'object' && 'captchaId' in response) {
          const directResponse = response as CaptchaResponse;
          if (!directResponse.captchaId) {
            throw new Error('Invalid captcha response: missing captchaId');
          }
          return directResponse;
        }

        // Unexpected response format
        this.configService.logError('Unexpected captcha response format', response);
        throw new Error('Invalid captcha response format');
      }),
      catchError(error => {
        this.configService.logError('Failed to generate captcha', error);
        const errorMessage = error?.error?.message ||
          error?.message ||
          error?.error?.data?.message ||
          'Failed to generate captcha. Please try again.';
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Get captcha image URL with cache-busting parameter
   */
  getCaptchaImageUrl(captchaId: string): string {
    // Try the primary endpoint first
    const baseUrl = `${this.configService.apiUrl}${API_ENDPOINTS.AUTH.CAPTCHA_IMAGE(captchaId)}`;
    // Add cache-busting parameter to ensure fresh image on refresh
    const timestamp = new Date().getTime();
    return `${baseUrl}?t=${timestamp}`;
  }

  /**
   * Get alternative captcha image URL
   */
  getAlternativeCaptchaImageUrl(captchaId: string): string {
    const baseUrl = `${this.configService.apiUrl}${API_ENDPOINTS.AUTH.CAPTCHA_IMAGE_ALT(captchaId)}`;
    const timestamp = new Date().getTime();
    return `${baseUrl}?t=${timestamp}`;
  }

  /**
   * Login with username and password
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    this.configService.log('Attempting login', { username: credentials.username });

    return this.apiService.postRaw<LoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Login failed');
        }
        return response.data;
      }),
      switchMap(loginResponse => this.handleLoginSuccess(loginResponse)),
      catchError(error => {
        this.configService.logError('Login failed', error);
        this.clearAuthData();
        // Pass through original error so login component can extract status, errorCode, message for proper user feedback
        return throwError(() => error);
      })
    );
  }

  private handleLoginSuccess(response: LoginResponse): Observable<LoginResponse> {
    this.configService.log('Login successful');

    const expiresAt = new Date(response.expiresAt);

    this.storageService.set('auth_token', response.accessToken);
    this.storageService.set('token_expires_at', expiresAt);

    return this.fetchCompleteUserData().pipe(
      switchMap(completeUser => {
        if (!completeUser) {
          this.configService.logError('Failed to fetch user data from /Users/me API', null);
          this.clearAuthData();
          return throwError(() => new Error('Failed to load user profile. Please try logging in again.'));
        }

        const authenticatedUser: AuthenticatedUser = {
          id: completeUser.id || '',
          userName: completeUser.userName || '',
          email: completeUser.email || '',
          roles: [],
          permissions: [],
          departmentId: completeUser.departmentId,
          departmentName: completeUser.departmentName,
          organizationId: completeUser.organizationId,
          nameEn: completeUser.nameEn,
          nameAr: completeUser.nameAr
        };

        if (this.userContextService) {
          this.userContextService.clearCache();
        }

        // Fetch full user profile from /Users/me for ProfileDataService
        return this.apiService.post<any>(API_ENDPOINTS.USERS.ME, {}).pipe(
          switchMap(userMeData => {
            return this.getUserClaims().pipe(
              map(userWithClaims => {
                const mergedUser: AuthenticatedUser = {
                  ...authenticatedUser,
                  permissions: userWithClaims.permissions || [],
                  roles: userWithClaims.roles || []
                };

                this.configService.log('Login complete with permissions', {
                  userId: mergedUser.id,
                  userName: mergedUser.userName,
                  permissionsCount: mergedUser.permissions?.length || 0,
                  rolesCount: mergedUser.roles?.length || 0,
                  samplePermissions: mergedUser.permissions?.slice(0, 5).map(p => p.id || p.claimType)
                });

                // Save profile data including isSuperAdmin flag
                this.profileDataService.saveProfile(mergedUser, userMeData);

                this.storageService.set('current_user', mergedUser);
                this.currentUserSubject.next(mergedUser);
                this.updateAuthState(mergedUser, response.accessToken, expiresAt);

                return response;
              }),
              catchError((error) => {
                this.configService.logError('Failed to fetch user claims, proceeding without permissions', error);

                // Still save profile data even without claims
                this.profileDataService.saveProfile(authenticatedUser, userMeData);

                this.storageService.set('current_user', authenticatedUser);
                this.currentUserSubject.next(authenticatedUser);
                this.updateAuthState(authenticatedUser, response.accessToken, expiresAt);
                return of(response);
              })
            );
          }),
          catchError(error => {
            // Fallback: save profile without /Users/me data
            return this.getUserClaims().pipe(
              map(userWithClaims => {
                const mergedUser: AuthenticatedUser = {
                  ...authenticatedUser,
                  permissions: userWithClaims.permissions || [],
                  roles: userWithClaims.roles || []
                };

                this.profileDataService.saveProfile(mergedUser);
                this.storageService.set('current_user', mergedUser);
                this.currentUserSubject.next(mergedUser);
                this.updateAuthState(mergedUser, response.accessToken, expiresAt);
                return response;
              }),
              catchError((error) => {
                this.configService.logError('Failed to fetch user claims, proceeding without permissions', error);
                this.profileDataService.saveProfile(authenticatedUser);
                this.storageService.set('current_user', authenticatedUser);
                this.currentUserSubject.next(authenticatedUser);
                this.updateAuthState(authenticatedUser, response.accessToken, expiresAt);
                return of(response);
              })
            );
          })
        );
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch user data from /Users/me API', error);
        this.clearAuthData();
        return throwError(() => new Error('Failed to load user profile. Please try logging in again.'));
      })
    );
  }

  private fetchCompleteUserData(): Observable<AuthenticatedUser | null> {
    return this.apiService.post<any>(API_ENDPOINTS.USERS.ME, {}).pipe(
      map(apiData => {
        if (!apiData) {
          return null;
        }

        const departmentId = this.tryParseNumber(
          apiData.department?.id ??
          apiData.deparmentId ??
          apiData.DeparmentId ??
          apiData.departmentId ??
          apiData.DepartmentId
        );

        const departmentName = (
          apiData.department?.nameEn ??
          apiData.department?.NameEn ??
          apiData.Department?.NameEn ??
          apiData.department?.nameAr ??
          apiData.department?.NameAr ??
          apiData.Department?.NameAr ??
          apiData.departmentName ??
          apiData.DepartmentName
        ) || undefined;

        const nameEn = (
          apiData.fullNameEN ??
          apiData.FullNameEN ??
          apiData.fullNameEn ??
          apiData.FullNameEn ??
          apiData.nameEn ??
          apiData.NameEn
        ) || undefined;

        const nameAr = (
          apiData.fullNameAR ??
          apiData.FullNameAR ??
          apiData.fullNameAr ??
          apiData.FullNameAr ??
          apiData.nameAr ??
          apiData.NameAr
        ) || undefined;

        const organizationId = this.tryParseNumber(
          apiData.organizationId ?? apiData.OrganizationId
        );

        return {
          id: apiData.id ?? apiData.Id ?? '',
          userName: apiData.userName ?? apiData.UserName ?? '',
          email: apiData.email ?? apiData.Email ?? '',
          roles: [],
          permissions: [],
          departmentId: departmentId ?? undefined,
          departmentName: departmentName,
          organizationId: organizationId ?? undefined,
          nameEn: nameEn,
          nameAr: nameAr
        } as AuthenticatedUser;
      }),
      catchError(() => {
        return of(null);
      })
    );
  }

  /**
   * Get user claims from backend
   */
  getUserClaims(): Observable<AuthenticatedUser> {
    return this.apiService.get<ClaimDto[]>(
      API_ENDPOINTS.AUTH.USER_CLAIMS
    ).pipe(
      map(claims => {
        if (!claims) {
          throw new Error('Failed to fetch user claims');
        }

        // Extract user info from token or claims
        const token = this.storageService.get<string>('auth_token');
        const tokenPayload = token ? this.decodeToken(token) : null;

        const user: AuthenticatedUser = {
          id: tokenPayload?.userId || '',
          userName: tokenPayload?.userName || '',
          email: tokenPayload?.email || '',
          roles: this.extractRoles(claims),
          permissions: claims
        };

        const departmentIdClaim = this.getClaimValue(claims, ['departmentid', 'deptid', 'department']);
        const departmentNameClaim = this.getClaimValue(claims, ['departmentname', 'deptname']);
        const fullNameEnClaim = this.getClaimValue(claims, ['fullnameen', 'nameen', 'full_name_en']);
        const fullNameArClaim = this.getClaimValue(claims, ['fullnamear', 'namear', 'full_name_ar']);
        const organizationIdClaim = this.getClaimValue(claims, ['organizationid', 'orgid', 'organization']);

        const parsedDepartmentId =
          this.tryParseNumber(departmentIdClaim) ??
          this.tryParseNumber(tokenPayload?.DepartmentId ?? tokenPayload?.departmentId ?? tokenPayload?.DeptId);
        const parsedOrganizationId =
          this.tryParseNumber(organizationIdClaim) ??
          this.tryParseNumber(tokenPayload?.OrganizationId ?? tokenPayload?.organizationId ?? tokenPayload?.OrgId);
        const resolvedDepartmentName =
          departmentNameClaim ??
          tokenPayload?.DepartmentName ??
          tokenPayload?.departmentName ??
          tokenPayload?.DeptName;
        const resolvedNameEn =
          fullNameEnClaim ??
          tokenPayload?.FullNameEN ??
          tokenPayload?.fullNameEN ??
          tokenPayload?.FullNameEn ??
          tokenPayload?.fullNameEn ??
          tokenPayload?.NameEn ??
          tokenPayload?.nameEn;
        const resolvedNameAr =
          fullNameArClaim ??
          tokenPayload?.FullNameAR ??
          tokenPayload?.fullNameAR ??
          tokenPayload?.FullNameAr ??
          tokenPayload?.fullNameAr ??
          tokenPayload?.NameAr ??
          tokenPayload?.nameAr;

        if (parsedDepartmentId !== undefined) {
          user.departmentId = parsedDepartmentId;
        }
        if (resolvedDepartmentName) {
          user.departmentName = resolvedDepartmentName;
        }
        if (parsedOrganizationId !== undefined) {
          user.organizationId = parsedOrganizationId;
        }
        if (resolvedNameEn) {
          user.nameEn = resolvedNameEn;
        }
        if (resolvedNameAr) {
          user.nameAr = resolvedNameAr;
        }

        return user;
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch user claims', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Extract roles from claims
   */
  private extractRoles(claims: ClaimDto[]): string[] {
    return claims
      .filter(claim => claim.claimType && (claim.claimType.toLowerCase().includes('role')))
      .map(claim => claim.id);
  }

  /**
   * Try to parse number from claim value
   */
  private tryParseNumber(value: string | number | null | undefined): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /**
   * Normalize claim key for comparison
   */
  private normalizeClaimKey(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    return value
      .toLowerCase()
      .replace('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/', '')
      .replace('http://schemas.microsoft.com/ws/2008/06/identity/claims/', '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Extract claim value by matching claim type against known keys
   */
  private getClaimValue(claims: ClaimDto[], keys: string[]): string | null {
    if (!claims?.length || !keys?.length) {
      return null;
    }

    const normalizedKeys = keys.map(key => this.normalizeClaimKey(key));
    for (const claim of claims) {
      const claimTypeNormalized = this.normalizeClaimKey(claim.claimType);
      if (normalizedKeys.includes(claimTypeNormalized) && claim.id) {
        return claim.id;
      }
    }

    return null;
  }

  /**
   * Decode JWT token
   */
  private decodeToken(token: string): any {
    try {
      if (!token || typeof token !== 'string') {
        return null;
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      if (!payload) {
        return null;
      }

      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (error) {
      return null;
    }
  }

  /**
   * Update authentication state
   */
  private updateAuthState(user: AuthenticatedUser, token: string, expiresAt: Date): void {
    const state: AuthState = {
      isAuthenticated: true,
      user: user,
      token: token,
      refreshToken: null,
      expiresAt: expiresAt
    };

    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
    this.authStateSubject.next(state);
  }

  /**
   * Refresh access token using HttpOnly cookie.
   * Serializes concurrent calls - only one refresh at a time.
   */
  refreshToken(): Observable<LoginResponse> {
    if (!this.refreshInProgress) {
      this.refreshInProgress = this.apiService.postRaw<LoginResponse>(
        API_ENDPOINTS.AUTH.REFRESH,
        {},
        { withCredentials: true }
      ).pipe(
        map(res => {
          if (!res.succeeded || !res.data) {
            throw new Error(res.message || 'Refresh failed');
          }
          return res.data;
        }),
        tap(data => {
          this.storageService.set('auth_token', data.accessToken);
          this.storageService.set('token_expires_at', new Date(data.expiresAt));
          const user = this.getCurrentUser();
          if (user) {
            this.updateAuthState(user, data.accessToken, new Date(data.expiresAt));
          }
        }),
        finalize(() => {
          this.refreshInProgress = null;
        }),
        shareReplay(1)
      );
    }
    return this.refreshInProgress;
  }

  /**
   * Logout current user
   */
  logout(): Observable<boolean> {
    this.configService.log('Logging out user');

    // Call backend logout endpoint to invalidate refresh token
    return this.apiService.post<string>(API_ENDPOINTS.AUTH.LOGOUT, {}).pipe(
      map(() => {
        this.configService.log('Backend logout successful');
        this.clearAuthData();
        return true;
      }),
      catchError(error => {
        // Even if backend logout fails, clear local data to ensure user is logged out
        this.configService.logError('Backend logout failed, clearing local data anyway', error);
        this.clearAuthData();
        return of(true);
      })
    );
  }

  /**
   * Change password for current user
   */
  changePassword(request: ChangePasswordRequest): Observable<boolean> {
    this.configService.log('Attempting to change password');

    return this.apiService.put<boolean>(
      API_ENDPOINTS.USERS.CHANGE_PASSWORD,
      request
    ).pipe(
      map(succeeded => {
        if (!succeeded) {
          throw new Error('Password change failed');
        }
        this.configService.log('Password changed successfully');
        return true;
      }),
      catchError(error => {
        this.configService.logError('Change password failed', error);
        return throwError(() => new Error(
          error.userMessage || error.message || 'Failed to change password. Please try again.'
        ));
      })
    );
  }

  /**
   * Request password reset (forgot password)
   */
  forgotPassword(email: string): Observable<boolean> {
    this.configService.log('Requesting password reset', { email });

    return this.apiService.postRaw<string>(
      API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
      { email }
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to send password reset email');
        }
        this.configService.log('Password reset email sent successfully');
        return true;
      }),
      catchError(error => {
        this.configService.logError('Forgot password failed', error);
        return throwError(() => new Error(
          error.userMessage || error.message || 'Failed to send password reset email. Please try again.'
        ));
      })
    );
  }

  /**
   * Reset password with token
   */
  resetPassword(email: string, token: string, newPassword: string): Observable<boolean> {
    this.configService.log('Attempting to reset password', { email });

    return this.apiService.postRaw<string>(
      API_ENDPOINTS.AUTH.RESET_PASSWORD,
      { email, token, newPassword }
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Password reset failed');
        }
        this.configService.log('Password reset successfully');
        return true;
      }),
      catchError(error => {
        this.configService.logError('Reset password failed', error);
        return throwError(() => new Error(
          error.userMessage || error.message || 'Failed to reset password. Please try again.'
        ));
      })
    );
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): AuthenticatedUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   * Returns true if we have a session (even when token is expired - refresh will run on next API call)
   */
  isAuthenticated(): boolean {
    if (this.isClearingAuthData) {
      return false;
    }
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Normalize permission string for comparison
   * Converts formats like "role.view" or "Permissions.Roles.View" to a common format
   * Examples:
   * - "Permissions.Roles.View" -> "roleview"
   * - "Permissions.Roles.Page" -> "rolepage"
   * - "role.view" -> "roleview"
   * - "Roles.View" -> "roleview"
   */
  private normalizePermission(permission: string): string {
    if (!permission) return '';

    let normalized = permission.toLowerCase().trim();

    // Remove "Permissions." prefix if present
    normalized = normalized.replace(/^permissions\./, '');

    // Handle formats like "Roles.View" or "Roles.Edit"
    // Extract the entity name (Roles, Warehouse, etc.) and action (View, Edit, Create, Delete, Page)
    const parts = normalized.split('.');
    if (parts.length >= 2) {
      // Get last part (action) and second-to-last or last entity name
      const action = parts[parts.length - 1]; // View, Edit, Create, Delete, Page, etc.
      const entity = parts.length > 2 ? parts[parts.length - 2] : parts[0]; // Roles, Warehouse, etc.

      // Convert "Roles" -> "role", "Warehouse" -> "warehouse"
      const entityNormalized = entity.replace(/s$/, '').toLowerCase(); // Remove plural 's'

      // Combine: "role" + "view" = "roleview" OR "role" + "page" = "rolepage"
      // Note: page and view are now treated as different permissions
      normalized = entityNormalized + action;
    } else {
      // Handle simple formats like "role.view"
      normalized = normalized.replace(/\./g, '').replace(/\s+/g, '');
    }

    return normalized;
  }

  /**
   * Check if a permission string matches (handles multiple formats)
   * Examples:
   * - "Permissions.Roles.View" matches "role.view", "Roles.View", "roles.view"
   * - "role.view" matches "Permissions.Roles.View", "Roles.View"
   */
  private permissionMatches(userPermission: string, requiredPermission: string): boolean {
    if (!userPermission || !requiredPermission) return false;

    const userNorm = this.normalizePermission(userPermission);
    const requiredNorm = this.normalizePermission(requiredPermission);


    if (userNorm === requiredNorm) return true;


    if (!requiredPermission.includes('.') && !userPermission.includes('.')) {
      return false;
    }

    if (userPermission.includes('.') || requiredPermission.includes('.')) {
      return userNorm === requiredNorm || userNorm.includes(requiredNorm);
    }

    return false;
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }


    const token = this.storageService.get<string>('auth_token');
    if (token) {
      try {
        const payload = this.decodeToken(token);
        if (payload?.IsSuperAdmin === 'true') {
          return true; // Super admin has ALL permissions
        }
      } catch (error) {
        // If token decoding fails, continue with permission check
        // Don't log error here to avoid console spam
      }
    }

    // Check permissions - user.permissions should contain ALL permissions from ALL roles combined
    const hasPermission = user.permissions.some(p => {
      if (!p) return false;

      // Check both id and claimType fields
      const permissionId = p.id || '';
      const claimType = p.claimType || '';

      // Use the new matching function that handles format differences
      return this.permissionMatches(permissionId, permission) ||
        this.permissionMatches(claimType, permission);
    });

    return hasPermission;
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.roles) return false;

    return user.roles.some(r => r.toLowerCase() === role.toLowerCase());
  }

  /**
   * Check if current user is a super admin
   */
  isSuperAdmin(): boolean {
    const token = this.storageService.get<string>('auth_token');
    if (token) {
      try {
        const payload = this.decodeToken(token);
        return payload?.IsSuperAdmin === 'true';
      } catch (error) {
        // If token decoding fails, return false
        return false;
      }
    }
    return false;
  }

  /**
   * Clear session without calling backend. Use when refresh fails.
   */
  clearSession(): void {
    this.clearAuthData();
  }

  /**
   * Clear authentication data
   */
  private clearAuthData(): void {
    // Prevent recursive calls
    if (this.isClearingAuthData) {
      return;
    }

    this.isClearingAuthData = true;

    try {
      // Clear specific auth-related storage items
      this.storageService.remove('auth_token');
      this.storageService.remove('current_user');
      this.storageService.remove('token_expires_at');

      // Clear all localStorage and sessionStorage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Update observables
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      this.authStateSubject.next({
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        expiresAt: null
      });
    } finally {
      // Use setTimeout to reset the flag after the current execution cycle
      // This ensures any subscriptions triggered by the above next() calls complete first
      setTimeout(() => {
        this.isClearingAuthData = false;
      }, 0);
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    const expiresAt = this.storageService.get<Date>('token_expires_at');
    if (!expiresAt) return true;

    return new Date(expiresAt) <= new Date();
  }

  /**
   * Get token expiration time
   */
  getTokenExpiresAt(): Date | null {
    return this.storageService.get<Date>('token_expires_at');
  }
}

