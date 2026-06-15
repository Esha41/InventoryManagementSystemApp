import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

interface RuntimeConfig {
  apiUrl?: string;
  notificationHubUrl?: string;
  fileBaseUrl?: string;
  persistAuthAcrossSessions?: boolean;
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

  /**
   * DevExpress paths on the public host (same origin as apiUrl with `/api` removed).
   * Must stay at site root — not under `/api` — so IIS rules like
   * `^DXXRD(.*)` → `.../api/DXXRD{R:1}` and `^DXXRDV(.*)` → `.../api/DXXRDV{R:1}` apply.
   * REST calls continue to use {@link apiUrl} (`/api/...`).
   */
  get reportingHost(): string {
    return this.apiUrl.replace('/api', '');
  }

  get reportingViewerInvokeAction(): string {
    return '/DXXRDV';
  }

  get reportingDesignerPath(): string {
    return '/DXXRD';
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
  get persistAuthAcrossSessions(): boolean {
    return this.runtimeConfig?.persistAuthAcrossSessions ?? environment.persistAuthAcrossSessions ?? false;
  }
}
