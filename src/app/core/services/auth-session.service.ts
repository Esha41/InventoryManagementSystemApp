import { Inject, Injectable, Injector, Optional } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';
import { ConfigService } from './config.service';
import { SessionHeartbeatService } from './session-heartbeat.service';
import { AuthenticatedUser, AuthState } from '@models/auth.model';
import { USER_PROFILE_PROVIDER } from '../tokens/user-profile-provider.token';
import { IUserProfileProvider } from '../interfaces/user-profile-provider.interface';
import { decodeJwtPayload } from '@utils/jwt.util';

/**
 * Auth session state (storage + subjects). No dependency on auth flow or facade — avoids DI cycles.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthSessionService {
  private authStateSubject = new BehaviorSubject<AuthState>(this.getInitialState());
  readonly authState$ = this.authStateSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<AuthenticatedUser | null>(null);
  readonly currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private isClearingAuthData = false;
  private isLogoutInProgress = false;
  private userContextService: { clearCache: () => void; primeCache?: (raw: unknown) => void } | null = null;

  constructor(
    private storageService: StorageService,
    private configService: ConfigService,
    @Optional() @Inject(USER_PROFILE_PROVIDER) private profileProvider: IUserProfileProvider | null,
    private sessionHeartbeat: SessionHeartbeatService,
    private injector: Injector
  ) {
    this.checkAuthStatus();
  }

  setUserContextService(service: { clearCache: () => void }): void {
    this.userContextService = service;
  }

  clearUserContextCacheIfBound(): void {
    this.userContextService?.clearCache();
  }

  clearAndPrimeUserContextCache(raw: unknown): void {
    this.userContextService?.clearCache();
    this.userContextService?.primeCache?.(raw);
  }

  get logoutInProgress(): boolean {
    return this.isLogoutInProgress;
  }

  setLogoutInProgress(value: boolean): void {
    this.isLogoutInProgress = value;
  }

  applyAuthenticatedSession(user: AuthenticatedUser, accessToken: string, expiresAt: Date): void {
    this.storageService.set('current_user', user);
    this.currentUserSubject.next(user);
    this.updateAuthState(user, accessToken, expiresAt);
  }

  /**
   * Updates the stored user's permissions/roles in place (storage + subject) without touching
   * the bearer token or expiry. Used to apply freshly fetched claims (e.g. after a delegatee
   * approves a delegation and inherits the delegator's role) without forcing a re-login.
   */
  updateCurrentUserClaims(permissions: AuthenticatedUser['permissions'], roles: AuthenticatedUser['roles']): void {
    const current = this.getCurrentUser();
    if (!current) {
      return;
    }
    const updated: AuthenticatedUser = { ...current, permissions, roles };
    this.storageService.set('current_user', updated);
    this.currentUserSubject.next(updated);
  }

  /**
   * After refresh: update bearer and expiry without rewriting `current_user` in storage.
   * The rotated refresh token lives only in the httpOnly cookie — never in storage.
   * If the access token identity does not match the session user (split cookie vs storage), sign out locally.
   */
  applyRefreshedTokens(accessToken: string, expiresAt: Date): void {
    const current = this.getCurrentUser();
    const payload = decodeJwtPayload<{ userId?: string; sub?: string }>(accessToken);
    const tokenUserId = String(payload?.userId ?? payload?.sub ?? '').trim();
    const sessionUserId = String(current?.id ?? '').trim();
    if (sessionUserId !== '' && tokenUserId !== '' && sessionUserId !== tokenUserId) {
      this.configService.logWarning('Access token user does not match session user after refresh; signing out', {
        sessionUserId,
        tokenUserId
      });
      this.clearSession();
      const router = this.injector.get(Router);
      void router.navigate(['/auth/login'], { queryParams: { sessionConflict: 'true' } });
      return;
    }

    const existingToken = this.storageService.get<string>('auth_token');
    if (existingToken !== accessToken) {
      this.storageService.set('auth_token', accessToken);
      this.storageService.set('token_expires_at', expiresAt);
    }
    const user = this.getCurrentUser();
    if (user) {
      this.updateAuthState(user, accessToken, expiresAt);
    }
    this.sessionHeartbeat.resume(true);
  }

  clearSessionForPendingRoleSelection(): void {
    this.sessionHeartbeat.pause();
    this.profileProvider?.clearProfile();
    this.storageService.remove('auth_token');
    this.storageService.remove('current_user');
    this.storageService.remove('token_expires_at');
    this.storageService.remove('user_profile_data');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.authStateSubject.next({
      isAuthenticated: false,
      user: null,
      token: null,
      expiresAt: null
    });
  }

  clearSession(): void {
    this.clearAuthData();
  }

  /**
   * Clears in-memory session only (subjects + heartbeat + profile cache).
   * Does NOT touch storage: use this when a peer tab now owns localStorage tokens
   * (e.g. cross-tab session change detected as a different user).
   */
  clearInMemorySession(): void {
    if (this.isClearingAuthData) {
      return;
    }
    this.sessionHeartbeat.pause();
    this.profileProvider?.clearProfile();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.authStateSubject.next({
      isAuthenticated: false,
      user: null,
      token: null,
      expiresAt: null
    });
  }

  pauseSessionHeartbeat(): void {
    this.sessionHeartbeat.pause();
  }

  resumeSessionHeartbeat(): void {
    this.sessionHeartbeat.resume(this.isAuthenticated());
  }

  getCurrentUser(): AuthenticatedUser | null {
    return this.currentUserSubject.value;
  }

  /** Token last written to `authState$` (cross-tab same-user sync vs shared localStorage). */
  getLastKnownAccessToken(): string | null {
    return this.authStateSubject.value?.token ?? null;
  }

  isAuthenticated(): boolean {
    if (this.isClearingAuthData) {
      return false;
    }
    return this.isAuthenticatedSubject.value;
  }

  isTokenExpired(): boolean {
    const expiresAt = this.storageService.get<Date>('token_expires_at');
    if (!expiresAt) return true;
    return new Date(expiresAt) <= new Date();
  }

  getTokenExpiresAt(): Date | null {
    return this.storageService.get<Date>('token_expires_at');
  }

  private getInitialState(): AuthState {
    const token = this.storageService.get<string>('auth_token');
    const user = this.storageService.get<AuthenticatedUser>('current_user');

    return {
      isAuthenticated: !!token && !!user,
      user: user,
      token: token,
      expiresAt: this.storageService.get<Date>('token_expires_at')
    };
  }

  private checkAuthStatus(): void {
    try {
      const state = this.getInitialState();

      if (state.isAuthenticated && state.user) {
        this.currentUserSubject.next(state.user);

        if (!this.isTokenExpired()) {
          this.isAuthenticatedSubject.next(true);
          this.authStateSubject.next(state);
          this.sessionHeartbeat.start();
          this.configService.log('User session restored', { userId: state.user.id });
        } else {
          this.authStateSubject.next({
            ...state,
            isAuthenticated: false
          });
          this.configService.log('Token expired - awaiting silent restore before treating session as active');
        }
      }
    } catch (error) {
      this.configService.logError('Failed to restore session', error);
      this.clearAuthData();
    }
  }

  private updateAuthState(user: AuthenticatedUser, token: string, expiresAt: Date): void {
    const state: AuthState = {
      isAuthenticated: true,
      user: user,
      token: token,
      expiresAt: expiresAt
    };

    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
    this.authStateSubject.next(state);
  }

  private clearAuthData(): void {
    if (this.isClearingAuthData) {
      return;
    }

    this.isClearingAuthData = true;
    this.sessionHeartbeat.pause();

    try {
      this.profileProvider?.clearProfile();
      // Legacy purge: older builds persisted the refresh token in localStorage.
      this.storageService.remove('refresh_token');
      this.storageService.removeSensitiveSessionBackedKeys();

      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      this.authStateSubject.next({
        isAuthenticated: false,
        user: null,
        token: null,
        expiresAt: null
      });
    } finally {
      setTimeout(() => {
        this.isClearingAuthData = false;
      }, 0);
    }
  }
}
