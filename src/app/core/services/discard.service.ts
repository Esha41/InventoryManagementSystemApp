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
  requesterId?: string;
  recieverId?: number;
  depotId?: number;
  requestPurposeId: number;
  // Nested objects from backend BaseRequestDto
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
    rank?: any;
    department?: any;
  };
  requestPurpose?: {
    id: number;
    nameAr: string;
    nameEn: string;
    requestType: number;
  };
  requestItems?: DiscardItemDto[];
  creationDate?: string | Date; // From BaseRequestDto
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
  ) { }

  /**
   * Create a new discard request
   */
  createDiscard(dto: CreateDiscardDto, files?: File[]): Observable<number> {
    this.configService.log('Creating discard request', dto);

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

      // Append DiscardItems array
      if (dto.discardItems && dto.discardItems.length > 0) {
        dto.discardItems.forEach((item, index) => {
          formData.append(`DiscardItems[${index}].ItemId`, item.itemId.toString());
          formData.append(`DiscardItems[${index}].Quantity`, item.quantity.toString());
          if (item.notes) {
            formData.append(`DiscardItems[${index}].Notes`, item.notes);
          }
        });
      }

      // Append files
      files.forEach(file => {
        formData.append('files', file);
      });

      return this.apiService.postWithAuth<APIOperationResponse<number>>(
        API_ENDPOINTS.DISCARDS.BASE,
        formData
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

    // No files - send as JSON
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

