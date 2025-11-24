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
        map(response => response?.data ?? {}),
        catchError(error => {
          this.config.logError('Failed to fetch email configuration', error);
          return throwError(() => error);
        })
      );
  }
}


