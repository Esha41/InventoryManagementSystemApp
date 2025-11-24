import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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


