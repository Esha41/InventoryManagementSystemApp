import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { CreateDiscardDto, DiscardDto } from '@models/discard.model';
import { ErrorHandler } from '@utils/error-handler.utils';

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
   * Create a new discard request (always multipart/form-data to match the API).
   */
  createDiscard(dto: CreateDiscardDto, files?: File[]): Observable<number> {
    this.configService.log('Creating discard request', dto);

    const formData = new FormData();

    if (dto.reason) formData.append('Reason', dto.reason);
    formData.append('Priority', dto.priority.toString());
    if (dto.notes) formData.append('Notes', dto.notes);
    formData.append('DepartmentId', dto.departmentId.toString());
    if (dto.requesterId) formData.append('RequesterId', dto.requesterId);
    formData.append('RequestPurposeId', dto.requestPurposeId.toString());

    if (dto.discardItems && dto.discardItems.length > 0) {
      dto.discardItems.forEach((item, index) => {
        formData.append(`DiscardItems[${index}].ItemId`, item.itemId.toString());
        formData.append(`DiscardItems[${index}].Quantity`, item.quantity.toString());
        if (item.notes) {
          formData.append(`DiscardItems[${index}].Notes`, item.notes);
        }
      });
    }

    if (files && files.length > 0) {
      files.forEach(file => {
        formData.append('files', file);
      });
    }

    return this.apiService.post<number>(API_ENDPOINTS.DISCARDS.BASE, formData).pipe(
      catchError(error => {
        this.configService.logError('Failed to create discard request', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to create discard request');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Get discard by ID
   */
  getDiscardById(id: number): Observable<DiscardDto> {
    this.configService.log(`Fetching discard request ${id}`);
    return this.apiService.get<DiscardDto>(API_ENDPOINTS.DISCARDS.BY_ID(id)).pipe(
      catchError(error => {
        this.configService.logError('Failed to fetch discard request', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to fetch discard request');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Get all discard requests
   */
  getAllDiscards(): Observable<DiscardDto[]> {
    this.configService.log('Fetching all discard requests');
    return this.apiService.get<DiscardDto[]>(API_ENDPOINTS.DISCARDS.BASE).pipe(
      catchError(error => {
        this.configService.logError('Failed to fetch discard requests', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to fetch discard requests');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Change priority of a discard request
   */
  changePriority(id: number, priority: number): Observable<boolean> {
    this.configService.log(`Changing priority for discard ${id} to ${priority}`);
    return this.apiService.patch<boolean>(
      API_ENDPOINTS.DISCARDS.CHANGE_PRIORITY(id),
      priority
    ).pipe(
      catchError(error => {
        this.configService.logError('Failed to change priority', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to change priority');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Delete a discard request (soft delete)
   */
  deleteDiscard(id: number): Observable<boolean> {
    this.configService.log(`Deleting discard request ${id}`);
    return this.apiService.delete<boolean>(API_ENDPOINTS.DISCARDS.BY_ID(id)).pipe(
      catchError(error => {
        this.configService.logError('Failed to delete discard request', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to delete discard request');
        return throwError(() => new Error(msg));
      })
    );
  }
}

