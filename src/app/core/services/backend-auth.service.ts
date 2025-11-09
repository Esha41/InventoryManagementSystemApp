import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { 
  LoginRequest, 
  LoginResponse, 
  AuthenticatedUser, 
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ClaimDto,
  AuthState
} from '@models/auth.model';
import { ApiResponse } from '@models/api-response.model';

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

  constructor(
    private apiService: ApiService,
    private storageService: StorageService,
    private configService: ConfigService
  ) {
    this.checkAuthStatus();
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
      refreshToken: this.storageService.get<string>('refresh_token'),
      expiresAt: this.storageService.get<Date>('token_expires_at')
    };
  }

  /**
   * Check authentication status on service initialization
   */
  private checkAuthStatus(): void {
    try {
      const state = this.getInitialState();
      
      if (state.isAuthenticated && state.user) {
        this.currentUserSubject.next(state.user);
        this.isAuthenticatedSubject.next(true);
        this.authStateSubject.next(state);
        
        this.configService.log('User session restored', { userId: state.user.id });
      }
    } catch (error) {
      this.configService.logError('Failed to restore session', error);
      this.clearAuthData();
    }
  }

  /**
   * Login with username and password
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    this.configService.log('Attempting login', { username: credentials.username });

    return this.apiService.post<ApiResponse<LoginResponse>>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Login failed');
        }
        return response.data;
      }),
      tap(loginResponse => {
        this.handleLoginSuccess(loginResponse);
      }),
      catchError(error => {
        this.configService.logError('Login failed', error);
        return throwError(() => new Error(
          error.userMessage || error.message || 'Login failed. Please check your credentials.'
        ));
      })
    );
  }

  /**
   * Handle successful login
   */
  private handleLoginSuccess(response: LoginResponse): void {
    this.configService.log('Login successful');

    // Parse expiration date from backend
    const expiresAt = new Date(response.expiresAt);

    // Store authentication data
    this.storageService.set('auth_token', response.accessToken);
    if (response.refreshToken) {
      this.storageService.set('refresh_token', response.refreshToken);
    }
    this.storageService.set('token_expires_at', expiresAt);

    // Decode token to get basic user info
    const tokenPayload = this.decodeToken(response.accessToken);

    const departmentId =
      this.tryParseNumber(response.departmentId) ??
      this.tryParseNumber(tokenPayload?.DepartmentId ?? tokenPayload?.departmentId ?? tokenPayload?.DeptId);

    const employeeId =
      this.tryParseNumber(response.employeeId) ??
      this.tryParseNumber(tokenPayload?.EmployeeId ?? tokenPayload?.employeeId ?? tokenPayload?.EmpId);

    const organizationId =
      this.tryParseNumber(response.organizationId) ??
      this.tryParseNumber(tokenPayload?.OrganizationId ?? tokenPayload?.organizationId ?? tokenPayload?.OrgId);

    const departmentName =
      response.departmentName ??
      tokenPayload?.DepartmentName ??
      tokenPayload?.departmentName ??
      tokenPayload?.DeptName;

    const nameEn =
      response.nameEn ??
      tokenPayload?.FullNameEN ??
      tokenPayload?.fullNameEN ??
      tokenPayload?.FullNameEn ??
      tokenPayload?.fullNameEn ??
      tokenPayload?.NameEn ??
      tokenPayload?.nameEn;

    const nameAr =
      response.nameAr ??
      tokenPayload?.FullNameAR ??
      tokenPayload?.fullNameAR ??
      tokenPayload?.FullNameAr ??
      tokenPayload?.fullNameAr ??
      tokenPayload?.NameAr ??
      tokenPayload?.nameAr;

    const tokenUserNameFallback = tokenPayload?.unique_name || tokenPayload?.name || 'User';

    const resolvedUserName =
      response.userName ??
      tokenPayload?.UserName ??
      tokenPayload?.userName ??
      tokenUserNameFallback;

    const basicUser: AuthenticatedUser = {
      id: tokenPayload?.sub || tokenPayload?.nameid || 'unknown',
      userName: resolvedUserName,
      email: tokenPayload?.email || '',
      roles: [],
      permissions: [],
      departmentId: departmentId ?? undefined,
      departmentName: departmentName ?? undefined,
      employeeId: employeeId ?? undefined,
      organizationId: organizationId ?? undefined,
      nameEn: nameEn ?? undefined,
      nameAr: nameAr ?? undefined
    };

    // Store user and update auth state
    this.storageService.set('current_user', basicUser);
    this.updateAuthState(basicUser, response.accessToken, expiresAt);

    // Fetch claims in background
    setTimeout(() => {
      this.getUserClaims().subscribe({
        next: (user) => {
          this.storageService.set('current_user', user);
          this.currentUserSubject.next(user);
          this.configService.log('User claims loaded', { permissions: user.permissions.length });
        },
        error: (error) => {
          this.configService.logError('Failed to fetch user claims', error);
        }
      });
    }, 300);
  }

  /**
   * Get user claims from backend
   */
  getUserClaims(): Observable<AuthenticatedUser> {
    return this.apiService.getWithAuth<ApiResponse<ClaimDto[]>>(
      API_ENDPOINTS.AUTH.USER_CLAIMS
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error('Failed to fetch user claims');
        }

        // Extract user info from token or claims
        const token = this.storageService.get<string>('auth_token');
        const tokenPayload = token ? this.decodeToken(token) : null;

        const claims = response.data;

        const user: AuthenticatedUser = {
          id: tokenPayload?.userId || '',
          userName: tokenPayload?.userName || '',
          email: tokenPayload?.email || '',
          roles: this.extractRoles(claims),
          permissions: claims
        };

        const departmentIdClaim = this.getClaimValue(claims, ['departmentid', 'deptid', 'department']);
        const departmentNameClaim = this.getClaimValue(claims, ['departmentname', 'deptname']);
        const employeeIdClaim = this.getClaimValue(claims, ['employeeid', 'empid', 'employee']);
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
        const parsedEmployeeId =
          this.tryParseNumber(employeeIdClaim) ??
          this.tryParseNumber(tokenPayload?.EmployeeId ?? tokenPayload?.employeeId ?? tokenPayload?.EmpId);
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
        if (parsedEmployeeId !== undefined) {
          user.employeeId = parsedEmployeeId;
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
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (error) {
      this.configService.logError('Failed to decode token', error);
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
      refreshToken: this.storageService.get<string>('refresh_token'),
      expiresAt: expiresAt
    };

    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
    this.authStateSubject.next(state);
  }

  /**
   * Logout current user
   */
  logout(): Observable<boolean> {
    this.configService.log('Logging out user');
    
    // Clear auth data
    this.clearAuthData();
    
    // You can optionally call a backend logout endpoint here
    // return this.apiService.post(API_ENDPOINTS.AUTH.LOGOUT, {});
    
    return new Observable(observer => {
      observer.next(true);
      observer.complete();
    });
  }

  /**
   * Forgot password
   */
  forgotPassword(request: ForgotPasswordRequest): Observable<boolean> {
    return this.apiService.post<ApiResponse<any>>(
      API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
      request
    ).pipe(
      map(response => response.succeeded),
      catchError(error => {
        this.configService.logError('Forgot password failed', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Reset password
   */
  resetPassword(request: ResetPasswordRequest): Observable<boolean> {
    return this.apiService.post<ApiResponse<any>>(
      API_ENDPOINTS.AUTH.RESET_PASSWORD,
      request
    ).pipe(
      map(response => response.succeeded),
      catchError(error => {
        this.configService.logError('Reset password failed', error);
        return throwError(() => error);
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
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Normalize permission string for comparison
   * Converts formats like "role.view" or "Permissions.Roles.View" to a common format
   * Examples:
   * - "Permissions.Roles.View" -> "roleview"
   * - "Permissions.Roles.Page" -> "roleview" (Page is equivalent to View)
   * - "role.view" -> "roleview"
   * - "Roles.View" -> "roleview"
   */
  private normalizePermission(permission: string): string {
    if (!permission) return '';
    
    let normalized = permission.toLowerCase().trim();
    
    // Remove "Permissions." prefix if present
    normalized = normalized.replace(/^permissions\./, '');
    
    // Handle formats like "Roles.View" or "Roles.Edit"
    // Extract the entity name (Roles, Warehouse, etc.) and action (View, Edit, Create, Delete)
    const parts = normalized.split('.');
    if (parts.length >= 2) {
      // Get last part (action) and second-to-last or last entity name
      let action = parts[parts.length - 1]; // View, Edit, Create, Delete, Page, etc.
      const entity = parts.length > 2 ? parts[parts.length - 2] : parts[0]; // Roles, Warehouse, etc.
      
      // Convert "Roles" -> "role", "Warehouse" -> "warehouse"
      const entityNormalized = entity.replace(/s$/, '').toLowerCase(); // Remove plural 's'
      
      // Normalize action: "page" is equivalent to "view" for access control
      if (action === 'page') {
        action = 'view';
      }
      
      // Combine: "role" + "view" = "roleview"
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

    // Exact match after normalization
    if (userNorm === requiredNorm) return true;

    // Also check if normalized user permission contains required (or vice versa)
    // This handles edge cases where formats differ slightly
    return userNorm.includes(requiredNorm) || requiredNorm.includes(userNorm);
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }

    // Check if user has IsSuperAdmin claim from token
    const token = this.storageService.get<string>('auth_token');
    if (token) {
      const payload = this.decodeToken(token);
      if (payload?.IsSuperAdmin === 'true') {
        return true; // Super admin has ALL permissions
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

    // Debug logging for permission checks (only for role-related permissions to avoid spam)
    if (permission.toLowerCase().includes('role')) {
      console.log('Permission Check:', {
        required: permission,
        hasPermission: hasPermission,
        userPermissions: user.permissions.map(p => ({
          id: p.id,
          claimType: p.claimType,
          normalizedId: this.normalizePermission(p.id || ''),
          normalizedClaimType: this.normalizePermission(p.claimType || ''),
          requiredNormalized: this.normalizePermission(permission)
        }))
      });
    }

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
   * Clear authentication data
   */
  private clearAuthData(): void {
    this.storageService.remove('auth_token');
    this.storageService.remove('refresh_token');
    this.storageService.remove('current_user');
    this.storageService.remove('token_expires_at');
    
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.authStateSubject.next({
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      expiresAt: null
    });
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

