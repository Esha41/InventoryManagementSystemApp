import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './config.service';
import {
  EmailConfigurationDto,
  CreateUpdateEmailConfigurationDto
} from '@models/email-configuration.model';

/**
 * Service for managing email configuration
 */
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { ConfigService } from './config.service';

export interface EmailConfigurationDto {
  id?: number;
  hostIp?: string | null;
  port?: number | null;
  senderEmail?: string | null;
  senderDisplayName?: string | null;
  username?: string | null;
  enableSsl?: boolean | null;
  enableEmailNotifications?: boolean | null;
  hasPassword?: boolean | null;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class EmailConfigurationService {
  private get baseUrl(): string {
    return `${this.config.apiUrl}/EmailConfiguration`;
  }

  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) {}

  /**
   * Get email configuration
   */
  getEmailConfiguration(): Observable<EmailConfigurationDto> {
    this.config.log('Fetching email configuration');
    return this.http.get<any>(this.baseUrl).pipe(
      map(response => this.normalizeResponse(response)),
      catchError(error => {
        this.config.logError('Failed to fetch email configuration', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create or update email configuration
   */
  saveEmailConfiguration(
    config: CreateUpdateEmailConfigurationDto
  ): Observable<EmailConfigurationDto> {
    this.config.log('Saving email configuration', { ...config, password: '***' }); // Don't log password
    const payload = this.mapToApi(config);

    return this.http.post<any>(this.baseUrl, payload).pipe(
      map(response => this.normalizeResponse(response)),
      catchError(error => {
        this.config.logError('Failed to save email configuration', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Normalize backend response casing (handles camelCase & PascalCase)
   */
  private normalizeResponse(response: any): EmailConfigurationDto {
    if (!response) {
      throw new Error('Email configuration not found');
    }

    const data = response.data ?? response; // handle wrapped responses

    const enableEmailNotifications =
      data.enableEmailNotifications ??
      data.EnableEmailNotifications ??
      data.notificationsEnabled ??
      data.NotificationsEnabled ??
      true;

    const enableEmailLoginOtp =
      data.enableEmailLoginOtp ??
      data.EnableEmailLoginOtp ??
      data.enableEmailOtp ??
      data.EnableEmailOtp ??
      false;

    return {
      id: data.id ?? data.Id ?? 0,
      port: data.port ?? data.Port ?? null,
      ssl: data.ssl ?? data.Ssl ?? data.SSL ?? false,
      disableAuthentication:
        data.disableAuthentication ?? data.DisableAuthentication ?? false,
      hostIp: data.hostIp ?? data.HostIp ?? data.host ?? data.Host ?? '',
      username: data.username ?? data.Username ?? '',
      displayName: data.displayName ?? data.DisplayName ?? '',
      enableEmailNotifications,
      enableEmailLoginOtp,
      assetReturnEmailContent:
        data.assetReturnEmailContent ??
        data.AssetReturnEmailContent ??
        data.assetReturnTemplate ??
        data.AssetReturnTemplate ??
        '',
      bulkAssetNotificationEmailContent:
        data.bulkAssetNotificationEmailContent ??
        data.BulkAssetNotificationEmailContent ??
        data.bulkAssetAssignmentTemplate ??
        data.BulkAssetAssignmentTemplate ??
        '',
      organizationName: data.organizationName ?? data.OrganizationName ?? '',
      organizationNameArabic:
        data.organizationNameArabic ?? data.OrganizationNameArabic ?? '',
      organizationLogoFilename:
        data.organizationLogoFilename ?? data.OrganizationLogoFilename ?? '',
      organizationReportLogoFilename:
        data.organizationReportLogoFilename ??
        data.OrganizationReportLogoFilename ??
        '',
      hasPassword: data.hasPassword ?? data.HasPassword ?? false
    };
  }

  /**
   * Map frontend DTO to backend casing (PascalCase)
   */
  private mapToApi(config: CreateUpdateEmailConfigurationDto) {
    const payload: Record<string, any> = {
      SSL: config.ssl,
      DisableAuthentication: config.disableAuthentication,
      HostIp: config.hostIp,
      Username: config.username,
      DisplayName: config.displayName,
      EnableEmailNotifications: config.enableEmailNotifications,
      EnableEmailLoginOtp: config.enableEmailLoginOtp,
      AssetReturnEmailContent: config.assetReturnEmailContent,
      BulkAssetNotificationEmailContent: config.bulkAssetNotificationEmailContent,
      OrganizationName: config.organizationName,
      OrganizationNameArabic: config.organizationNameArabic,
      OrganizationLogoFilename: config.organizationLogoFilename,
      OrganizationReportLogoFilename: config.organizationReportLogoFilename
    };

    if (typeof config.port === 'number') {
      payload['Port'] = config.port;
    }

    if (config.password) {
      payload['Password'] = config.password;
    }

    return payload;
  }
}

  constructor(
    private readonly http: HttpClient,
    private readonly config: ConfigService
  ) {}

  private get baseUrl(): string {
    return `${this.config.apiUrl}${API_ENDPOINTS.EMAIL_CONFIGURATION.BASE}`;
  }

  getEmailConfiguration(): Observable<EmailConfigurationDto> {
    this.config.log('Fetching email configuration');

    return this.http
      .get<APIOperationResponse<EmailConfigurationDto>>(this.baseUrl)
      .pipe(
        map(response => this.normalizeConfig(response?.data)),
        catchError(error => {
          this.config.logError('Failed to fetch email configuration', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Normalize configuration payload coming from backend so downstream consumers can rely on consistent flags.
   */
  private normalizeConfig(config?: EmailConfigurationDto | null): EmailConfigurationDto {
    if (!config) {
      return {};
    }

    const normalized: EmailConfigurationDto = { ...config };
    const resolvedFlag = this.resolveBooleanFlag(normalized, [
      'enableEmailNotifications',
      'enableEmailNotification',
      'emailNotificationsEnabled',
      'emailNotificationEnabled',
      'enableNotifications',
      'notificationsEnabled'
    ]);

    if (resolvedFlag !== null) {
      normalized.enableEmailNotifications = resolvedFlag;
    }

    return normalized;
  }

  private resolveBooleanFlag(source: Record<string, unknown>, keys: string[]): boolean | null {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        continue;
      }

      const coerced = this.coerceBoolean(source[key]);
      if (coerced !== null) {
        return coerced;
      }
    }

    return null;
  }

  private coerceBoolean(value: unknown): boolean | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n'].includes(normalized)) {
        return false;
      }
    }

    return null;
  }
}


