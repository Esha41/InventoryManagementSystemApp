import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
/**
 * Keys that store sensitive auth/profile data.
 * These use sessionStorage (cleared when tab closes) to reduce XSS exposure window.
 */
const SESSION_STORAGE_KEYS = new Set([
  'auth_token',
  'token_expires_at',
  'current_user',
  'user_profile_data',
  'sessionExpired',
  'loginFailedAttempts',
  'bulkAssetData',
  'role_selection_token',
  'available_roles_json'
]);

/**
 * Prefixes whose keys survive {@link StorageService.clear} (e.g. logout).
 * Onboarding/page-tour flags are non-sensitive and should persist across logout on this device
 * so users are not forced through tours again after signing back in.
 */
const PRESERVE_ON_CLEAR_PREFIXES = ['page_tour_completed_', 'onboarding_completed_'];

function snapshotPrefixedKeys(storage: Storage): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (PRESERVE_ON_CLEAR_PREFIXES.some(prefix => key.startsWith(prefix))) {
      const value = storage.getItem(key);
      if (value !== null) {
        out.push([key, value]);
      }
    }
  }
  return out;
}

function restorePrefixedSnapshot(storage: Storage, entries: Array<[string, string]>): void {
  for (const [key, value] of entries) {
    storage.setItem(key, value);
  }
}

/**
 * Service for managing storage operations.
 * Uses sessionStorage for sensitive auth/profile data (Angular security best practice).
 * Uses localStorage for non-sensitive preferences (theme, language).
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor(private config: ConfigService) { }

  private getStorage(key: string): Storage {
    // In some deployments we want users to stay logged in even after closing the tab/browser.
    // When enabled, persist auth/profile keys in localStorage instead of sessionStorage.
    if (SESSION_STORAGE_KEYS.has(key) && this.config.persistAuthAcrossSessions) {
      return localStorage;
    }
    return SESSION_STORAGE_KEYS.has(key) ? sessionStorage : localStorage;
  }
  /**
   * Get item from storage
   */
  get<T>(key: string): T | null {
    try {
      const storage = this.getStorage(key);
      const item = storage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set item in storage
   */
  set(key: string, value: unknown): void {
    try {
      const storage = this.getStorage(key);
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Silently fail for storage quota exceeded
    }
  }

  /**
   * Remove item from storage
   */
  remove(key: string): void {
    try {
      const storage = this.getStorage(key);
      storage.removeItem(key);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Clear all storage (localStorage and sessionStorage).
   * Used on logout to remove auth data and preferences.
   * Preserves onboarding / page-tour completion keys so tours do not repeat after re-login.
   */
  clear(): void {
    try {
      const preservedLocal = snapshotPrefixedKeys(localStorage);
      const preservedSession = snapshotPrefixedKeys(sessionStorage);
      localStorage.clear();
      sessionStorage.clear();
      restorePrefixedSnapshot(localStorage, preservedLocal);
      restorePrefixedSnapshot(sessionStorage, preservedSession);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Check if key exists in storage
   */
  has(key: string): boolean {
    const storage = this.getStorage(key);
    return storage.getItem(key) !== null;
  }
}

