import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { StorageService } from '@services/storage.service';
import { ConfigService } from '@services/config.service';
import { BackendAuthService } from '@services/backend-auth.service';

/**
 * HTTP Interceptor for handling authentication
 * - Adds JWT token to requests
 * - Handles 401 errors and redirects to login
 * - Logs API calls in debug mode
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storageService = inject(StorageService);
  const configService = inject(ConfigService);
  const router = inject(Router);
  const backendAuth = inject(BackendAuthService);

 
  const token = storageService.get<string>('auth_token');


  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Log request in debug mode
  if (configService.isDebugMode) {
    configService.log(`HTTP ${req.method} ${req.url}`, {
      headers: authReq.headers.keys(),
      body: req.body
    });
  }

  // Handle the request and catch errors
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      configService.logError(`HTTP Error: ${error.status} ${error.statusText}`, error);

      // Handle 401 Unauthorized - redirect to login
      if (error.status === 401) {
        configService.logWarning('Unauthorized access - redirecting to login');
        
        const token = storageService.get<string>('auth_token');
        const isSessionConflict = token && !backendAuth.isTokenExpired();
        
        storageService.remove('auth_token');
        storageService.remove('current_user');
        
        if (isSessionConflict) {
          router.navigate(['/auth/login'], { queryParams: { sessionConflict: 'true' } });
        } else {
          router.navigate(['/auth/login']);
        }
      }

      // Handle 403 Forbidden
      if (error.status === 403) {
        configService.logWarning('Forbidden access - insufficient permissions');
      }

      return throwError(() => error);
    })
  );
};

