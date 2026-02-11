import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ConfigService } from '@services/config.service';

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
      let errorDetails: string[] = [];

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Client Error: ${error.error.message}`;
        configService.logError('Client-side error:', error.error);
      } else {
        // Server-side error
        if (error.error) {
          // Backend returned an error response
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          } else if (error.error.errors) {
            // Handle validation errors array
            errorDetails = Array.isArray(error.error.errors) 
              ? error.error.errors 
              : Object.values(error.error.errors).flat() as string[];
            errorMessage = errorDetails.join(', ') || errorMessage;
          }
        } else {
          // HTTP error without error body
          errorMessage = `Server Error: ${error.status} - ${error.statusText}`;
        }

        configService.logError(`Server-side error (${error.status}):`, {
          message: errorMessage,
          details: errorDetails,
          url: error.url
        });
      }

      // Create enhanced error object
      const enhancedError = {
        ...error,
        userMessage: errorMessage,
        details: errorDetails,
        timestamp: new Date()
      };

      return throwError(() => enhancedError);
    })
  );
};

