import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { AssetStatus } from '@models/asset.model';
import { CreateReturnDto, ReturnDto, ReturnTrackingLineDto } from '@models/return.model';
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
   * Create a new return request (multipart/form-data). Mirrored from `OrderService.createOrder` file fields.
   */
  createReturn(
    dto: CreateReturnDto,
    options?: {
      attachmentUploads?: Map<number, File[]>;
      otherFiles?: File[];
    }
  ): Observable<number>;

  /** @deprecated Prefer `createReturn(dto, { otherFiles: files })` */
  createReturn(dto: CreateReturnDto, files?: File[]): Observable<number>;

  createReturn(
    dto: CreateReturnDto,
    filesOrOptions?: File[] | {
      attachmentUploads?: Map<number, File[]>;
      otherFiles?: File[];
    }
  ): Observable<number> {
    this.configService.log('Creating return request', dto);

    const opts = Array.isArray(filesOrOptions)
      ? { otherFiles: filesOrOptions }
      : filesOrOptions;

    const attachmentUploads = opts?.attachmentUploads;
    const otherFilesArg = opts?.otherFiles;

    const formData = new FormData();

    if (dto.reason) formData.append('Reason', dto.reason);
    formData.append('Priority', dto.priority.toString());
    if (dto.notes) formData.append('Notes', dto.notes);
    if (dto.requestPurposeNotes) formData.append('RequestPurposeNotes', dto.requestPurposeNotes);
    formData.append('DepartmentId', dto.departmentId.toString());
    if (dto.requesterId) formData.append('RequesterId', dto.requesterId);
    formData.append('RequestPurposeId', dto.requestPurposeId.toString());

    if (dto.returnItems && dto.returnItems.length > 0) {
      dto.returnItems.forEach((item, index) => {
        formData.append(`ReturnItems[${index}].ItemId`, item.itemId.toString());
        formData.append(`ReturnItems[${index}].Quantity`, item.quantity.toString());
        if (item.notes) {
          formData.append(`ReturnItems[${index}].Notes`, item.notes);
        }
      });
    }

    if (attachmentUploads && attachmentUploads.size > 0) {
      let groupIndex = 0;
      attachmentUploads.forEach((files, requirementId) => {
        const effective = (files ?? []).filter(f => f instanceof File && f.size > 0);
        if (effective.length === 0) {
          return;
        }
        formData.append(`AttachmentUploads[${groupIndex}].AttachmentRequirementId`, String(requirementId));
        effective.forEach(f => formData.append(`AttachmentUploads[${groupIndex}].Files`, f));
        groupIndex++;
      });
    }

    if (otherFilesArg && otherFilesArg.length > 0) {
      otherFilesArg.forEach(file => {
        if (file instanceof File && file.size > 0) {
          formData.append('OtherFiles', file);
        }
      });
    }

    return this.apiService.post<number>(API_ENDPOINTS.RETURNS.BASE, formData).pipe(
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
   * Return tracking lines for a return (empty until items have been processed).
   */
  getReturnTrackingLines(returnId: number): Observable<ReturnTrackingLineDto[]> {
    this.configService.log(`Fetching return tracking lines for return ${returnId}`);
    return this.apiService.get<ReturnTrackingLineDto[]>(API_ENDPOINTS.RETURNS.TRACKING_LINES(returnId)).pipe(
      catchError(error => {
        this.configService.logError('Failed to fetch return tracking lines', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to fetch return tracking lines');
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Process return items (ammo/explosive and weapon) and approve the return.
   * Always multipart/form-data (indexed DTO fields + optional files).
   */
  processReturnItems(returnId: number, dto: ProcessReturnItemsDto, files?: File[]): Observable<boolean> {
    this.configService.log(`Processing return items for return ${returnId}`, dto);

    const formData = new FormData();
    this.appendProcessReturnItemsToFormData(formData, dto);

    if (files && files.length > 0) {
      files.forEach(f => formData.append('files', f, f.name));
    }

    return this.apiService.put<boolean>(
      API_ENDPOINTS.RETURNS.PROCESS_ITEMS(returnId),
      formData
    ).pipe(
      catchError(error => {
        this.configService.logError('Failed to review return items', error);
        const msg = ErrorHandler.extractErrorMessage(error, 'Failed to review return items');
        return throwError(() => new Error(msg));
      })
    );
  }

  private appendProcessReturnItemsToFormData(formData: FormData, dto: ProcessReturnItemsDto): void {
    if (dto.workflowStepComments) {
      formData.append('WorkflowStepComments', dto.workflowStepComments);
    }

    (dto.ammoExplosiveItems ?? []).forEach((item, index) => {
      formData.append(`AmmoExplosiveItems[${index}].ItemId`, item.itemId.toString());
      formData.append(`AmmoExplosiveItems[${index}].Quantity`, item.quantity.toString());
      if (item.returnedQuantity != null) {
        formData.append(`AmmoExplosiveItems[${index}].ReturnedQuantity`, item.returnedQuantity.toString());
      }
      if (item.notes) {
        formData.append(`AmmoExplosiveItems[${index}].Notes`, item.notes);
      }
      if (item.requestItemId != null) {
        formData.append(`AmmoExplosiveItems[${index}].RequestItemId`, item.requestItemId.toString());
      }
    });

    (dto.weaponItems ?? []).forEach((item, index) => {
      formData.append(`WeaponItems[${index}].ItemId`, item.itemId.toString());
      formData.append(`WeaponItems[${index}].SerialNumber`, item.serialNumber);
      formData.append(`WeaponItems[${index}].BatchNumber`, item.batchNumber);
      formData.append(`WeaponItems[${index}].Status`, item.status.toString());
      if (item.notes) {
        formData.append(`WeaponItems[${index}].Notes`, item.notes);
      }
      if (item.requestItemId != null) {
        formData.append(`WeaponItems[${index}].RequestItemId`, item.requestItemId.toString());
      }
    });
  }
}

export interface ProcessReturnItemsDto {
  ammoExplosiveItems: ReturnAmmoExplosiveItemDto[];
  weaponItems: ReturnWeaponItemDto[];
  /** Completion notes (sent as approval comments on the current step). */
  workflowStepComments?: string;
}

export interface ReturnAmmoExplosiveItemDto {
  itemId: number;
  quantity: number;
  /** Snapshot for audit; omit to default to quantity on the server. */
  returnedQuantity?: number;
  notes?: string;
  requestItemId?: number;
}

export interface ReturnWeaponItemDto {
  itemId: number;
  serialNumber: string;
  batchNumber: string;
  /** Asset status after receipt. */
  status: AssetStatus;
  notes?: string;
  requestItemId?: number;
}

