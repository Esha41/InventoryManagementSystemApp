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

