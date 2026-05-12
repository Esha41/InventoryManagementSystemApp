/**
 * Workflow Approval Actions Service
 * Handles approval, rejection, and return for review actions
 */

import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { RequestStatusUpdateService } from '@requests/services/request-status-update.service';
import { RequestStatusEnum } from '@utils/request-mapper.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';

export interface ApprovalFormData {
  requestId: number;
  isApproved: boolean;
  comments?: string;
  sendToHigherApproval?: boolean;
  nextStepId?: number | null;
  files?: File[];
}

export interface ReturnForReviewFormData {
  requestId: number;
  returnToStepId: number;
  comments: string;
  files?: File[];
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowApprovalActionsService {
  constructor(
    private apiService: ApiService,
    private requestStatusUpdateService: RequestStatusUpdateService,
    private translateService: TranslateService,
    private toastService: ToastService
  ) { }

  /**
   * Create FormData for approval/rejection request
   */
  createApprovalFormData(data: ApprovalFormData): FormData {
    const formData = new FormData();

    // Add DTO fields (using PascalCase to match backend DTO)
    formData.append('BaseRequestID', data.requestId.toString());
    formData.append('IsApproved', data.isApproved.toString());
    formData.append('Action', data.isApproved ? RequestStatusEnum.Approved.toString() : RequestStatusEnum.Rejected.toString());

    // Add NextStepId if a transition is selected (for skip-to functionality)
    if (data.isApproved && data.nextStepId != null) {
      formData.append('NextStepId', data.nextStepId.toString());
    }

    if (data.comments) {
      formData.append('Comments', data.comments);
    }

    if (data.sendToHigherApproval === true) {
      formData.append('SendToHigherApproval', 'true');
    }

    // Add files if any (backend expects 'files' parameter)
    if (data.files && data.files.length > 0) {
      data.files.forEach((file) => {
        formData.append('files', file);
      });
    }

    return formData;
  }

  /**
   * Create FormData for return for review
   */
  createReturnForReviewFormData(data: ReturnForReviewFormData): FormData {
    const formData = new FormData();

    // Add DTO fields
    formData.append('BaseRequestID', data.requestId.toString());
    formData.append('IsApproved', 'false');
    formData.append('Action', '6'); // RequestStatus.ReturnedForReview = 6
    formData.append('ReturnToWorkflowStepId', data.returnToStepId.toString());

    // Use the comment from the dialog (required)
    if (data.comments) {
      formData.append('Comments', data.comments);
    }

    // Add files if any
    if (data.files && data.files.length > 0) {
      data.files.forEach((file) => {
        formData.append('files', file);
      });
    }

    return formData;
  }

  /**
   * Build FormData for cancel (RequestStatus.Cancelled = 5).
   */
  createCancelFormData(data: ApprovalFormData): FormData {
    const formData = new FormData();
    formData.append('BaseRequestID', data.requestId.toString());
    formData.append('IsApproved', 'false');
    formData.append('Action', RequestStatusEnum.Cancelled.toString());
    if (data.comments) {
      formData.append('Comments', data.comments);
    }
    if (data.files && data.files.length > 0) {
      data.files.forEach((file) => {
        formData.append('files', file);
      });
    }
    return formData;
  }

  /**
   * Cancel request
   */
  cancelRequest(data: ApprovalFormData, destroy$: Subject<void>): Observable<void> {
    return new Observable(observer => {
      const formData = this.createCancelFormData(data);
      this.apiService.post<void>(
        API_ENDPOINTS.WORKFLOW_APPROVAL.PROCESS_ACTION,
        formData
      )
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: () => {
            this.requestStatusUpdateService.notifyRequestStatusUpdated(data.requestId);
            observer.next();
            observer.complete();
          },
          error: (error) => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to cancel request');
            observer.error(errorMessage);
          }
        });
    });
  }

  /**
   * Approve request
   */
  approveRequest(
    data: ApprovalFormData,
    destroy$: Subject<void>
  ): Observable<void> {
    return new Observable(observer => {
      const formData = this.createApprovalFormData(data);

      this.apiService.post<void>(
        API_ENDPOINTS.WORKFLOW_APPROVAL.PROCESS_ACTION,
        formData
      )
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: () => {
            // Notify other components about the status update
            this.requestStatusUpdateService.notifyRequestStatusUpdated(data.requestId);
            observer.next();
            observer.complete();
          },
          error: (error) => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to approve request');
            observer.error(errorMessage);
          }
        });
    });
  }

  /**
   * Reject request
   */
  rejectRequest(
    data: ApprovalFormData,
    destroy$: Subject<void>
  ): Observable<void> {
    return new Observable(observer => {
      const formData = this.createApprovalFormData(data);

      this.apiService.post<void>(
        API_ENDPOINTS.WORKFLOW_APPROVAL.PROCESS_ACTION,
        formData
      )
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: () => {
            // Notify other components about the status update
            this.requestStatusUpdateService.notifyRequestStatusUpdated(data.requestId);
            observer.next();
            observer.complete();
          },
          error: (error) => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to reject request');
            observer.error(errorMessage);
          }
        });
    });
  }

  /**
   * Return request for review
   */
  returnForReview(
    data: ReturnForReviewFormData,
    destroy$: Subject<void>
  ): Observable<void> {
    return new Observable(observer => {
      const formData = this.createReturnForReviewFormData(data);

      this.apiService.post<void>(
        API_ENDPOINTS.WORKFLOW_APPROVAL.PROCESS_ACTION,
        formData
      )
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: () => {
            // Notify other components about the status update
            this.requestStatusUpdateService.notifyRequestStatusUpdated(data.requestId);
            observer.next();
            observer.complete();
          },
          error: (error) => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to return request for review');
            observer.error(errorMessage);
          }
        });
    });
  }
}
