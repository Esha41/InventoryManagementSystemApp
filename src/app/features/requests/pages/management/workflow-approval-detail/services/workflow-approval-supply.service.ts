/**
 * Workflow Approval Supply Service
 * Handles supply-related operations (pickup date, submission, file management)
 */

import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { SupplyService, SubmitSupplyDto, SupplyDto } from '@services/supply.service';
import { ConfigService } from '@services/config.service';
import { FileUploadService } from '@services/file-upload.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { APIOperationResponse } from '@models/api-response.model';
import { validateFile, showFileValidationErrors } from '@utils/file.utils';

export interface ReceiverInfo {
  recieverName: string;
  receiverRankId: number | null;
  recieverMilitaryId: string;
  notes: string;
}

export interface SetPickupDateData {
  requestId: number;
  pickupDate: string;
  isWeaponOrder: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowApprovalSupplyService {
  constructor(
    private apiService: ApiService,
    private http: HttpClient,
    private supplyService: SupplyService,
    private config: ConfigService,
    private fileUploadService: FileUploadService,
    private translateService: TranslateService,
    private toastService: ToastService
  ) { }

  /**
   * Format date to datetime-local input format
   */
  formatDateForInput(date: string | Date | null): string {
    if (!date) return '';

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '';
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Set supply pickup date
   */
  setSupplyPickupDate(
    data: SetPickupDateData,
    destroy$: Subject<void>
  ): Observable<void> {
    return new Observable(observer => {
      // Use Order API for weapon orders, Supply API for non-weapon orders
      const endpoint = data.isWeaponOrder
        ? API_ENDPOINTS.ORDERS.SET_PICKUP_DATE(data.requestId)
        : API_ENDPOINTS.SUPPLY.SET_PICKUP_DATE_BY_ORDER(data.requestId);

      // For weapon orders, use pickupDate format; for supply, use supplyDate
      const payload = data.isWeaponOrder
        ? {
          pickupDate: new Date(data.pickupDate).toISOString()
        }
        : {
          supplyDate: new Date(data.pickupDate).toISOString()
        };

      this.apiService.putWithAuth(endpoint, payload)
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: () => {
            this.translateService.get(['toast.success', 'workflowApprovalDetail.success.pickupDateSet']).subscribe(translations => {
              this.toastService.success(
                translations['workflowApprovalDetail.success.pickupDateSet'] || 'Pickup date set successfully and locked for confirmation',
                translations['toast.success']
              );
            });
            observer.next();
            observer.complete();
          },
          error: (error) => {
            this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.failedToSetPickupDate']).subscribe(translations => {
              const errorMessage = ErrorHandler.extractErrorMessage(error, translations['workflowApprovalDetail.errors.failedToSetPickupDate'] || 'Failed to set pickup date');
              this.toastService.error(errorMessage, translations['toast.error']);
            });
            observer.error(error);
          }
        });
    });
  }

  /**
   * Confirm supply pickup date
   */
  confirmSupplyPickupDate(
    data: SetPickupDateData,
    destroy$: Subject<void>
  ): Observable<void> {
    return new Observable(observer => {
      // Use Order API for weapon orders, Supply API for non-weapon orders
      const endpoint = data.isWeaponOrder
        ? API_ENDPOINTS.ORDERS.SET_PICKUP_DATE(data.requestId)
        : API_ENDPOINTS.SUPPLY.CONFIRM_PICKUP_DATE_BY_ORDER(data.requestId);

      // For weapon orders, use pickupDate format; for supply, use supplyDate
      const payload = data.isWeaponOrder
        ? {
          pickupDate: new Date(data.pickupDate).toISOString()
        }
        : {
          supplyDate: new Date(data.pickupDate).toISOString()
        };

      this.apiService.putWithAuth(endpoint, payload)
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: () => {
            this.translateService.get(['toast.success', 'workflowApprovalDetail.success.pickupDateConfirmed']).subscribe(translations => {
              this.toastService.success(
                translations['workflowApprovalDetail.success.pickupDateConfirmed'] || 'Pickup date confirmed successfully',
                translations['toast.success']
              );
            });
            observer.next();
            observer.complete();
          },
          error: (error) => {
            this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.failedToConfirmPickupDate']).subscribe(translations => {
              const errorMessage = ErrorHandler.extractErrorMessage(error, translations['workflowApprovalDetail.errors.failedToConfirmPickupDate'] || 'Failed to confirm pickup date');
              this.toastService.error(errorMessage, translations['toast.error']);
            });
            observer.error(error);
          }
        });
    });
  }

  /**
   * Submit supply with receiver information
   */
  submitSupply(
    supplyId: number,
    receiverInfo: ReceiverInfo,
    files: File[],
    destroy$: Subject<void>
  ): Observable<void> {
    return new Observable(observer => {
      const submitDto: SubmitSupplyDto = {
        recieverName: receiverInfo.recieverName.trim(),
        receiverRankId: receiverInfo.receiverRankId!,
        recieverMilitaryId: receiverInfo.recieverMilitaryId.trim(),
        notes: receiverInfo.notes?.trim() || undefined
      };

      this.supplyService.submit(supplyId, submitDto, files)
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: () => {
            this.translateService.get(['toast.success', 'workflowApprovalDetail.success.supplySubmitted']).subscribe(translations => {
              this.toastService.success(
                translations['workflowApprovalDetail.success.supplySubmitted'] || 'Supply submitted successfully',
                translations['toast.success']
              );
            });
            observer.next();
            observer.complete();
          },
          error: (error) => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to submit supply');

            this.translateService.get(['toast.error']).subscribe(translations => {
              this.toastService.error(
                errorMessage,
                translations['toast.error'] || 'Error'
              );
            });
            observer.error(error);
          }
        });
    });
  }

  /**
   * Upload additional files to an already-submitted supply
   */
  uploadAdditionalFiles(
    supplyId: number,
    files: File[],
    destroy$: Subject<void>
  ): Observable<number[]> {
    return new Observable(observer => {
      // Create FormData for multipart/form-data request
      const formData = new FormData();

      // Append files
      files.forEach((file) => {
        formData.append('files', file);
      });

      // Auth interceptor handles Authorization header; FormData sets Content-Type automatically
      this.http.post<APIOperationResponse<number[]>>(
        `${this.config.apiUrl}/FileUpload/upload-for-entity?entity=5&entityId=${supplyId}`,
        formData
      )
        .pipe(
          takeUntil(destroy$),
          catchError((error: unknown) => {
            this.config.logError('Failed to upload additional files', error);
            this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileUploadFailed']).subscribe(translations => {
              this.toastService.error(
                ErrorHandler.extractErrorMessage(error, translations['workflowApprovalDetail.errors.fileUploadFailed'] || 'Failed to upload files'),
                translations['toast.error']
              );
            });
            return throwError(() => error);
          })
        )
        .subscribe((response: APIOperationResponse<number[]>) => {
          if (response.succeeded) {
            this.translateService.get(['toast.success', 'workflowApprovalDetail.success.filesUploaded']).subscribe(translations => {
              this.toastService.success(
                translations['workflowApprovalDetail.success.filesUploaded'] || 'Files uploaded successfully',
                translations['toast.success']
              );
            });
            observer.next(response.data || []);
            observer.complete();
          } else {
            this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileUploadFailed']).subscribe(translations => {
              this.toastService.error(
                response.message || translations['workflowApprovalDetail.errors.fileUploadFailed'] || 'Failed to upload files',
                translations['toast.error']
              );
            });
            observer.error(response.message || 'Failed to upload files');
          }
        });
    });
  }

  /**
   * Download a file
   */
  downloadFile(
    fileId: number,
    fileName: string,
    destroy$: Subject<void>
  ): Observable<Blob> {
    return new Observable(observer => {
      const downloadUrl = this.fileUploadService.getFileDownloadUrl(fileId);

      // Auth interceptor handles Authorization header for all HttpClient requests
      this.http.get(downloadUrl, { responseType: 'blob' })
        .pipe(
          takeUntil(destroy$),
          catchError((error: unknown) => {
            this.config.logError('Failed to download file', error);
            this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileDownloadFailed']).subscribe(translations => {
              this.toastService.error(
                ErrorHandler.extractErrorMessage(error, translations['workflowApprovalDetail.errors.fileDownloadFailed'] || 'Failed to download file'),
                translations['toast.error']
              );
            });
            return throwError(() => error);
          })
        )
        .subscribe({
          next: (blob: Blob) => {
            observer.next(blob);
            observer.complete();
          },
          error: (error) => {
            observer.error(error);
          }
        });
    });
  }

  /**
   * Delete a file
   */
  deleteFile(
    fileId: number,
    fileName: string,
    destroy$: Subject<void>
  ): Observable<boolean> {
    return new Observable(observer => {
      // Auth interceptor handles Authorization header for all HttpClient requests
      this.http.delete<APIOperationResponse<boolean>>(`${this.config.apiUrl}/FileUpload/${fileId}`)
        .pipe(
          takeUntil(destroy$),
          catchError((error: unknown) => {
            this.config.logError('Failed to delete file', error);
            this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileDeleteFailed']).subscribe(translations => {
              this.toastService.error(
                ErrorHandler.extractErrorMessage(error, translations['workflowApprovalDetail.errors.fileDeleteFailed'] || 'Failed to delete file'),
                translations['toast.error']
              );
            });
            return throwError(() => error);
          })
        )
        .subscribe((response: APIOperationResponse<boolean>) => {
          if (response.succeeded) {
            this.translateService.get(['toast.success', 'workflowApprovalDetail.success.fileDeleted']).subscribe(translations => {
              this.toastService.success(
                translations['workflowApprovalDetail.success.fileDeleted'] || 'File deleted successfully',
                translations['toast.success']
              );
            });
            observer.next(true);
            observer.complete();
          } else {
            this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileDeleteFailed']).subscribe(translations => {
              this.toastService.error(
                response.message || translations['workflowApprovalDetail.errors.fileDeleteFailed'] || 'Failed to delete file',
                translations['toast.error']
              );
            });
            observer.error(response.message || 'Failed to delete file');
          }
        });
    });
  }

  /**
   * Validate files
   */
  validateFiles(files: File[]): { isValid: boolean; invalidFiles: string[] } {
    const invalidFiles: string[] = [];

    files.forEach(file => {
      const validation = validateFile(file);
      if (!validation.isValid) {
        invalidFiles.push(validation.errorMessage);
      }
    });

    return {
      isValid: invalidFiles.length === 0,
      invalidFiles
    };
  }

  /**
   * Show file validation errors
   */
  showFileValidationErrors(invalidFiles: string[]): void {
    showFileValidationErrors(this.translateService, this.toastService, invalidFiles, 'workflowApprovalDetail');
  }
}
