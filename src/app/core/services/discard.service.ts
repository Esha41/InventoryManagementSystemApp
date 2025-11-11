import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';

/**
 * Discard Request DTOs matching backend structure
 */
export interface CreateDiscardDto {
  reason?: string;
  priority: number; // 1 = High, 2 = Medium, 3 = Low
  notes?: string;
  departmentId: number;
  requesterId?: string;
  requestPurposeId: number;
  discardItems: CreateDiscardItemDto[];
}

export interface CreateDiscardItemDto {
  itemId: number;
  quantity: number;
  notes?: string;
}

export interface DiscardDto {
  id: number;
  requestNo: string;
  requestType: number;
  reason?: string;
  priority: number;
  status: number;
  notes?: string;
  departmentId: number;
  requesterId?: number;
  recieverId?: number;
  depotId?: number;
  requestPurposeId: number;
  departmentName?: string;
  requesterName?: string;
  recieverName?: string;
  depotName?: string;
  requestPurposeName?: string;
  requestItems?: DiscardItemDto[];
}

export interface DiscardItemDto {
  id: number;
  itemId: number;
  quantity: number;
  requestId: number;
  notes?: string;
  itemName?: string;
  itemNo?: string;
}

/**
 * Discard Service
 * Handles all discard request operations with the backend
 */
@Injectable({
  providedIn: 'root'
})
export class DiscardService {
  constructor(
    private apiService: ApiService,
    private configService: ConfigService
  ) {}

  /**
   * Create a new discard request
   */
  createDiscard(dto: CreateDiscardDto): Observable<number> {
    this.configService.log('Creating discard request', dto);

    return this.apiService.postWithAuth<APIOperationResponse<number>>(
      API_ENDPOINTS.DISCARDS.BASE,
      dto
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to create discard request');
        }
        return response.data;
      }),
      catchError(error => {
        this.configService.logError('Failed to create discard request', error);
        return throwError(() => new Error(
          error.message || 'Failed to create discard request'
        ));
      })
    );
  }

  /**
   * Get discard by ID
   */
  getDiscardById(id: number): Observable<DiscardDto> {
    this.configService.log(`Fetching discard request ${id}`);

    return this.apiService.getWithAuth<APIOperationResponse<DiscardDto>>(
      API_ENDPOINTS.DISCARDS.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch discard request');
        }
        return response.data;
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch discard request', error);
        return throwError(() => new Error(
          error.message || 'Failed to fetch discard request'
        ));
      })
    );
  }

  /**
   * Get all discard requests
   */
  getAllDiscards(): Observable<DiscardDto[]> {
    this.configService.log('Fetching all discard requests');

    return this.apiService.getWithAuth<APIOperationResponse<DiscardDto[]>>(
      API_ENDPOINTS.DISCARDS.BASE
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch discard requests');
        }
        return response.data || [];
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch discard requests', error);
        return throwError(() => new Error(
          error.message || 'Failed to fetch discard requests'
        ));
      })
    );
  }

  /**
   * Change priority of a discard request
   */
  changePriority(id: number, priority: number): Observable<boolean> {
    this.configService.log(`Changing priority for discard ${id} to ${priority}`);

    return this.apiService.patch<APIOperationResponse<boolean>>(
      API_ENDPOINTS.DISCARDS.CHANGE_PRIORITY(id),
      priority
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to change priority');
        }
        return response.data;
      }),
      catchError(error => {
        this.configService.logError('Failed to change priority', error);
        return throwError(() => new Error(
          error.message || 'Failed to change priority'
        ));
      })
    );
  }

  /**
   * Delete a discard request (soft delete)
   */
  deleteDiscard(id: number): Observable<boolean> {
    this.configService.log(`Deleting discard request ${id}`);

    return this.apiService.deleteWithAuth<APIOperationResponse<boolean>>(
      API_ENDPOINTS.DISCARDS.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to delete discard request');
        }
        return response.data;
      }),
      catchError(error => {
        this.configService.logError('Failed to delete discard request', error);
        return throwError(() => new Error(
          error.message || 'Failed to delete discard request'
        ));
      })
    );
  }
}

