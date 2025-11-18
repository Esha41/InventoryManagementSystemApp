import { HttpErrorResponse } from '@angular/common/http';

/**
 * Utility functions for handling errors consistently across the application
 */
export class ErrorHandler {
  /**
   * Extracts error message from various error formats
   */
  static extractErrorMessage(error: unknown, defaultMessage: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.error?.message) {
        return error.error.message;
      }
      if (typeof error.error === 'string') {
        return error.error;
      }
      if (error.error?.errors) {
        const errors = Array.isArray(error.error.errors)
          ? error.error.errors
          : Object.values(error.error.errors).flat() as string[];
        return errors.join(', ') || defaultMessage;
      }
      return error.message || defaultMessage;
    }
    
    if (error instanceof Error) {
      return error.message || defaultMessage;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    return defaultMessage;
  }

  /**
   * Handles duplicate/unique constraint errors
   */
  static handleDuplicateError(message: string, fieldName: string): string {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('duplicate') || 
        lowerMessage.includes(fieldName.toLowerCase()) || 
        lowerMessage.includes('unique') ||
        lowerMessage.includes('already exists')) {
      return `${fieldName} already exists. Please use a unique ${fieldName}.`;
    }
    return message;
  }

  /**
   * Formats validation errors from backend
   */
  static formatValidationErrors(error: HttpErrorResponse): Record<string, string> {
    const errors: Record<string, string> = {};
    
    if (error.error?.errors) {
      if (Array.isArray(error.error.errors)) {
        error.error.errors.forEach((err: string) => {
          // Try to extract field name from error message
          const match = err.match(/(\w+)\s+(.+)/);
          if (match) {
            errors[match[1]] = match[2];
          } else {
            errors['general'] = err;
          }
        });
      } else if (typeof error.error.errors === 'object') {
        Object.keys(error.error.errors).forEach(key => {
          const value = error.error.errors[key];
          errors[key] = Array.isArray(value) ? value.join(', ') : String(value);
        });
      }
    }
    
    return errors;
  }
}

