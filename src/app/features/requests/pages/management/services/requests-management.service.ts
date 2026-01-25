/**
 * Requests Management Service
 * Handles business logic for requests management page
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UnifiedRequestService, BaseRequestDto } from '@services/unified-request.service';
import { PaginatedList, PagedRequest, FilterData } from '@models/api-response.model';
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

  /**
   * Load requests with centralized filter logic
   */
  getRequests(
    page: number,
    pageSize: number,
    searchQuery: string,
    statusFilter: string,
    priorityFilter: string
  ): Observable<PaginatedList<Request>> {
    const filters: FilterData[] = [];

    // Search filter
    if (searchQuery && searchQuery.trim()) {
      filters.push({ value: searchQuery.trim() });
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'action-required') {
        filters.push({ field: 'IsMyTurn', operator: 'eq', value: 'true' });
      } else {
        const statusMap: Record<string, number> = {
          'new': 1,
          'on-progress': 2,
          'completed': 3,
          'declined': 4,
          'returned': 6
        };
        const statusValue = statusMap[statusFilter];
        if (statusValue) {
          filters.push({ field: 'Status', operator: 'eq', value: statusValue.toString() });
        }
      }
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      const priorityMap: Record<string, number> = {
        'normal': 1,
        'urgent': 2,
        'veryurgent': 3
      };
      const priorityValue = priorityMap[priorityFilter.toLowerCase().replace(/\s+/g, '')];
      if (priorityValue !== undefined) {
        filters.push({ field: 'Priority', operator: 'eq', value: priorityValue.toString() });
      }
    }

    const request: PagedRequest = {
      page,
      pageSize,
      filter: filters.length > 0 ? (filters.length === 1 ? filters[0] : { logic: 'and', filters }) : undefined
    };

    return this.loadRequestsPaginated(request);
  }

  /**
   * Load requests with pagination (base method)
   */
  loadRequestsPaginated(request: PagedRequest): Observable<PaginatedList<Request>> {
    return this.unifiedRequestService.getUserActionRequestsPaginated(request).pipe(
      map(paginatedData => ({
        ...paginatedData,
        items: paginatedData.items.map(item => mapBaseRequestToRequest(item))
      }))
    );
  }
}

