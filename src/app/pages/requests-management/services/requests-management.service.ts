/**
 * Requests Management Service
 * Handles business logic for requests management page
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ConfigService } from '@services/config.service';
import { BaseRequestDto } from '@models/workflow-approval.model';
import { Request } from '../models/requests-management.model';
import { mapBaseRequestToRequest } from '../utils/request-mapper.utils';

@Injectable({
  providedIn: 'root'
})
export class RequestsManagementService {
  constructor(
    private apiService: ApiService,
    private config: ConfigService
  ) {}

  /**
   * Load all base requests
   */
  loadRequests(): Observable<Request[]> {
    return this.apiService.getWithAuth<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    ).pipe(
      map((response: any) => {
        // Handle both direct array response and wrapped response
        const data: BaseRequestDto[] = Array.isArray(response) 
          ? response 
          : (response?.data || []);
        
        return data.map(item => mapBaseRequestToRequest(item));
      }),
      catchError((error) => {
        this.config.logError('Failed to load requests', error);
        return [];
      })
    );
  }
}

