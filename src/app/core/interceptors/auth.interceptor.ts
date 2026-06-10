import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, timer } from 'rxjs';
import { StorageService } from '@services/storage.service';
import { ConfigService } from '@services/config.service';
import { BackendAuthService } from '@services/backend-auth.service';

const isRefreshRequest = (url: string): boolean =>
  url.includes('/account/refresh') || url.endsWith('account/refresh');

const isLoginRequest = (url: string): boolean =>
  url.includes('/account/login') ||
  url.endsWith('account/login') ||
  url.includes('/account/select-role') ||
  url.endsWith('account/select-role');

const isLogoutRequest = (url: string): boolean =>
  url.includes('/account/logout') || url.endsWith('account/logout');

const AUTH_RETRY_HEADER = 'X-Auth-Retry';

const isAuthRetryRequest = (req: { headers: { has: (name: string) => boolean } }): boolean =>
  req.headers.has(AUTH_RETRY_HEADER);

const isOnLoginRoute = (router: Router): boolean =>
  router.url.split('?')[0].startsWith('/auth/login');

/** POST select-role after credential login uses roleSelectionToken only; a stale Bearer causes JWT middleware to 401 before AllowAnonymous. */
const shouldSkipBearerForSelectRole = (
  req: { method: string; url: string },
  pendingRoleSelectionToken: string | null
): boolean =>
  req.method === 'POST' &&
  !!pendingRoleSelectionToken &&
  (req.url.includes('/account/select-role') || req.url.endsWith('account/select-role'));

/** Sensitive keys to redact from debug logs */
const SENSITIVE_KEYS = new Set([
  'password', 'newPassword', 'confirmPassword', 'currentPassword',
  'token', 'captchaCode', 'captchaId', 'ldapPassword', 'accountPassword',
  'accessToken', 'refreshToken', 'secret', 'apiKey'
]);

function sanitizeForLogging(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof FormData || obj instanceof Blob) return '[Binary/FormData]';
  if (Array.isArray(obj)) return obj.map(sanitizeForLogging);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    sanitized[key] = SENSITIVE_KEYS.has(lowerKey) ? '[REDACTED]' : sanitizeForLogging(value);
  }
  return sanitized;
}

/**
 * HTTP Interceptor for handling authentication
 * - Adds JWT token to requests (except refresh)
 * - Adds withCredentials for cookie support
 * - On 401: tries refresh, then retries or redirects to login
 * - Logs API calls in debug mode
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storageService = inject(StorageService);
  const configService = inject(ConfigService);
  const router = inject(Router);
  const backendAuth = inject(BackendAuthService);

  const token = storageService.get<string>('auth_token');
  const pendingRoleSelectionToken = storageService.get<string>('role_selection_token');
  const skipAuth = isRefreshRequest(req.url);
  const isLogin = isLoginRequest(req.url);
  const skipBearer =
    skipAuth || shouldSkipBearerForSelectRole(req, pendingRoleSelectionToken);

  const authReq = req.clone({
    withCredentials: true,
    ...(token && !skipBearer
      ? { setHeaders: { Authorization: `Bearer ${token}` } }
      : {})
  });

  if (configService.isDebugMode) {
    configService.log(`HTTP ${req.method} ${req.url}`, {
      headers: authReq.headers.keys(),
      body: req.body ? sanitizeForLogging(req.body) : undefined
    });
  }

  const redirectToLoginAfterAuthFailure = (hadActiveSession: boolean): void => {
    backendAuth.clearSession();
    if (hadActiveSession) {
      storageService.set('sessionExpired', true);
    }
    storageService.set('skipSilentRestore', true);
    if (!isOnLoginRoute(router)) {
      router.navigate(['/auth/login']);
    }
  };

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Skip logging expected 403/404 on EmailSettings (non-admin or config not set)
      const skipLog = (error.status === 403 || error.status === 404) &&
        error.url?.includes('/EmailSettings');
      if (!skipLog) {
        configService.logError(`HTTP Error: ${error.status} ${error.statusText}`, error);
      }

      if (error.status === 401) {
        if (skipAuth) {
          configService.logWarning('Refresh failed - redirecting to login');
          // Only flag sessionExpired when the user had an active session.
          // A fresh load with no session (restoreSessionSilently on login page) should
          // not show the "session expired" banner.
          const hadActiveSession = backendAuth.isAuthenticated();
          redirectToLoginAfterAuthFailure(hadActiveSession);
          return throwError(() => error);
        }

        if (isLogin || isLogoutRequest(req.url) || backendAuth.isLoggingOut) {
          return throwError(() => error);
        }

        if (isAuthRetryRequest(req)) {
          configService.logWarning('Authenticated request still unauthorized after refresh retry');
          redirectToLoginAfterAuthFailure(backendAuth.isAuthenticated());
          return throwError(() => error);
        }

        // Re-read token at response time: if session was already cleared (e.g. logout
        // completed while this request was in-flight), skip refresh and redirect cleanly.
        const currentToken = storageService.get<string>('auth_token');
        if (!currentToken) {
          if (!isOnLoginRoute(router)) {
            router.navigate(['/auth/login']);
          }
          return throwError(() => error);
        }

        // A 401 here may mean the access token expired — try to refresh, then retry the request.
        // Crucially, distinguish two failure modes so a *non-auth* 401 can never force a logout:
        //   • refresh itself fails           → the session really is dead → clear + go to login
        //   • refresh succeeds but the retried request still fails (e.g. an application-level
        //     401/403/409) → NOT a token problem → propagate the error and keep the session
        let refreshSucceeded = false;

        // Refresh with one grace-window retry: the first attempt can fail on a transient network
        // error or a lost Set-Cookie response, so wait 2 s and try once more before giving up.
        const refreshWithRetry$ = backendAuth.refreshToken().pipe(
          catchError(() => timer(2000).pipe(switchMap(() => backendAuth.refreshToken())))
        );

        return refreshWithRetry$.pipe(
          switchMap(loginResponse => {
            refreshSucceeded = true;
            const retryReq = req.clone({
              withCredentials: true,
              setHeaders: {
                Authorization: `Bearer ${loginResponse.accessToken}`,
                [AUTH_RETRY_HEADER]: '1'
              }
            });
            return next(retryReq);
          }),
          catchError(err => {
            if (refreshSucceeded) {
              // The token was refreshed fine; the request still failed for a non-auth reason.
              // Surface it to the caller instead of logging the user out.
              return throwError(() => err);
            }
            configService.logWarning('Token refresh failed — redirecting to login');
            redirectToLoginAfterAuthFailure(backendAuth.isAuthenticated());
            return throwError(() => err);
          })
        );
      }

      if (error.status === 403 && !error.url?.includes('/EmailSettings')) {
        configService.logWarning('Forbidden access - insufficient permissions');
      }

      return throwError(() => error);
    })
  );
};

