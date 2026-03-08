import { Injectable } from '@angular/core';

/**
 * Keys that store sensitive auth/profile data.
 * These use sessionStorage (cleared when tab closes) to reduce XSS exposure window.
 */
const SESSION_STORAGE_KEYS = new Set([
  'auth_token',
  'token_expires_at',
  'current_user',
  'user_profile_data'
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

  private getStorage(key: string): Storage {
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
   */
  clear(): void {
    try {
      localStorage.clear();
      sessionStorage.clear();
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

