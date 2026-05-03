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
   * After refresh: update bearer, expiry, and rotated refresh token without rewriting `current_user` in storage.
   * If the access token identity does not match the session user (split cookie vs storage), sign out locally.
   */
  applyRefreshedTokens(accessToken: string, expiresAt: Date, refreshToken?: string): void {
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

    this.storageService.set('auth_token', accessToken);
    this.storageService.set('token_expires_at', expiresAt);
    if (refreshToken) {
      this.storageService.set('refresh_token', refreshToken);
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
    this.storageService.remove('refresh_token');
    this.storageService.remove('current_user');
    this.storageService.remove('token_expires_at');
    this.storageService.remove('user_profile_data');
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

  clearSession(): void {
    this.clearAuthData();
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
      refreshToken: null,
      expiresAt: this.storageService.get<Date>('token_expires_at')
    };
  }

  private checkAuthStatus(): void {
    try {
      const state = this.getInitialState();

      if (state.isAuthenticated && state.user) {
        this.currentUserSubject.next(state.user);
        this.isAuthenticatedSubject.next(true);
        this.authStateSubject.next(state);

        if (!this.isTokenExpired()) {
          this.sessionHeartbeat.start();
          this.configService.log('User session restored', { userId: state.user.id });
        } else {
          this.configService.log('Token expired - session kept; refresh will run on next API call');
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
      refreshToken: null,
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
      this.storageService.remove('refresh_token');
      this.storageService.removeSensitiveSessionBackedKeys();

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
      setTimeout(() => {
        this.isClearingAuthData = false;
      }, 0);
    }
  }
}
