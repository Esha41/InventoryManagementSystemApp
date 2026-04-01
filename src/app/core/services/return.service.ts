import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { CreateReturnDto, ReturnDto } from '@models/return.model';
import { ErrorHandler } from '@utils/error-handler.utils';

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

      return this.apiService.post<number>(API_ENDPOINTS.RETURNS.BASE, formData).pipe(
        catchError(error => {
          this.configService.logError('Failed to create return request', error);
          const msg = ErrorHandler.extractErrorMessage(error, 'Failed to create return request');
          return throwError(() => new Error(msg));
        })
      );
    }

    // No files - send as JSON
    return this.apiService.post<number>(API_ENDPOINTS.RETURNS.BASE, dto).pipe(
      catchError(error => {
        this.configService.logError('Failed to create return request', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to create return request');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Get return by ID
   */
  getReturnById(id: number): Observable<ReturnDto> {
    this.configService.log(`Fetching return request ${id}`);
    return this.apiService.get<ReturnDto>(API_ENDPOINTS.RETURNS.BY_ID(id)).pipe(
      catchError(error => {
        this.configService.logError('Failed to fetch return request', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to fetch return request');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Get all return requests
   */
  getAllReturns(): Observable<ReturnDto[]> {
    this.configService.log('Fetching all return requests');
    return this.apiService.get<ReturnDto[]>(API_ENDPOINTS.RETURNS.BASE).pipe(
      catchError(error => {
        this.configService.logError('Failed to fetch return requests', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to fetch return requests');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Change priority of a return request
   */
  changePriority(id: number, priority: number): Observable<boolean> {
    this.configService.log(`Changing priority for return ${id} to ${priority}`);
    return this.apiService.patch<boolean>(
      API_ENDPOINTS.RETURNS.CHANGE_PRIORITY(id),
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
   * Delete a return request (soft delete)
   */
  deleteReturn(id: number): Observable<boolean> {
    this.configService.log(`Deleting return request ${id}`);
    return this.apiService.delete<boolean>(API_ENDPOINTS.RETURNS.BY_ID(id)).pipe(
      catchError(error => {
        this.configService.logError('Failed to delete return request', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to delete return request');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Set/update the depot for a return request
   */
  setDepot(returnId: number, depotId: number): Observable<boolean> {
    this.configService.log(`Setting depot ${depotId} for return ${returnId}`);
    return this.apiService.put<boolean>(
      API_ENDPOINTS.RETURNS.SET_DEPOT(returnId),
      { depotId }
    ).pipe(
      catchError(error => {
        this.configService.logError('Failed to set return depot', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to set return depot');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Set/update the delivery date for a return request
   */
  setDeliveryDate(returnId: number, deliveryDate: string): Observable<boolean> {
    this.configService.log(`Setting delivery date for return ${returnId}`);
    return this.apiService.put<boolean>(
      API_ENDPOINTS.RETURNS.SET_DELIVERY_DATE(returnId),
      { deliveryDate }
    ).pipe(
      catchError(error => {
        this.configService.logError('Failed to set return delivery date', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to set return delivery date');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Process return items (ammo/explosive and weapon) and approve the return
   */
  processReturnItems(returnId: number, dto: ProcessReturnItemsDto): Observable<boolean> {
    this.configService.log(`Processing return items for return ${returnId}`, dto);
    return this.apiService.put<boolean>(
      API_ENDPOINTS.RETURNS.PROCESS_ITEMS(returnId),
      dto
    ).pipe(
      catchError(error => {
        this.configService.logError('Failed to process return items', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to process return items');
        return throwError(() => new Error(msg));
      })
    );
  }
}

export interface ProcessReturnItemsDto {
  ammoExplosiveItems: ReturnAmmoExplosiveItemDto[];
  weaponItems: ReturnWeaponItemDto[];
}

export interface ReturnAmmoExplosiveItemDto {
  itemId: number;
  quantity: number;
  lot: string;
}

export interface ReturnWeaponItemDto {
  itemId: number;
  serialNumber: string;
  batchNumber: string;
}

