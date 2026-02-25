import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { CreateReturnDto, ReturnDto } from '@models/return.model';

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
  ) { }

  /**
   * Create a new return request
   */
  createReturn(dto: CreateReturnDto, files?: File[]): Observable<number> {
    this.configService.log('Creating return request', dto);

    // If files are provided, use FormData
    if (files && files.length > 0) {
      const formData = new FormData();

      // Append DTO properties
      if (dto.reason) formData.append('Reason', dto.reason);
      formData.append('Priority', dto.priority.toString());
      if (dto.notes) formData.append('Notes', dto.notes);
      formData.append('DepartmentId', dto.departmentId.toString());
      if (dto.requesterId) formData.append('RequesterId', dto.requesterId);
      formData.append('RequestPurposeId', dto.requestPurposeId.toString());

      // Append ReturnItems array
      if (dto.returnItems && dto.returnItems.length > 0) {
        dto.returnItems.forEach((item, index) => {
          formData.append(`ReturnItems[${index}].ItemId`, item.itemId.toString());
          formData.append(`ReturnItems[${index}].Quantity`, item.quantity.toString());
          if (item.notes) {
            formData.append(`ReturnItems[${index}].Notes`, item.notes);
          }
        });
      }

      // Append files
      files.forEach(file => {
        formData.append('files', file);
      });

      return this.apiService.postWithAuth<APIOperationResponse<number>>(
        API_ENDPOINTS.RETURNS.BASE,
        formData
      ).pipe(
        map(response => {
          if (!response.succeeded) {
            throw new Error(response.message || 'Failed to create return request');
          }
          return response.data;
        }),
        catchError(error => {
          this.configService.logError('Failed to create return request', error);
          const msg = error?.error?.message ?? error?.error?.Message ?? error?.message ?? 'Failed to create return request';
          return throwError(() => new Error(msg));
        })
      );
    }

    // No files - send as JSON
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
        const msg = error?.error?.message ?? error?.error?.Message ?? error?.message ?? 'Failed to create return request';
        return throwError(() => new Error(msg));
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

