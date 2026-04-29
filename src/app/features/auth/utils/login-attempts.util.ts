/**
 * Login Attempts Counter
 *
 * Thin wrapper around `StorageService` for the failed-login-attempts
 * counter. Centralizes the storage key + the "force captcha at 3 fails"
 * threshold so the component doesn't sprinkle these constants around.
 */

import type { StorageService } from '@services/storage.service';

const STORAGE_KEY = 'loginFailedAttempts';

/** Number of failures after which the captcha is force-shown. */
export const CAPTCHA_THRESHOLD = 3;

export function readFailedAttempts(storage: StorageService): number {
  return storage.get<number>(STORAGE_KEY) ?? 0;
}

export function incrementFailedAttempts(storage: StorageService, current: number): number {
  const next = current + 1;
  storage.set(STORAGE_KEY, next);
  return next;
}

export function resetFailedAttempts(storage: StorageService): void {
  storage.remove(STORAGE_KEY);
}

export function shouldShowCaptcha(failedAttempts: number): boolean {
  return failedAttempts >= CAPTCHA_THRESHOLD;
}
