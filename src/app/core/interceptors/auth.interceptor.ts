import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, switchMap } from 'rxjs';
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

  let authReq = req.clone({
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
          storageService.set('sessionExpired', true);
          backendAuth.clearSession();
          router.navigate(['/auth/login']);
          return throwError(() => error);
        }

        if (isLogin) {
          return throwError(() => error);
        }

        return backendAuth.refreshToken().pipe(
          switchMap(loginResponse => {
            const retryReq = req.clone({
              withCredentials: true,
              setHeaders: { Authorization: `Bearer ${loginResponse.accessToken}` }
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            configService.logWarning('Token refresh failed - redirecting to login');
            storageService.set('sessionExpired', true);
            backendAuth.clearSession();
            router.navigate(['/auth/login']);
            return throwError(() => refreshError);
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

