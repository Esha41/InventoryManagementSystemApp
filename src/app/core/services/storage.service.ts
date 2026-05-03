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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
      // Silently fail
    }
  }

  /**
   * Remove all sensitive session-backed keys (auth, profile, role-selection flags, etc.).
   * Prefer this on logout instead of wiping `localStorage` / `sessionStorage` entirely:
   * a full clear emits cross-tab `storage` events with `key === null`, which can interrupt
   * peer-tab restore flows.
   */
  removeSensitiveSessionBackedKeys(): void {
    for (const key of SESSION_STORAGE_KEYS) {
      this.remove(key);
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
