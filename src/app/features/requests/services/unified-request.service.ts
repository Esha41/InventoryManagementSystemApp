import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { PagedRequest, PaginatedList } from '@models/api-response.model';
import { RequestItemDto } from '@models/common.model';
import type { UnifiedListRequestDto } from '@models/unified-list-request.model';


export type { UnifiedListRequestDto as BaseRequestDto } from '@models/unified-list-request.model';

// RequestItemDto is now imported from @models/common.model
// Re-export for backward compatibility
export type { RequestItemDto } from '@models/common.model';

/**
 * Unified Request Service
 * Provides a single endpoint to fetch all request types
 */
@Injectable({
    providedIn: 'root'
})
export class UnifiedRequestService {
    constructor(
        private apiService: ApiService,
        private config: ConfigService
    ) { }

    /**
     * Get all requests where the current user can take action or has taken action
     * This replaces the need to call Order, Return, and Discard endpoints separately
     * 
     * @param status Optional status filter (1=New, 2=UnderProcess, 3=Approved, 4=Rejected, 6=ReturnedForReview)
     * @param requestType Optional type filter (1=Order, 2=Return, 3=Discard)
     * @returns Observable of UnifiedListRequestDto array
     */
    getUserActionRequests(status?: number, requestType?: number): Observable<UnifiedListRequestDto[]> {
        this.config.log('Fetching user action requests', { status, requestType });

        // Build query params
        let url = API_ENDPOINTS.REQUESTS.USER_ACTIONS;
        const params: string[] = [];

        if (status !== undefined && status !== null) {
            params.push(`status=${status}`);
        }

        if (requestType !== undefined && requestType !== null) {
            params.push(`requestType=${requestType}`);
        }

        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }

        return this.apiService.get<UnifiedListRequestDto[]>(url).pipe(
            map(data => data ?? []),
            catchError(error => {
                this.config.logError('Failed to fetch user action requests', error);
                return of([]); // Return empty array on error to prevent breaking the UI
            })
        );
    }

    /**
     * Get all requests (admin/receiver view)
     * 
     * @param status Optional status filter
     * @param requestType Optional type filter
     * @returns Observable of UnifiedListRequestDto array
     */
    getAllRequests(status?: number, requestType?: number): Observable<UnifiedListRequestDto[]> {
        this.config.log('Fetching all requests', { status, requestType });

        let url = API_ENDPOINTS.REQUESTS.ALL;
        const params: string[] = [];

        if (status !== undefined && status !== null) {
            params.push(`status=${status}`);
        }

        if (requestType !== undefined && requestType !== null) {
            params.push(`requestType=${requestType}`);
        }

        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }

        return this.apiService.get<UnifiedListRequestDto[]>(url).pipe(
            map(data => data ?? []),
            catchError(error => {
                this.config.logError('Failed to fetch all requests', error);
                return of([]);
            })
        );
    }

    /**
     * Get requests by department
     * 
     * @param departmentId Department ID
     * @param status Optional status filter
     * @param requestType Optional type filter
     * @returns Observable of UnifiedListRequestDto array
     */
    getRequestsByDepartment(departmentId: number, status?: number, requestType?: number): Observable<UnifiedListRequestDto[]> {
        this.config.log('Fetching requests by department', { departmentId, status, requestType });

        let url = API_ENDPOINTS.REQUESTS.BY_DEPARTMENT(departmentId);
        const params: string[] = [];

        if (status !== undefined && status !== null) {
            params.push(`status=${status}`);
        }

        if (requestType !== undefined && requestType !== null) {
            params.push(`requestType=${requestType}`);
        }

        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }

        return this.apiService.get<UnifiedListRequestDto[]>(url).pipe(
            map(data => data ?? []),
            catchError(error => {
                this.config.logError('Failed to fetch department requests', error);
                return of([]);
            })
        );
    }
    /**
     * Get all requests where the current user can take action (paginated)
     */
    getUserActionRequestsPaginated(request: PagedRequest): Observable<PaginatedList<UnifiedListRequestDto>> {
        this.config.log('Fetching user action requests (paginated)', request);
        return this.apiService.post<PaginatedList<UnifiedListRequestDto>>(
            API_ENDPOINTS.REQUESTS.USER_ACTIONS_PAGINATED,
            request
        );
    }

    /**
     * Get all requests (paginated)
     */
    getAllRequestsPaginated(request: PagedRequest): Observable<PaginatedList<UnifiedListRequestDto>> {
        this.config.log('Fetching all requests (paginated)', request);
        return this.apiService.post<PaginatedList<UnifiedListRequestDto>>(
            API_ENDPOINTS.REQUESTS.PAGINATED,
            request
        );
    }
}

