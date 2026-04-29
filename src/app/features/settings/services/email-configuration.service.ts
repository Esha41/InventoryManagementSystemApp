import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ConfigService } from '@services/config.service';
import { ApiService } from '@services/api.service';

// API Request/Response DTO matching the backend structure
export interface EmailSettingsApiDto {
  enableEmailNotifications: boolean;
  host: string;
  port: number;
  enableSSL: boolean;
  senderName: string;
  accountUsername: string;
  accountPassword?: string;
}

// Backend EmailConfiguration model structure
export interface EmailConfigurationApiDto {
  port: number;
  ssl: boolean;
  disableAuthentication: boolean;
  hostIp: string;
  username: string;
  password: string;
  displayName: string;
}

// Internal DTO for component usage
export interface EmailConfigurationDto {
  id?: number;
  hostIp?: string | null;
  port?: number | null;
  senderEmail?: string | null;
  senderDisplayName?: string | null;
  username?: string | null;
  password?: string | null;
  enableSsl?: boolean | null;
  enableEmailNotifications?: boolean | null;
  hasPassword?: boolean | null;
  [key: string]: unknown;
}

function httpStatus(error: unknown): number | undefined {
  if (error instanceof HttpErrorResponse) {
    return error.status;
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const s = (error as { status?: unknown }).status;
    return typeof s === 'number' && Number.isFinite(s) ? s : undefined;
  }
  return undefined;
}

@Injectable({
  providedIn: 'root'
})
export class EmailConfigurationService {
  constructor(
    private readonly apiService: ApiService,
    private readonly config: ConfigService
  ) { }

  private get endpoint(): string {
    return API_ENDPOINTS.EMAIL_CONFIGURATION.BASE;
  }

  getEmailConfiguration(): Observable<EmailConfigurationDto> {
    this.config.log('Fetching email configuration');

    return this.apiService
      .get<EmailConfigurationApiDto>(this.endpoint)
      .pipe(
        map(data => data ? this.backendApiDtoToInternalDto(data) : {}),
        catchError(error => {
          // If 404, return empty config (settings don't exist yet)
          // Check both HttpErrorResponse status and error message
          const is404 = httpStatus(error) === 404 ||
            error?.message?.includes('404') ||
            error?.message?.includes('Resource not found') ||
            error?.message?.includes('Not Found');

          // If 403, also return empty config (user might not have permission to view, but can still configure)
          const is403 = httpStatus(error) === 403 ||
            error?.message?.includes('403') ||
            error?.message?.includes('Forbidden');

          if (is404) {
            this.config.log('Email configuration not found, returning empty config');
            return of({} as EmailConfigurationDto);
          }

          if (is403) {
            this.config.log('Email configuration access forbidden, returning empty config (user may still be able to save)');
            return of({} as EmailConfigurationDto);
          }

          this.config.logError('Failed to fetch email configuration', error);
          return throwError(() => error);
        })
      );
  }

  updateEmailConfiguration(config: EmailConfigurationDto): Observable<EmailConfigurationDto> {
    this.config.log('Updating email configuration');

    // Convert internal DTO to API DTO
    const apiDto = this.internalDtoToApiDto(config);

    return this.apiService
      .post<EmailSettingsApiDto>(this.endpoint, apiDto)
      .pipe(
        map(data => this.apiDtoToInternalDto(data)),
        catchError(error => {
          // Provide more specific error messages
          let errorMessage = 'Failed to update email configuration';

          // Check for status code in HttpErrorResponse
          const status = httpStatus(error);
          const errorMsg = error instanceof Error ? error.message : String(error);

          if (status === 403 || errorMsg?.includes('403') || errorMsg?.includes('Forbidden')) {
            errorMessage = 'You do not have permission to update email settings. Please contact your administrator.';
          } else if (status === 404 || errorMsg?.includes('404') || errorMsg?.includes('Not Found')) {
            errorMessage = 'Email settings endpoint not found. Please verify the API endpoint is configured correctly.';
          } else if (error instanceof Error && error.message && error.message !== 'An unknown error occurred') {
            errorMessage = error.message;
          } else if (errorMsg && errorMsg !== 'An unknown error occurred') {
            errorMessage = errorMsg;
          }

          this.config.logError('Failed to update email configuration', error);
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Convert Backend EmailConfiguration API DTO to internal DTO for component usage
   */
  private backendApiDtoToInternalDto(apiDto?: EmailConfigurationApiDto | null): EmailConfigurationDto {
    if (!apiDto) {
      return {};
    }

    return {
      hostIp: apiDto.hostIp || null,
      port: apiDto.port ?? null,
      enableSsl: apiDto.ssl ?? false,
      senderDisplayName: apiDto.displayName || null,
      username: apiDto.username || null,
      enableEmailNotifications: !apiDto.disableAuthentication,
      // Password is typically not returned in GET responses, so we check if it exists
      hasPassword: apiDto.password !== undefined && apiDto.password !== null && apiDto.password !== '' && apiDto.password.length > 0
    };
  }

  /**
   * Convert API DTO to internal DTO for component usage (for POST requests)
   */
  private apiDtoToInternalDto(apiDto?: EmailSettingsApiDto | null): EmailConfigurationDto {
    if (!apiDto) {
      return {};
    }

    return {
      enableEmailNotifications: apiDto.enableEmailNotifications ?? false,
      hostIp: apiDto.host || null,
      port: apiDto.port ?? null,
      enableSsl: apiDto.enableSSL ?? false,
      senderDisplayName: apiDto.senderName || null,
      username: apiDto.accountUsername || null,
      // Password is typically not returned in GET responses, so we check if it exists
      hasPassword: apiDto.accountPassword !== undefined && apiDto.accountPassword !== null && apiDto.accountPassword !== ''
    };
  }

  /**
   * Convert internal DTO to API DTO for API requests
   */
  private internalDtoToApiDto(internalDto: EmailConfigurationDto): EmailSettingsApiDto {
    const apiDto: EmailSettingsApiDto = {
      enableEmailNotifications: internalDto.enableEmailNotifications ?? false,
      host: internalDto.hostIp || '',
      port: internalDto.port ?? 0,
      enableSSL: internalDto.enableSsl ?? false,
      senderName: internalDto.senderDisplayName || '',
      accountUsername: internalDto.username || ''
    };

    // Only include password if it's provided
    if (internalDto.password) {
      apiDto.accountPassword = internalDto.password;
    }

    return apiDto;
  }

}


