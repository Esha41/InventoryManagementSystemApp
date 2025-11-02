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

    // Create basic user object from token
    const basicUser: AuthenticatedUser = {
      id: tokenPayload?.sub || tokenPayload?.nameid || 'unknown',
      userName: tokenPayload?.unique_name || tokenPayload?.name || 'User',
      email: tokenPayload?.email || '',
      roles: [],
      permissions: []
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

        const user: AuthenticatedUser = {
          id: tokenPayload?.userId || '',
          userName: tokenPayload?.userName || '',
          email: tokenPayload?.email || '',
          roles: this.extractRoles(response.data),
          permissions: response.data
        };

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
    const permissionLower = permission.toLowerCase().trim();
    
    return user.permissions.some(p => {
      if (!p) return false;
      
      // Check both id and claimType fields
      const permissionId = (p.id || '').toLowerCase().trim();
      const claimType = (p.claimType || '').toLowerCase().trim();
      
      // Match if permission string matches either id or claimType
      // Also check if permission is contained in the id/claimType (for cases like "request.view" matching "Dashboard.Request.View")
      return permissionId === permissionLower ||
             claimType === permissionLower ||
             permissionId.includes(permissionLower) ||
             claimType.includes(permissionLower);
    });
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

