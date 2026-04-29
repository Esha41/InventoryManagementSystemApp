import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ApiService } from '../api.service';
import { ConfigService } from '../config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ApplicationEntityDto } from '@models/backend-user.model';
import { ErrorHandler } from '@utils/error-handler.utils';

/**
 * Application Entities API Service
 *
 * Single responsibility: read the catalog of application entities
 * (the resources that can be permissioned). Tolerant of two response
 * shapes from the backend: a bare array, or an `{ data: [...] }` envelope.
 */
@Injectable({
  providedIn: 'root'
})
export class ApplicationEntitiesApiService {
  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService
  ) {}

  getApplicationEntities(): Observable<ApplicationEntityDto[]> {
    this.configService.log('Fetching application entities');

    return this.apiService.get<ApplicationEntityDto[]>(API_ENDPOINTS.APPLICATION_ENTITIES.BASE).pipe(
      map((response: ApplicationEntityDto[] | Record<string, unknown>) => {
        if (Array.isArray(response)) {
          return response;
        }
        if (response && typeof response === 'object') {
          return (response as { data?: ApplicationEntityDto[] })?.data ?? [];
        }
        return [];
      }),
      tap(entities => this.configService.log(`Fetched ${entities.length} application entities`)),
      catchError(error => {
        this.configService.logError('Failed to fetch application entities', error);
        const err = error as { status?: number } | undefined;
        const errorMessage = err?.status === 404
          ? 'Application entities endpoint not found. Please check the API endpoint.'
          : ErrorHandler.extractErrorMessage(error, 'Failed to fetch application entities');
        return throwError(() => new Error(errorMessage));
      })
    );
  }
}
