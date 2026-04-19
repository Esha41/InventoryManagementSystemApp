import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { APIOperationResponse } from '@models/api-response.model';

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
  },
  {
    pattern: /Assets without serial numbers cannot be supplied.*/i,
    translationKey: 'weaponSupplyReview.assetsWithoutSerialCannotBeSupplied',
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

    // Check for userMessage from error interceptor (enhanced error)
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      const userMsg = err['userMessage'];
      if (typeof userMsg === 'string' && userMsg.trim()) return userMsg;
    }

    // Helper to extract from a potential body object
    const extractFromBody = (body: unknown): string | null => {
      if (!body) return null;
      if (typeof body === 'string') return body;
      if (typeof body !== 'object') return null;
      const obj = body as Record<string, unknown>;
      // Case: { message: { message: "..." } } - Nested project-specific structure
      const msg = obj['message'];
      if (typeof msg === 'object' && msg !== null && 'message' in msg) {
        const nested = (msg as Record<string, unknown>)['message'];
        if (typeof nested === 'string') return nested;
      }
      // Case: { message: "..." } - Standard message property
      if (typeof msg === 'string') return msg;
      // Case: { Message: "..." } - Some API envelopes use PascalCase
      const msgPascal = obj['Message'];
      if (typeof msgPascal === 'string') return msgPascal;
      // Case: { errors: ["..."] } - Validation errors
      const errs = obj['errors'];
      if (errs) {
        const arr = Array.isArray(errs) ? errs : Object.values(errs as object).flat();
        if (arr.length > 0) return String(arr[0]);
      }
      return null;
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
      const errObj = error as Record<string, unknown>;

      // If it looks like an HttpErrorResponse shape (has .error property), check that first
      if (errObj['error']) {
        const nestedMsg = extractFromBody(errObj['error']);
        if (nestedMsg) return nestedMsg;
      }

      // Check top-level message properties
      const topLevelMsg = extractFromBody(errObj);
      if (topLevelMsg) {
        // Only return if it's not the generic Angular fallback message
        if (!topLevelMsg.includes('Http failure response')) return topLevelMsg;
      }

      // Fallback for objects with a generic message string
      const msg = errObj['message'];
      if (typeof msg === 'string') return msg;
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

    // API returns ngx-translate keys in Message (e.g. warehouseInventory.errors.*)
    if (message.startsWith('warehouseInventory.errors.')) {
      return translate.instant(message);
    }

    // Backend i18n keys (e.g. server.unauthorized) merged under root `server` in common.json
    if (message.startsWith('server.')) {
      const t = translate.instant(message);
      if (t && t !== message) return t;
    }

    // Raw Angular HTTP text when status is 401 (no usable JSON body)
    if (
      (message.includes('Server Error:') && /\b401\b/.test(message)) ||
      /Http failure response for .*\s401\s/.test(message)
    ) {
      const key = 'auth.selectRole.errors.httpUnauthorized';
      const t = translate.instant(key);
      if (t && t !== key) return t;
    }

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
   * Resolves error message from API response or HTTP error (for order submission flows)
   */
  static resolveOrderSubmissionError(
    response: APIOperationResponse<unknown> | undefined,
    error: unknown,
    defaultMessage = 'Failed to submit order. Please try again.'
  ): string {
    if (response && typeof response === 'object') {
      const resp = response as unknown as Record<string, unknown>;
      const msg = resp['message'];
      if (typeof msg === 'string') return msg;
      const msgAlt = resp['Message'];
      if (typeof msgAlt === 'string') return msgAlt;
      const errs = resp['errors'];
      if (errs && Array.isArray(errs) && errs.length > 0) {
        const first = errs[0];
        if (typeof first === 'object' && first !== null && 'description' in first) {
          return String((first as Record<string, unknown>)['description']);
        }
        return String(first);
      }
      if (typeof errs === 'object' && errs !== null && !Array.isArray(errs)) {
        const keys = Object.keys(errs as Record<string, unknown>);
        if (keys.length > 0) {
          const val = (errs as Record<string, unknown>)[keys[0]];
          if (Array.isArray(val) && val.length > 0) return String(val[0]);
          if (typeof val === 'string') return val;
        }
      }
    }
    return this.extractErrorMessage(error, defaultMessage);
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

