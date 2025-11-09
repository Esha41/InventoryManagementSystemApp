import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';

/**
 * Return Request DTOs matching backend structure
 */
export interface CreateReturnDto {
  reason?: string;
  priority: number; // 1 = High, 2 = Medium, 3 = Low
  notes?: string;
  departmentId: number;
  requesterId?: number;
  requestPurposeId: number;
  returnItems: CreateReturnItemDto[];
}

export interface CreateReturnItemDto {
  itemId: number;
  quantity: number;
  notes?: string;
}

export interface ReturnDto {
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
  requestItems?: ReturnItemDto[];
}

export interface ReturnItemDto {
  id: number;
  itemId: number;
  quantity: number;
  requestId: number;
  notes?: string;
  itemName?: string;
  itemNo?: string;
}

/**
 * Return Service
 * Handles all return request operations with the backend
 */
@Injectable({
  providedIn: 'root'
})
export class ReturnService {
  constructor(
    private apiService: ApiService,
    private configService: ConfigService
  ) {}

  /**
   * Create a new return request
   */
  createReturn(dto: CreateReturnDto): Observable<number> {
    this.configService.log('Creating return request', dto);

    return this.apiService.postWithAuth<APIOperationResponse<number>>(
      API_ENDPOINTS.RETURNS.BASE,
      dto
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to create return request');
        }
        return response.data;
      }),
      catchError(error => {
        this.configService.logError('Failed to create return request', error);
        return throwError(() => new Error(
          error.message || 'Failed to create return request'
        ));
      })
    );
  }

  /**
   * Get return by ID
   */
  getReturnById(id: number): Observable<ReturnDto> {
    this.configService.log(`Fetching return request ${id}`);

    return this.apiService.getWithAuth<APIOperationResponse<ReturnDto>>(
      API_ENDPOINTS.RETURNS.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch return request');
        }
        return response.data;
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch return request', error);
        return throwError(() => new Error(
          error.message || 'Failed to fetch return request'
        ));
      })
    );
  }

  /**
   * Get all return requests
   */
  getAllReturns(): Observable<ReturnDto[]> {
    this.configService.log('Fetching all return requests');

    return this.apiService.getWithAuth<APIOperationResponse<ReturnDto[]>>(
      API_ENDPOINTS.RETURNS.BASE
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch return requests');
        }
        return response.data || [];
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch return requests', error);
        return throwError(() => new Error(
          error.message || 'Failed to fetch return requests'
        ));
      })
    );
  }

  /**
   * Change priority of a return request
   */
  changePriority(id: number, priority: number): Observable<boolean> {
    this.configService.log(`Changing priority for return ${id} to ${priority}`);

    return this.apiService.patch<APIOperationResponse<boolean>>(
      API_ENDPOINTS.RETURNS.CHANGE_PRIORITY(id),
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
   * Delete a return request (soft delete)
   */
  deleteReturn(id: number): Observable<boolean> {
    this.configService.log(`Deleting return request ${id}`);

    return this.apiService.deleteWithAuth<APIOperationResponse<boolean>>(
      API_ENDPOINTS.RETURNS.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to delete return request');
        }
        return response.data;
      }),
      catchError(error => {
        this.configService.logError('Failed to delete return request', error);
        return throwError(() => new Error(
          error.message || 'Failed to delete return request'
        ));
      })
    );
  }
}

