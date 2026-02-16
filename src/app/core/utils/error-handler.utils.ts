import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

/**
 * Known backend error message patterns that need translation
 */
const TRANSLATABLE_ERROR_PATTERNS: { pattern: RegExp; translationKey: string; extractParams?: (match: RegExpMatchArray) => Record<string, string> }[] = [
  {
    pattern: /Exceeded allowance quantity\.?\s*Available:\s*(\d+)/i,
    translationKey: 'supplyRequestDetail.errors.allowanceExceeded',
    extractParams: (match) => ({ availableQuantity: match[1] })
  },
  {
    pattern: /Requested quantity \((\d+)\) exceeds available allowance\.?\s*Available:\s*(\d+)/i,
    translationKey: 'newIssueRequest.errors.allowanceExceeded',
    extractParams: (match) => ({ requestedQuantity: match[1], availableQuantity: match[2] })
  },
  {
    pattern: /(?:IX_BaseItems_ItemNo|BaseItems|ItemNo)[\s\S]*?duplicate key value is \(([^)]+)\)|duplicate key value is \(([^)]+)\)[\s\S]*?(?:IX_BaseItems_ItemNo|BaseItems|ItemNo)/i,
    translationKey: 'addAsset.errors.itemNoAlreadyExistsWithValue',
    extractParams: (match) => ({ itemNo: (match[1] || match[2] || '').trim() })
  },
  {
    pattern: /IX_BaseItems_ItemNo|(?:Cannot insert )?duplicate key.*?(?:BaseItems|ItemNo)/i,
    translationKey: 'addAsset.errors.itemNoAlreadyExists',
    extractParams: () => ({})
  }
];

/**
 * Utility functions for handling errors consistently across the application
 */
export class ErrorHandler {
  /**
   * Extracts error message from various error formats
   * Follows best practices: unknown types, type guards, and defensive null checks
   */
  static extractErrorMessage(error: unknown, defaultMessage: string): string {
    if (!error) return defaultMessage;

    // Helper to extract from a potential body object
    const extractFromBody = (body: any): string | null => {
      if (!body) return null;
      // Case: { message: { message: "..." } } - Nested project-specific structure
      if (typeof body.message === 'object' && body.message !== null && body.message.message) {
        return String(body.message.message);
      }
      // Case: { message: "..." } - Standard message property
      if (typeof body.message === 'string') return body.message;
      // Case: { errors: ["..."] } - Validation errors
      if (body.errors) {
        const errs = Array.isArray(body.errors) ? body.errors : Object.values(body.errors).flat();
        if (errs.length > 0) return String(errs[0]);
      }
      return typeof body === 'string' ? body : null;
    };

    // 1. Handle HttpErrorResponse (Standard instance)
    if (error instanceof HttpErrorResponse) {
      return extractFromBody(error.error) || error.message || defaultMessage;
    }

    // 2. Handle JS Error objects
    if (error instanceof Error) {
      return error.message;
    }

    // 3. Handle Generic Objects (APIOperationResponse or plain objects)
    if (typeof error === 'object' && error !== null) {
      const errObj = error as any;

      // If it looks like an HttpErrorResponse shape (has .error property), check that first
      if (errObj.error) {
        const nestedMsg = extractFromBody(errObj.error);
        if (nestedMsg) return nestedMsg;
      }

      // Check top-level message properties
      const topLevelMsg = extractFromBody(errObj);
      if (topLevelMsg) {
        // Only return if it's not the generic Angular fallback message
        if (!topLevelMsg.includes('Http failure response')) return topLevelMsg;
      }

      // Fallback for objects with a generic message string
      if (errObj.message && typeof errObj.message === 'string') return errObj.message;
    }

    // 4. Handle direct strings
    if (typeof error === 'string') return error;

    return defaultMessage;
  }

  /**
   * Translates known backend error messages to the current language
   * @param message - The error message from the backend
   * @param translate - Optional TranslateService instance for translation
   * @returns Translated message if pattern matches, original message otherwise
   */
  static translateErrorMessage(message: string, translate?: TranslateService): string {
    if (!message || !translate) return message;

    for (const { pattern, translationKey, extractParams } of TRANSLATABLE_ERROR_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        const params = extractParams ? extractParams(match) : {};
        return translate.instant(translationKey, params);
      }
    }

    return message;
  }

  /**
   * Extracts and optionally translates error message from various error formats
   * @param error - The error object
   * @param defaultMessage - Default message if extraction fails
   * @param translate - Optional TranslateService instance for translation
   */
  static extractAndTranslateErrorMessage(error: unknown, defaultMessage: string, translate?: TranslateService): string {
    const message = this.extractErrorMessage(error, defaultMessage);
    return this.translateErrorMessage(message, translate);
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

