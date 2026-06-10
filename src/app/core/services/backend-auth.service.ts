import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { AuthSessionService } from './auth-session.service';
import { AuthFlowService } from './auth-flow.service';
import { TokenRefreshService } from './token-refresh.service';
import {
  LoginRequest,
  LoginResponse,
  AuthenticatedUser,
  CaptchaResponse
} from '@models/auth.model';
import { ChangePasswordRequest } from '@models/change-password.model';
import { decodeJwtPayload } from '@utils/jwt.util';

/**
 * Facade for authentication: permissions + delegation to session, flow, and token refresh.
 */
@Injectable({
  providedIn: 'root'
})
export class BackendAuthService {
  readonly authState$ = this.session.authState$;
  readonly currentUser$ = this.session.currentUser$;
  readonly isAuthenticated$ = this.session.isAuthenticated$;

  constructor(
    private storageService: StorageService,
    private session: AuthSessionService,
    private tokenRefresh: TokenRefreshService,
    private authFlow: AuthFlowService
  ) {}

  setUserContextService(service: { clearCache: () => void }): void {
    this.session.setUserContextService(service);
  }

  generateCaptcha(): Observable<CaptchaResponse> {
    return this.authFlow.generateCaptcha();
  }

  getCaptchaImageUrl(captchaId: string): string {
    return this.authFlow.getCaptchaImageUrl(captchaId);
  }

  getAlternativeCaptchaImageUrl(captchaId: string): string {
    return this.authFlow.getAlternativeCaptchaImageUrl(captchaId);
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.authFlow.login(credentials);
  }

  selectRole(roleId: string, options?: { switchWhileLoggedIn?: boolean }): Observable<LoginResponse> {
    return this.authFlow.selectRole(roleId, options);
  }

  getUserClaims(): Observable<AuthenticatedUser> {
    return this.authFlow.getUserClaims();
  }

  /**
   * Re-fetches the current user's claims and applies them to the active session in place, so
   * newly inherited permissions (e.g. after approving a delegation) take effect without a re-login.
   */
  refreshUserClaims(): Observable<AuthenticatedUser> {
    return this.authFlow.getUserClaims().pipe(
      tap(userWithClaims => {
        this.session.updateCurrentUserClaims(userWithClaims.permissions || [], userWithClaims.roles || []);
      })
    );
  }

  refreshToken(): Observable<LoginResponse> {
    return this.tokenRefresh.getRefreshedLoginResponse().pipe(
      tap(data => {
        this.session.applyRefreshedTokens(data.accessToken, new Date(data.expiresAt));
      })
    );
  }

  restoreSessionSilently(): Observable<boolean> {
    return this.authFlow.restoreSessionSilently();
  }

  logout(): Observable<boolean> {
    return this.authFlow.logout();
  }

  changePassword(request: ChangePasswordRequest): Observable<boolean> {
    return this.authFlow.changePassword(request);
  }

  forgotPassword(email: string): Observable<boolean> {
    return this.authFlow.forgotPassword(email);
  }

  resetPassword(email: string, token: string, newPassword: string): Observable<boolean> {
    return this.authFlow.resetPassword(email, token, newPassword);
  }

  getCurrentUser(): AuthenticatedUser | null {
    return this.session.getCurrentUser();
  }

  isAuthenticated(): boolean {
    return this.session.isAuthenticated();
  }

  private normalizePermission(permission: string): string {
    if (!permission) return '';

    let normalized = permission.toLowerCase().trim();

    normalized = normalized.replace(/^permissions\./, '');

    const parts = normalized.split('.');
    if (parts.length >= 2) {
      const action = parts[parts.length - 1];
      const entity = parts.length > 2 ? parts[parts.length - 2] : parts[0];

      const entityNormalized = entity.replace(/s$/, '').toLowerCase();

      normalized = entityNormalized + action;
    } else {
      normalized = normalized.replace(/\./g, '').replace(/\s+/g, '');
    }

    return normalized;
  }

  /**
   * Equality (not substring) comparison of normalized permission keys.
   * Historical substring behavior could over-grant (e.g. required "role" matching user's "roleview").
   */
  private permissionMatches(userPermission: string, requiredPermission: string): boolean {
    if (!userPermission || !requiredPermission) return false;
    return this.normalizePermission(userPermission) === this.normalizePermission(requiredPermission);
  }

  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }

    if (this.isSuperAdmin()) {
      return true;
    }

    return user.permissions.some(p => {
      if (!p) return false;

      const permissionId = p.id || '';
      const claimType = p.claimType || '';

      return this.permissionMatches(permissionId, permission) || this.permissionMatches(claimType, permission);
    });
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.roles) return false;

    return user.roles.some(r => r.toLowerCase() === role.toLowerCase());
  }

  isSuperAdmin(): boolean {
    const token = this.storageService.get<string>('auth_token');
    const payload = decodeJwtPayload<{ IsSuperAdmin?: string }>(token);
    return payload?.IsSuperAdmin === 'true';
  }

  get isLoggingOut(): boolean {
    return this.session.logoutInProgress;
  }

  clearSession(): void {
    this.session.clearSession();
  }

  pauseSessionHeartbeat(): void {
    this.session.pauseSessionHeartbeat();
  }

  resumeSessionHeartbeat(): void {
    this.session.resumeSessionHeartbeat();
  }

  isTokenExpired(): boolean {
    return this.session.isTokenExpired();
  }

  getTokenExpiresAt(): Date | null {
    return this.session.getTokenExpiresAt();
  }
}
