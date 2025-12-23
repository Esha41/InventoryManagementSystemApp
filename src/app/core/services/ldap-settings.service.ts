import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';

// API DTO matching backend LdapSettings contract
export interface LdapSettingsApiDto {
  ldapServer: string;
  ldapDomain: string;
  ldapEmpAttr: string;
  ldapUsername: string;
  ldapPassword?: string;
}

// Internal DTO used by components
export interface LdapSettingsDto {
  ldapServer?: string | null;
  ldapDomain?: string | null;
  ldapEmpAttr?: string | null;
  ldapUsername?: string | null;
  ldapPassword?: string | null;
  hasPassword?: boolean | null;
}

@Injectable({
  providedIn: 'root'
})
export class LdapSettingsService {
  constructor(
    private readonly apiService: ApiService,
    private readonly config: ConfigService
  ) {}

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
        catchError(error => {
          const is404 = (error as any)?.status === 404 ||
            error?.message?.includes('404') ||
            error?.message?.includes('Resource not found') ||
            error?.message?.includes('Not Found');

          const is403 = (error as any)?.status === 403 ||
            error?.message?.includes('403') ||
            error?.message?.includes('Forbidden');

          if (is404 || is403) {
            this.config.log('LDAP settings not found or access forbidden, returning empty settings');
            return of({} as LdapSettingsDto);
          }

          this.config.logError('Failed to fetch LDAP settings', error);
          return throwError(() => error);
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
            throw new Error(response.message || 'Failed to update LDAP settings');
          }
          return this.apiDtoToInternalDto(response?.data);
        }),
        catchError(error => {
          let errorMessage = 'Failed to update LDAP settings';

          const status = (error as any)?.status;
          const errorMsg = error instanceof Error ? error.message : String(error);

          if (status === 403 || errorMsg?.includes('403') || errorMsg?.includes('Forbidden')) {
            errorMessage = 'You do not have permission to update LDAP settings. Please contact your administrator.';
          } else if (status === 404 || errorMsg?.includes('404') || errorMsg?.includes('Not Found')) {
            errorMessage = 'LDAP settings endpoint not found. Please verify the API endpoint is configured correctly.';
          } else if (error instanceof Error && error.message && error.message !== 'An unknown error occurred') {
            errorMessage = error.message;
          } else if (errorMsg && errorMsg !== 'An unknown error occurred') {
            errorMessage = errorMsg;
          }

          this.config.logError('Failed to update LDAP settings', error);
          return throwError(() => new Error(errorMessage));
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
        apiDto.ldapPassword !== ''
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

    return apiDto;
  }
}


