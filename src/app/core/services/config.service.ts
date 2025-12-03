import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

interface RuntimeConfig {
  apiUrl?: string;
  notificationHubUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private runtimeConfig: RuntimeConfig | null = null;
  private configLoaded = false;

  constructor(private http: HttpClient) {}

  /**
   * Loads runtime-config.json BEFORE Angular bootstrap
   */
  load(): Promise<void> {
    return new Promise(async (resolve) => {
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
      resolve();
    });
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

  get isLoggingEnabled(): boolean {
    return environment.enableLogging;
  }

  get isDebugMode(): boolean {
    return (environment as any).debugMode || false;
  }

  get useMockData(): boolean {
    return (environment as any).mockData || false;
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
      (environment as any).notificationHubUrl ??
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

  log(message: string, ...args: any[]): void {
    if (this.isLoggingEnabled) {
      console.log(`[${this.appName}] ${message}`, ...args);
    }
  }

  logError(message: string, error?: any): void {
    if (this.isLoggingEnabled) {
      console.error(`[${this.appName}] ${message}`, error);
    }
  }

  logWarning(message: string, ...args: any[]): void {
    if (this.isLoggingEnabled) {
      console.warn(`[${this.appName}] ${message}`, ...args);
    }
  }
}
