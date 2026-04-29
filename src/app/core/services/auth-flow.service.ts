import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { ConfigService } from './config.service';
import { AuthSessionService } from './auth-session.service';
import { SessionHeartbeatService } from './session-heartbeat.service';
import { TokenRefreshService } from './token-refresh.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { LoginRequest, LoginResponse, AuthenticatedUser, ClaimDto, CaptchaResponse } from '@models/auth.model';
import { ChangePasswordRequest } from '@models/change-password.model';
import { USER_PROFILE_PROVIDER } from '../tokens/user-profile-provider.token';
import { IUserProfileProvider } from '../interfaces/user-profile-provider.interface';
import { parseGenerateCaptchaApiPayload } from '@utils/captcha-response-parser.util';
import { ErrorHandler } from '@utils/error-handler.utils';
import { decodeJwtPayload } from '@utils/jwt.util';

@Injectable({
  providedIn: 'root'
})
export class AuthFlowService {
  constructor(
    private apiService: ApiService,
    private storageService: StorageService,
    private configService: ConfigService,
    @Optional() @Inject(USER_PROFILE_PROVIDER) private profileProvider: IUserProfileProvider | null,
    private tokenRefresh: TokenRefreshService,
    private sessionHeartbeat: SessionHeartbeatService,
    private session: AuthSessionService
  ) {}

  generateCaptcha(): Observable<CaptchaResponse> {
    const endpoint = API_ENDPOINTS.AUTH.GENERATE_CAPTCHA;
    this.configService.log('Generating captcha', { endpoint, fullUrl: `${this.configService.apiUrl}${endpoint}` });
    return this.apiService.getRaw<unknown>(endpoint).pipe(
      tap(raw => this.configService.log('Captcha response received', raw)),
      map(raw => {
        try {
          return parseGenerateCaptchaApiPayload(raw);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          if (err.message === 'Invalid captcha response format') {
            this.configService.logError('Unexpected captcha response format', raw);
          }
          throw err;
        }
      }),
      catchError(error => {
        this.configService.logError('Failed to generate captcha', error);
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to generate captcha. Please try again.');
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  getCaptchaImageUrl(captchaId: string): string {
    const baseUrl = `${this.configService.apiUrl}${API_ENDPOINTS.AUTH.CAPTCHA_IMAGE(captchaId)}`;
    const timestamp = new Date().getTime();
    return `${baseUrl}?t=${timestamp}`;
  }

  getAlternativeCaptchaImageUrl(captchaId: string): string {
    const baseUrl = `${this.configService.apiUrl}${API_ENDPOINTS.AUTH.CAPTCHA_IMAGE_ALT(captchaId)}`;
    const timestamp = new Date().getTime();
    return `${baseUrl}?t=${timestamp}`;
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    this.configService.log('Attempting login', { username: credentials.username });

    return this.apiService.postRaw<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Login failed');
        }
        return response.data;
      }),
      switchMap(loginResponse => {
        if (loginResponse.requiresRoleSelection && loginResponse.roleSelectionToken) {
          this.session.clearSessionForPendingRoleSelection();
          this.storageService.set('role_selection_token', loginResponse.roleSelectionToken);
          this.storageService.set('available_roles_json', JSON.stringify(loginResponse.availableRoles || []));
          return of(loginResponse);
        }
        if (!loginResponse.accessToken) {
          return throwError(() => new Error('Login failed: no access token'));
        }
        return this.handleLoginSuccess(loginResponse);
      }),
      catchError(error => {
        this.configService.logError('Login failed', error);
        this.session.clearSession();
        return throwError(() => error);
      })
    );
  }

