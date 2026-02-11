import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { APIOperationResponse } from '@models/api-response.model';

/**
 * Error Handling Service
 * Centralized service for resolving error messages from various error formats
 */
@Injectable({
  providedIn: 'root'
})
export class ErrorHandlingService {
  /**
   * Resolves a user-friendly error message from various error formats
   */
  resolveHttpErrorMessage(error: unknown): string {
    // First check if error has userMessage (set by error interceptor)
    const errorAny = error as any;
    if (errorAny?.userMessage) {
      return errorAny.userMessage;
    }

    if (error instanceof HttpErrorResponse) {
      const errorObj = error.error;

      // Check for message in various possible locations (most common first)
      const message = errorObj?.message ||
                     errorObj?.Message ||
                     errorObj?.title ||
                     errorObj?.error?.message ||
                     errorObj?.error?.Message;

      if (message) {
        return message;
      }

      // Check for errors array
      if (errorObj?.errors) {
        if (Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
          // If it's an array of strings, return the first one
          if (typeof errorObj.errors[0] === 'string') {
            return errorObj.errors[0];
          }
          // If it's an array of objects, try to get message or description
          const firstError = errorObj.errors[0];
          return firstError?.message || firstError?.Message || firstError?.description || firstError?.error || String(firstError);
        }

        // If errors is an object (validation errors)
        if (typeof errorObj.errors === 'object' && !Array.isArray(errorObj.errors)) {
          const errorKeys = Object.keys(errorObj.errors);
          if (errorKeys.length > 0) {
            const firstErrorValue = errorObj.errors[errorKeys[0]];
            if (Array.isArray(firstErrorValue) && firstErrorValue.length > 0) {
              return firstErrorValue[0];
            }
            if (typeof firstErrorValue === 'string') {
              return firstErrorValue;
            }
          }
        }
      }

      // Fallback to HTTP status text
      if (error.message) {
        return error.message;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'An error occurred. Please try again.';
  }

  /**
   * Extracts the first error message from an API operation response
   */
  extractFirstError(response: APIOperationResponse<any> | undefined): string | null {
    if (!response) {
      return null;
    }
    const errors = (response as any)?.errors;
    if (!errors) {
      return null;
    }
    if (Array.isArray(errors) && errors.length > 0) {
      return errors[0].description || errors[0];
    }
    if (typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      const value = (errors as Record<string, any>)[firstKey];
      if (Array.isArray(value) && value.length > 0) {
        return value[0];
      }
      if (typeof value === 'string') {
        return value;
      }
    }
    return null;
  }

  /**
   * Resolves error message from API response or HTTP error
   */
  resolveOrderSubmissionError(response: APIOperationResponse<any> | undefined, error: unknown): string {
    // Try to get message from response first
    if (response) {
      const responseAny = response as any;
      const backendMessage = response?.message ||
                            responseAny?.Message ||
                            this.extractFirstError(response) ||
                            'Failed to submit order. Please try again.';
      return backendMessage;
    }

    // Fallback to HTTP error resolution
    return this.resolveHttpErrorMessage(error);
  }
}

