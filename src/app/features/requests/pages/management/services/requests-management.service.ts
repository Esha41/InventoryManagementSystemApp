/**
 * Requests Management Service
 * Handles business logic for requests management page
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UnifiedRequestService, BaseRequestDto } from '@requests/services/unified-request.service';
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
    priorityFilter: string,
    sortState: { column: string | null; direction: 'asc' | 'desc' }
  ): Observable<PaginatedList<Request>> {
    const filters: FilterData[] = [];

    if (searchQuery && searchQuery.trim()) {
      filters.push({ value: searchQuery.trim() });
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'action-required') {
        filters.push({ field: 'IsMyTurn', operator: 'eq', value: 'true' });
      } else {
        // Include AutoRejected (7) under declined/rejected filter.
        if (statusFilter === 'declined') {
          filters.push({
            logic: 'or',
            filters: [
              { field: 'Status', operator: 'eq', value: '4' },
              { field: 'Status', operator: 'eq', value: '7' }
            ]
          });
        } else {
        const statusMap: Record<string, number> = {
          new: 1,
          'on-progress': 2,
          completed: 3,
          declined: 4,
          returned: 6
        };
        const statusValue = statusMap[statusFilter];
        if (statusValue) {
          filters.push({ field: 'Status', operator: 'eq', value: statusValue.toString() });
        }
        }
      }
    }

    if (priorityFilter !== 'all') {
      const priorityMap: Record<string, number> = {
        normal: 1,
        urgent: 2,
        veryurgent: 3
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

    this.applySortToPagedRequest(request, sortState);

    return this.loadRequestsPaginated(request);
  }

  /**
   * Mirrors dashboard list sorting: action-required first, then priority/date or user-selected column.
   */
  private applySortToPagedRequest(
    pagedRequest: PagedRequest,
    sortState: { column: string | null; direction: 'asc' | 'desc' }
  ): void {
    const columnMap: Record<string, string> = {
      orderNumber: 'RequestNo',
      usageDate: 'CreationDate',
      priority: 'Priority',
      requestType: 'RequestType',
      status: 'Status'
    };

    const sortColumn = sortState.column ?? 'priority';
    const sortDir = sortState.column ? sortState.direction : 'desc';
    const backendColumn = columnMap[sortColumn];
    if (!backendColumn) return;

    if (!pagedRequest.filter) {
      pagedRequest.filter = {};
    }
    pagedRequest.filter.sortField = backendColumn;
    pagedRequest.filter.sortDirection = sortDir === 'asc' ? 1 : 2;
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

