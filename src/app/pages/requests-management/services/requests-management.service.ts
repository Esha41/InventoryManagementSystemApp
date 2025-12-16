/**
 * Requests Management Service
 * Handles business logic for requests management page
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UnifiedRequestService, BaseRequestDto } from '@services/unified-request.service';
import { Request } from '../models/requests-management.model';
import { mapBaseRequestToRequest } from '../utils/request-mapper.utils';

@Injectable({
  providedIn: 'root'
})
export class RequestsManagementService {
  constructor(
    private unifiedRequestService: UnifiedRequestService
  ) { }

  /**
   * Load all requests for the current user
   * Uses the unified endpoint for better performance
   */
  loadRequests(): Observable<Request[]> {
    return this.unifiedRequestService.getUserActionRequests().pipe(
      map((data: BaseRequestDto[]) => {
        return data.map(item => mapBaseRequestToRequest(item));
      })
    );
  }
}

