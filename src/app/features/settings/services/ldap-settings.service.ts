import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';
import { ErrorHandler } from '@utils/error-handler.utils';

// API DTO matching backend LdapSettings contract
export interface LdapSettingsApiDto {
  ldapServer: string;
  ldapDomain: string;
  ldapEmpAttr: string;
  ldapUsername: string;
  ldapPassword?: string;
  isActive?: boolean;
}

// Internal DTO used by components
export interface LdapSettingsDto {
  ldapServer?: string | null;
  ldapDomain?: string | null;
  ldapEmpAttr?: string | null;
  ldapUsername?: string | null;
  ldapPassword?: string | null;
  hasPassword?: boolean | null;
  isActive?: boolean | null;
}

@Injectable({
  providedIn: 'root'
})
export class LdapSettingsService {
  constructor(
    private readonly apiService: ApiService,
    private readonly config: ConfigService,
    private readonly translate: TranslateService
  ) { }

  private get endpoint(): string {
    return API_ENDPOINTS.LDAP_SETTINGS.BASE;
  }

  getLdapSettings(): Observable<LdapSettingsDto> {
    this.config.log('Fetching LDAP settings');

    return this.apiService
      .getWithAuth<APIOperationResponse<LdapSettingsApiDto>>(this.endpoint)
      .pipe(
        map(response => {
          if (response.succeeded && !response.data) {
            return {};
          }
          return this.apiDtoToInternalDto(response?.data);
        }),
        catchError((error: unknown) => {
          const httpError = error instanceof HttpErrorResponse ? error : null;

          // Check for 404 or 403 status codes
          const is404 = httpError?.status === 404;
          const is403 = httpError?.status === 403;

          if (is404 || is403) {
            this.config.log('LDAP settings not found or access forbidden, returning empty settings');
            return of({} as LdapSettingsDto);
          }

          // Extract error message from HttpErrorResponse
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Operation failed');
          this.config.logError('Failed to fetch LDAP settings', error);

          // Return error with translated message
          const translatedMessage = this.translate.instant('admin.ldapSettings.errors.fetchFailed');
          return throwError(() => new Error(translatedMessage !== 'admin.ldapSettings.errors.fetchFailed'
            ? translatedMessage
            : errorMessage));
        })
      );
  }

  updateLdapSettings(settings: LdapSettingsDto): Observable<LdapSettingsDto> {
    this.config.log('Updating LDAP settings');

    const apiDto = this.internalDtoToApiDto(settings);

    return this.apiService
      .postWithAuth<APIOperationResponse<LdapSettingsApiDto>>(this.endpoint, apiDto)
      .pipe(
        map(response => {
          if (!response.succeeded) {
            const errorMsg = response.message || this.translate.instant('admin.ldapSettings.errors.updateFailed');
            throw new Error(errorMsg);
          }
          return this.apiDtoToInternalDto(response?.data);
        }),
        catchError((error: unknown) => {
          const httpError = error instanceof HttpErrorResponse ? error : null;
          const status = httpError?.status;

          // Extract error message from HttpErrorResponse using ErrorHandler
          let errorMessage = ErrorHandler.extractErrorMessage(error, 'Operation failed');

          // Determine translation key based on error status
          let translationKey = 'admin.ldapSettings.errors.updateFailed';

          if (status === 403) {
            translationKey = 'admin.ldapSettings.errors.permissionDenied';
          } else if (status === 404) {
            translationKey = 'admin.ldapSettings.errors.endpointNotFound';
          } else if (!errorMessage || errorMessage === 'An error occurred. Please try again.') {
            translationKey = 'admin.ldapSettings.errors.unknownError';
          }

          // Get translated message
          const translatedMessage = this.translate.instant(translationKey);

          // Use translated message if available, otherwise use extracted error message
          const finalMessage = translatedMessage !== translationKey
            ? translatedMessage
            : (errorMessage || this.translate.instant('admin.ldapSettings.errors.unknownError'));

          this.config.logError('Failed to update LDAP settings', error);
          return throwError(() => new Error(finalMessage));
        })
      );
  }

  private apiDtoToInternalDto(apiDto?: LdapSettingsApiDto | null): LdapSettingsDto {
    if (!apiDto) {
      return {};
    }

    return {
      ldapServer: apiDto.ldapServer || null,
      ldapDomain: apiDto.ldapDomain || null,
      ldapEmpAttr: apiDto.ldapEmpAttr || null,
      ldapUsername: apiDto.ldapUsername || null,
      // Password is typically not returned; use presence as indicator
      hasPassword: apiDto.ldapPassword !== undefined &&
        apiDto.ldapPassword !== null &&
        apiDto.ldapPassword !== '',
      isActive: true
    };
  }

  private internalDtoToApiDto(internalDto: LdapSettingsDto): LdapSettingsApiDto {
    const apiDto: LdapSettingsApiDto = {
      ldapServer: internalDto.ldapServer || '',
      ldapDomain: internalDto.ldapDomain || '',
      ldapEmpAttr: internalDto.ldapEmpAttr || 'sAMAccountName',
      ldapUsername: internalDto.ldapUsername || ''
    };

    if (internalDto.ldapPassword) {
      apiDto.ldapPassword = internalDto.ldapPassword;
    }

    if (internalDto.isActive !== undefined && internalDto.isActive !== null) {
      apiDto.isActive = true
    }

    return apiDto;
  }
}


