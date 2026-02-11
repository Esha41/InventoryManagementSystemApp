import { Injectable } from '@angular/core';

/**
 * Service for managing local storage operations
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {

  /**
   * Get item from localStorage
   */
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set item in localStorage
   */
  set(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Silently fail for storage quota exceeded
    }
  }

  /**
   * Remove item from localStorage
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Clear all localStorage
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Check if key exists in localStorage
   */
  has(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }
}

