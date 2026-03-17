import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

interface RuntimeConfig {
  apiUrl?: string;
  notificationHubUrl?: string;
  fileBaseUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private runtimeConfig: RuntimeConfig | null = null;
  private configLoaded = false;

  constructor(private http: HttpClient) { }

  /**
   * Loads runtime-config.json BEFORE Angular bootstrap
   */
  async load(): Promise<void> {
    try {
      this.runtimeConfig = await firstValueFrom(
        this.http.get<RuntimeConfig>('/assets/config/runtime-config.json')
      );
      this.log('Runtime config loaded successfully');
    } catch (error) {
      this.logError('Failed to load runtime-config.json (using environment fallbacks)', error);
      this.runtimeConfig = null;
    }
    this.configLoaded = true;
  }

  // =================================================
  // BASIC APP INFO
  // =================================================

  get appName(): string {
    return environment.appName;
  }

  get version(): string {
    return environment.version;
  }

  get isProduction(): boolean {
    return environment.production;
  }

  get enableLogging(): boolean {
    return environment.enableLogging;
  }

  get isLoggingEnabled(): boolean {
    return environment.enableLogging;
  }

  get isDebugMode(): boolean {
    return environment.debugMode ?? false;
  }

  get useMockData(): boolean {
    return environment.mockData ?? false;
  }

  // =================================================
  // BACKEND API
  // =================================================

  get apiUrl(): string {
    return this.runtimeConfig?.apiUrl ?? environment.apiUrl;
  }

  get notificationHubUrl(): string {
    return (
      this.runtimeConfig?.notificationHubUrl ??
      environment.notificationHubUrl ??
      ''
    );
  }

  get fileBaseUrl(): string {
    return (
      this.runtimeConfig?.fileBaseUrl ??
      environment.fileBaseUrl ??
      ''
    );
  }

  /**
   * Utility to combine URL + endpoint
   */
  getApiUrl(endpoint: string): string {
    return `${this.apiUrl}${endpoint}`;
  }


  // =================================================
  // STATE
  // =================================================

  get isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  // =================================================
  // LOGGING HELPERS
  // =================================================

  log(message: string, ...args: unknown[]): void {
    if (this.isLoggingEnabled) {
      console.log(`[${this.appName}] ${message}`, ...args);
    }
  }

  logError(message: string, error?: unknown): void {
    if (this.isLoggingEnabled) {
      console.error(`[${this.appName}] ${message}`, error);
    }
  }

  logWarning(message: string, ...args: unknown[]): void {
    if (this.isLoggingEnabled) {
      console.warn(`[${this.appName}] ${message}`, ...args);
    }
  }
}
