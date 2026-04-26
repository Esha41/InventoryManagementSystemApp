import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, map, shareReplay } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { LoginResponse } from '@models/auth.model';
import { APIOperationResponse } from '@models/api-response.model';

/**
 * POST /account/refresh with in-flight deduplication (refresh token rotates server-side).
 */
@Injectable({
  providedIn: 'root'
})
export class TokenRefreshService {
  private refreshInProgress: Observable<LoginResponse> | null = null;

  constructor(private apiService: ApiService, private storageService: StorageService) {}

  getRefreshedLoginResponse(): Observable<LoginResponse> {
    if (!this.refreshInProgress) {
      const refreshToken = this.storageService.get<string>('refresh_token');
      this.refreshInProgress = this.apiService
        .postRaw<LoginResponse>(API_ENDPOINTS.AUTH.REFRESH, { refreshToken }, { withCredentials: true })
        .pipe(
          map((res: APIOperationResponse<LoginResponse>) => {
            if (!res.succeeded || !res.data) {
              throw new Error(res.message || 'Refresh failed');
            }
            return res.data;
          }),
          finalize(() => {
            this.refreshInProgress = null;
          }),
          shareReplay({ bufferSize: 1, refCount: true })
        );
    }
    return this.refreshInProgress;
  }
}
