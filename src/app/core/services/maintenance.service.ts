import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';

export interface MaintenanceStatus {
  isEnabled: boolean;
}

/**
 * Service for maintenance mode status.
 * Uses runtime-config.json when server is down (no API call needed).
 * GET is public (no auth); PUT requires admin.
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  constructor(
    private apiService: ApiService,
    private configService: ConfigService
  ) {}

  /**
   * Gets current maintenance mode status.
   * - If runtime-config.maintenance.enabled is true: always maintenance (works when server down).
   * - Else: call API; on failure, if showWhenApiDown: treat as maintenance.
   */
  getStatus(): Observable<MaintenanceStatus> {
    if (this.configService.maintenanceEnabled) {
      return of({ isEnabled: true });
    }

    return this.apiService.get<MaintenanceStatus>(API_ENDPOINTS.MAINTENANCE.STATUS).pipe(
      map(res => ({ isEnabled: res?.isEnabled ?? false })),
      catchError(() =>
        of({
          isEnabled: this.configService.maintenanceShowWhenApiDown
        })
      )
    );
  }

  /**
   * Sets maintenance mode. Requires admin permission.
   */
  setEnabled(isEnabled: boolean): Observable<boolean> {
    return this.apiService.put<boolean>(API_ENDPOINTS.MAINTENANCE.STATUS, { isEnabled }).pipe(
      catchError(() => of(false))
    );
  }
}
