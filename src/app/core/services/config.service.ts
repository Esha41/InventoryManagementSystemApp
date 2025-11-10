import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Configuration service for managing app settings
 */
@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  
  /**
   * Get API base URL
   */
  get apiUrl(): string {
    return environment.apiUrl;
  }

  /**
   * Get app name
   */
  get appName(): string {
    return environment.appName;
  }

  /**
   * Get app version
   */
  get version(): string {
    return environment.version;
  }

  /**
   * Get notification hub URL
   */
  get notificationHubUrl(): string {
    return (environment as any).notificationHubUrl ?? '';
  }

  /**
   * Check if logging is enabled
   */
  get isLoggingEnabled(): boolean {
    return environment.enableLogging;
  }

  /**
   * Check if production mode
   */
  get isProduction(): boolean {
    return environment.production;
  }

  /**
   * Check if mock data should be used
   */
  get useMockData(): boolean {
    return (environment as any).mockData || false;
  }

  /**
   * Check if debug mode is enabled
   */
  get isDebugMode(): boolean {
    return (environment as any).debugMode || false;
  }

  /**
   * Get full API URL for an endpoint
   */
  getApiUrl(endpoint: string): string {
    return `${this.apiUrl}${endpoint}`;
  }

  /**
   * Log message if logging is enabled
   */
  log(message: string, ...args: any[]): void {
    if (this.isLoggingEnabled) {
      console.log(`[${this.appName}] ${message}`, ...args);
    }
  }

  /**
   * Log error if logging is enabled
   */
  logError(message: string, error?: any): void {
    if (this.isLoggingEnabled) {
      console.error(`[${this.appName}] ${message}`, error);
    }
  }

  /**
   * Log warning if logging is enabled
   */
  logWarning(message: string, ...args: any[]): void {
    if (this.isLoggingEnabled) {
      console.warn(`[${this.appName}] ${message}`, ...args);
    }
  }
}
