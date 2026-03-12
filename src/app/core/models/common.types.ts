/**
 * Shared types used across the application.
 * Aligned with Angular best practices: prefer unknown over any, use explicit interfaces.
 */

/** Type for ngx-translate get() / instant() result - key-value map of translation keys to translated strings */
export type TranslationMap = Record<string, string>;

/** Error-like object with common HTTP error properties (for type-safe error handling) */
export interface HttpErrorLike {
  status?: number;
  message?: string;
  error?: unknown;
}

/** Type guard to check if error has HTTP status */
export function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('status' in error || 'message' in error)
  );
}

/** Generic entity with id - base for many DTOs */
export interface EntityWithId {
  id: number | string;
  [key: string]: unknown;
}

/** Localizable entity - has nameEn/nameAr for display */
export interface LocalizableEntity {
  nameEn?: string;
  nameAr?: string;
  [key: string]: unknown;
}
