import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { RankDto } from '@models/rank.model';
import { DepartmentDto } from '@models/asset.model';
import { RequestItemDto } from '@models/common.model';

/**
 * Base Request DTO from backend
 * Unified interface for all request types (Order, Return, Discard)
 */
export interface BaseRequestDto {
    id: number;
    requestNo: string;
    requestType: number; // 1=Order, 2=Return, 3=Discard
    reason?: string;
    priority: number; // 1=High, 2=Medium, 3=Low
    status: number; // 1=New, 2=UnderProcess, 3=Approved, 4=Rejected, 6=ReturnedForReview
    notes?: string;
    departmentId: number;
    departmentName?: string;
    departmentNameAr?: string;
    departmentNameEn?: string;
    requesterId?: string;
    requesterName?: string;
    requesterNameAr?: string;
    requesterNameEn?: string;
    requesterRoleNameAr?: string;
    requestPurposeId: number;
    requestPurposeName?: string;
    requestPurposeNameAr?: string;
    requestPurposeNameEn?: string;
    requestDate: string | Date; // For compatibility with workflow-approval.model
    creationDate: string | Date;

    // Nested navigation objects
    department?: {
        id: number;
        code: string;
        nameAr: string;
        nameEn: string;
        isDeleted: boolean;
    };

    requester?: {
        id: string;
        userName: string;
        fullNameEN: string;
        fullNameAR: string;
        militoryId?: string | null;
        email?: string;
        rank?: RankDto;
        department?: DepartmentDto;
    };

    requestPurpose?: {
        id: number;
        nameAr: string;
        nameEn: string;
        requestType: number;
    };

    requestItems?: RequestItemDto[];

    // Order-specific fields (nullable for Return/Discard requests)
    usageDateFrom?: string | Date;
    usageDateTo?: string | Date;
    usageTimeFrom?: string;
    usageTimeTo?: string;
    usagePurpose?: string;
    usageLocation?: string;
    isFromAllowance?: boolean;
    annualDiscard?: boolean;
    numberOfOfficer?: number;
    numberOfOtherRank?: number;
    depotId?: number;
    depotNameAr?: string;
    depotNameEn?: string;
    receiverId?: string;
    receiverName?: string;
    isMyTurn?: boolean;
    [key: string]: any; // Allow dynamic property access
}

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
     * @returns Observable of BaseRequestDto array
     */
    getUserActionRequests(status?: number, requestType?: number): Observable<BaseRequestDto[]> {
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

        return this.apiService.getWithAuth<APIOperationResponse<BaseRequestDto[]>>(url).pipe(
            map(response => {
                if (!response.succeeded) {
                    throw new Error(response.message || 'Failed to fetch user action requests');
                }
                return response.data ?? [];
            }),
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
     * @returns Observable of BaseRequestDto array
     */
    getAllRequests(status?: number, requestType?: number): Observable<BaseRequestDto[]> {
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

        return this.apiService.getWithAuth<APIOperationResponse<BaseRequestDto[]>>(url).pipe(
            map(response => {
                if (!response.succeeded) {
                    throw new Error(response.message || 'Failed to fetch all requests');
                }
                return response.data ?? [];
            }),
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
     * @returns Observable of BaseRequestDto array
     */
    getRequestsByDepartment(departmentId: number, status?: number, requestType?: number): Observable<BaseRequestDto[]> {
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

        return this.apiService.getWithAuth<APIOperationResponse<BaseRequestDto[]>>(url).pipe(
            map(response => {
                if (!response.succeeded) {
                    throw new Error(response.message || 'Failed to fetch department requests');
                }
                return response.data ?? [];
            }),
            catchError(error => {
                this.config.logError('Failed to fetch department requests', error);
                return of([]);
            })
        );
    }
}

