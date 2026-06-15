import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ConfigService } from '@services/config.service';

/** Extract message from APIOperationResponse-shaped JSON bodies (and common variants). */
function extractMessageFromErrorBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === 'string') {
    const t = body.trim();
    return t.length ? t : null;
  }
  if (typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const m = o['message'] ?? o['Message'];
  if (typeof m === 'string' && m.trim()) return m.trim();
  const errs = o['errors'] ?? o['Errors'];
  if (Array.isArray(errs) && errs.length > 0) {
    const first = errs[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'description' in (first as object)) {
      const d = (first as Record<string, unknown>)['description'];
      if (typeof d === 'string') return d;
    }
  }
  if (errs && typeof errs === 'object' && !Array.isArray(errs)) {
    const vals = Object.values(errs as Record<string, unknown>).flat();
    const v0 = vals[0];
    if (typeof v0 === 'string') return v0;
    if (Array.isArray(v0) && typeof v0[0] === 'string') return v0[0];
  }
  return null;
}

/**
 * HTTP Interceptor for handling errors
 * - Formats error messages
 * - Extracts backend error details
 * - Provides consistent error handling
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const configService = inject(ConfigService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unknown error occurred';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Client Error: ${error.error.message}`;
        configService.logError('Client-side error:', error.error);
      } else {
        // Server-side error
        errorMessage = error.error
          ? (extractMessageFromErrorBody(error.error) ?? `Server Error: ${error.status}`)
          : `Server Error: ${error.status}`;

        // Skip logging for expected 403/404 on EmailSettings (non-admin or config not set)
        const skipLog = (error.status === 403 || error.status === 404) &&
          error.url?.includes('/EmailSettings');
        if (!skipLog) {
          configService.logError(`Server-side error (${error.status}):`, {
            message: errorMessage,
            url: error.url
          });
        }
      }

      // Create enhanced error object
      const enhancedError = {
        ...error,
        userMessage: errorMessage,
        timestamp: new Date()
      };

      return throwError(() => enhancedError);
    })
  );
};