  selectRole(roleId: string, options?: { switchWhileLoggedIn?: boolean }): Observable<LoginResponse> {
    const body: { roleId: string; roleSelectionToken?: string } = { roleId };
    if (!options?.switchWhileLoggedIn) {
      const t = this.storageService.get<string>('role_selection_token');
      if (!t) {
        return throwError(() => new Error('Role selection session expired. Please sign in again.'));
      }
      body.roleSelectionToken = t;
    }

    return this.apiService.postRaw<LoginResponse>(API_ENDPOINTS.AUTH.SELECT_ROLE, body).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Role selection failed');
        }
        return response.data;
      }),
      switchMap(loginResponse => this.handleLoginSuccess(loginResponse)),
      catchError(error => {
        this.configService.logError('Select role failed', error);
        return throwError(() => error);
      })
    );
  }

  private handleLoginSuccess(response: LoginResponse): Observable<LoginResponse> {
    this.configService.log('Login successful');

    this.storageService.remove('role_selection_token');
    this.storageService.remove('available_roles_json');

    const expiresAt = new Date(response.expiresAt);

    this.storageService.set('auth_token', response.accessToken);
    this.storageService.set('token_expires_at', expiresAt);
    if (response.refreshToken) {
      this.storageService.set('refresh_token', response.refreshToken);
    }

    return this.fetchCompleteUserData().pipe(
      switchMap(result => {
        if (!result) {
          this.configService.logError('Failed to fetch user data from /Users/me API', null);
          this.session.clearSession();
          return throwError(() => new Error('Failed to load user profile. Please try logging in again.'));
        }

        const { user: completeUser, raw: userMeData } = result;

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

        this.session.clearAndPrimeUserContextCache(userMeData);

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

            this.profileProvider?.saveProfile(mergedUser, userMeData);
            this.session.applyAuthenticatedSession(mergedUser, response.accessToken, expiresAt);
            return response;
          }),
          catchError(error => {
            this.configService.logError('Failed to fetch user claims, proceeding without permissions', error);
            this.profileProvider?.saveProfile(authenticatedUser, userMeData);
            this.session.applyAuthenticatedSession(authenticatedUser, response.accessToken, expiresAt);
            return of(response);
          })
        );
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch user data from /Users/me API', error);
        this.session.clearSession();
        return throwError(() => new Error('Failed to load user profile. Please try logging in again.'));
      }),
      tap(() => this.sessionHeartbeat.start())
    );
  }

  restoreSessionSilently(): Observable<boolean> {
    if (this.session.isAuthenticated()) {
      return of(true);
    }
    return this.tokenRefresh.getRefreshedLoginResponse().pipe(
      switchMap(loginResponse => this.handleLoginSuccess(loginResponse)),
      map(() => true),
      catchError(() => of(false))
    );
  }

  logout(): Observable<boolean> {
    this.configService.log('Logging out user');
    this.session.setLogoutInProgress(true);
    this.session.pauseSessionHeartbeat();

    return this.apiService.post<string>(API_ENDPOINTS.AUTH.LOGOUT, {}).pipe(
      map(() => {
        this.configService.log('Backend logout successful');
        this.session.clearSession();
        return true;
      }),
      catchError(error => {
        this.configService.logError('Backend logout failed, clearing local data anyway', error);
        this.session.clearSession();
        return of(true);
      }),
      finalize(() => this.session.setLogoutInProgress(false))
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<boolean> {
    this.configService.log('Attempting to change password');

    return this.apiService.put<boolean>(API_ENDPOINTS.USERS.CHANGE_PASSWORD, request).pipe(
      map(succeeded => {
        if (!succeeded) {
          throw new Error('Password change failed');
        }
        this.configService.log('Password changed successfully');
        return true;
      }),
      catchError(error => {
        this.configService.logError('Change password failed', error);
        return throwError(
          () =>
            new Error(error.userMessage || error.message || 'Failed to change password. Please try again.')
        );
      })
    );
  }

  forgotPassword(email: string): Observable<boolean> {
    this.configService.log('Requesting password reset', { email });

    return this.apiService.postRaw<string>(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email }).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to send password reset email');
        }
        this.configService.log('Password reset email sent successfully');
        return true;
      }),
      catchError(error => {
        this.configService.logError('Forgot password failed', error);
        return throwError(
          () =>
            new Error(error.userMessage || error.message || 'Failed to send password reset email. Please try again.')
        );
      })
    );
  }

  resetPassword(email: string, token: string, newPassword: string): Observable<boolean> {
    this.configService.log('Attempting to reset password', { email });

    return this.apiService.postRaw<string>(API_ENDPOINTS.AUTH.RESET_PASSWORD, { email, token, newPassword }).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Password reset failed');
        }
        this.configService.log('Password reset successfully');
        return true;
      }),
      catchError(error => {
        this.configService.logError('Reset password failed', error);
        return throwError(
          () => new Error(error.userMessage || error.message || 'Failed to reset password. Please try again.')
        );
      })
    );
  }

  getUserClaims(): Observable<AuthenticatedUser> {
    return this.apiService.get<ClaimDto[]>(API_ENDPOINTS.AUTH.USER_CLAIMS).pipe(
      map(claims => {
        if (!claims) {
          throw new Error('Failed to fetch user claims');
        }

        const token = this.storageService.get<string>('auth_token');
        const tokenPayload = decodeJwtPayload<Record<string, unknown>>(token) as any;

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

  private fetchCompleteUserData(): Observable<{ user: AuthenticatedUser; raw: unknown } | null> {
    return this.apiService.post<unknown>(API_ENDPOINTS.USERS.ME, {}).pipe(
      map(apiData => {
        if (!apiData) {
          return null;
        }

        const data = apiData as Record<string, unknown>;

        const departmentId = this.tryParseNumber(
          (data['department'] as { id?: unknown } | undefined)?.id ??
            data['departmentId'] ??
            data['DepartmentId']
        );

        const departmentObj = data['department'] as Record<string, unknown> | undefined;
        const deptLegacy = data['Department'] as Record<string, unknown> | undefined;

        const departmentNameEn =
          (departmentObj?.['nameEn'] as string | undefined) ??
          (departmentObj?.['NameEn'] as string | undefined) ??
          (deptLegacy?.['NameEn'] as string | undefined);

        const departmentNameAr =
          (departmentObj?.['nameAr'] as string | undefined) ??
          (departmentObj?.['NameAr'] as string | undefined) ??
          (deptLegacy?.['NameAr'] as string | undefined);

        const departmentName =
          departmentNameEn ??
          departmentNameAr ??
          (data['departmentName'] as string | undefined) ??
          (data['DepartmentName'] as string | undefined);

        const nameEn =
          (data['fullNameEN'] as string | undefined) ??
          (data['FullNameEN'] as string | undefined) ??
          (data['fullNameEn'] as string | undefined) ??
          (data['FullNameEn'] as string | undefined) ??
          (data['nameEn'] as string | undefined) ??
          (data['NameEn'] as string | undefined);

        const nameAr =
          (data['fullNameAR'] as string | undefined) ??
          (data['FullNameAR'] as string | undefined) ??
          (data['fullNameAr'] as string | undefined) ??
          (data['FullNameAr'] as string | undefined) ??
          (data['nameAr'] as string | undefined) ??
          (data['NameAr'] as string | undefined);

        const organizationId = this.tryParseNumber(data['organizationId'] ?? data['OrganizationId']);

        const user: AuthenticatedUser = {
          id: (data['id'] as string) ?? (data['Id'] as string) ?? '',
          userName: (data['userName'] as string) ?? (data['UserName'] as string) ?? '',
          email: (data['email'] as string) ?? (data['Email'] as string) ?? '',
          roles: [],
          permissions: [],
          departmentId: departmentId ?? undefined,
          departmentName: departmentName,
          departmentNameEn: departmentNameEn,
          departmentNameAr: departmentNameAr,
          organizationId: organizationId ?? undefined,
          nameEn: nameEn,
          nameAr: nameAr
        };
        return { user, raw: apiData };
      }),
      catchError(() => of(null))
    );
  }

  private extractRoles(claims: ClaimDto[]): string[] {
    return claims
      .filter(claim => claim.claimType && claim.claimType.toLowerCase().includes('role'))
      .map(claim => claim.id);
  }

  private tryParseNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

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

}
