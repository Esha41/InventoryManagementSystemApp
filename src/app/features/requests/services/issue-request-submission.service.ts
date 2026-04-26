import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { OrderSubmissionService, OrderSubmissionData } from '@requests/services/order-submission.service';
import {
  CartridgeState,
  UsageFormData,
  ReviewFormData,
  RequestPurposeState,
  OrderSubmissionState
} from '@requests/pages/new-issue/new-issue-request.state';
import { getDepartmentIdForRequest as getDepartmentIdForRequestUtil } from '@requests/utils/issue-request.utils';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';

export interface SubmissionDialogConfig {
  title: string;
  message: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  confirmText: string;
  cancelText: string;
}

export interface RunSubmissionContext {
  cartridgeState: CartridgeState;
  requestPurposeState: RequestPurposeState;
  usageFormData: UsageFormData;
  reviewFormData: ReviewFormData;
  fromReserve: string;
  currentUserDepartmentId: number | null;
  defaultDepartmentId: number;
  defaultRequestPurposeId: number;
  defaultRequestTypeId: number;
  files: File[] | undefined;
  orderSubmissionState: OrderSubmissionState;
}

export interface RunSubmissionCallbacks {
  onSuccess(orderId: number | null, orderNumber: string | null): void;
  onValidationFailure(message: string): void;
  onTransportError(message: string): void;
}

/**
 * Service responsible for order submission orchestration
 * Extracted from NewIssueRequestComponent to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class IssueRequestSubmissionService {
  constructor(
    private orderSubmissionService: OrderSubmissionService,
    private translate: TranslateService,
    private toastService: ToastService
  ) { }

  /**
   * Builds submission data from component state
   */
  buildSubmissionData(
    cartridgeState: CartridgeState,
    requestPurposeState: RequestPurposeState,
    usageFormData: UsageFormData,
    reviewFormData: ReviewFormData,
    fromReserve: string,
    currentUserDepartmentId: number | null,
    defaultDepartmentId: number,
    defaultRequestPurposeId: number,
    defaultRequestTypeId: number
  ): OrderSubmissionData {
    return {
      selectedEntries: cartridgeState.selectedEntries,
      selectedRequestPurposeId: requestPurposeState.selectedRequestPurposeId,
      usePurpose: usageFormData.usePurpose,
      requestPurposeNotes: usageFormData.requestPurposeNotes,
      usageDateFrom: usageFormData.usageDateFrom,
      usageTimeFrom: usageFormData.usageTimeFrom,
      usageDateTo: usageFormData.usageDateTo,
      usageTimeTo: usageFormData.usageTimeTo,
      usageLocation: usageFormData.usageLocation,
      orderPriority: usageFormData.orderPriority,
      numberOfOfficers: usageFormData.numberOfOfficers,
      numberOfOtherRanks: usageFormData.numberOfOtherRanks,
      requesterComments: reviewFormData.requesterComments,
      fromReserve: fromReserve,
      departmentId: getDepartmentIdForRequestUtil(currentUserDepartmentId, defaultDepartmentId),
      defaultRequestPurposeId: defaultRequestPurposeId,
      defaultRequestTypeId: defaultRequestTypeId,
      orderType: reviewFormData.orderType
    };
  }

  /**
   * Pre-flight validation that mirrors `OrderSubmissionService.validateOrder`
   * but builds the payload from the same component-scoped state objects the
   * `runSubmission` flow expects. Used to block the confirmation dialog when
   * the form is incomplete.
   */
  validateSubmission(ctx: RunSubmissionContext): { isValid: boolean; error?: string } {
    const submissionData = this.buildSubmissionDataFromContext(ctx);
    return this.orderSubmissionService.validateOrder(submissionData);
  }

  /**
   * Loads confirmation dialog translations
   */
  loadConfirmationDialogConfig(): Observable<SubmissionDialogConfig> {
    return this.translate.get([
      'newIssueRequest.confirmDialog.title',
      'newIssueRequest.confirmDialog.message',
      'common.yes',
      'common.cancel'
    ]).pipe(
      map((translations: any) => ({
        title: translations['newIssueRequest.confirmDialog.title'] || 'Confirm Request',
        message: translations['newIssueRequest.confirmDialog.message'] || 'Are you sure you want to submit this order request?',
        type: 'success' as const,
        confirmText: translations['common.yes'] || 'Yes',
        cancelText: translations['common.cancel'] || 'Cancel'
      }))
    );
  }

  /**
   * Submits order and handles response
   */
  submitOrder(
    submissionData: OrderSubmissionData,
    files: File[] | undefined,
    orderSubmissionState: OrderSubmissionState
  ): Observable<any> {
    const payload = this.orderSubmissionService.buildOrderPayload(submissionData);
    orderSubmissionState.submittingOrder = true;
    orderSubmissionState.orderSubmitError = null;

    const filesToUpload = files && files.length > 0 ? files : undefined;

    return this.orderSubmissionService.submitOrder(payload, filesToUpload);
  }

  /**
   * End-to-end submission orchestration: builds payload, validates, submits,
   * and dispatches the outcome through the supplied callbacks. Validation
   * failures bypass the network call. Transport-layer errors and server-
   * reported failures both also fire a localized error toast (matching the
   * exact behaviour the component used to implement inline).
   */
  runSubmission(
    ctx: RunSubmissionContext,
    callbacks: RunSubmissionCallbacks
  ): void {
    const submissionData = this.buildSubmissionData(
      ctx.cartridgeState,
      ctx.requestPurposeState,
      ctx.usageFormData,
      ctx.reviewFormData,
      ctx.fromReserve,
      ctx.currentUserDepartmentId,
      ctx.defaultDepartmentId,
      ctx.defaultRequestPurposeId,
      ctx.defaultRequestTypeId
    );

    const validation = this.orderSubmissionService.validateOrder(submissionData);
    if (!validation.isValid) {
      callbacks.onValidationFailure(validation.error ?? 'Validation failed');
      return;
    }

    this.submitOrder(submissionData, ctx.files, ctx.orderSubmissionState).subscribe({
      next: (result) => {
        ctx.orderSubmissionState.submittingOrder = false;
        if (result.success) {
          callbacks.onSuccess(result.orderId ?? null, result.orderNumber ?? null);
        } else {
          const errorMsg = result.error || 'Failed to submit order. Please try again.';
          this.translate.get('toast.error').subscribe(title => {
            this.toastService.error(errorMsg, title);
          });
          callbacks.onTransportError(errorMsg);
        }
      },
      error: (error) => {
        ctx.orderSubmissionState.submittingOrder = false;
        const errorMsg = ErrorHandler.resolveOrderSubmissionError(undefined, error, 'Failed to submit order');
        this.translate.get('toast.error').subscribe(title => {
          this.toastService.error(errorMsg, title);
        });
        callbacks.onTransportError(errorMsg);
      }
    });
  }

  /**
   * Convenience helper that builds the submission payload directly from a
   * `RunSubmissionContext`. Kept public so callers can validate without
   * triggering submission (currently unused outside `runSubmission`).
   */
  buildSubmissionDataFromContext(ctx: RunSubmissionContext): OrderSubmissionData {
    return this.buildSubmissionData(
      ctx.cartridgeState,
      ctx.requestPurposeState,
      ctx.usageFormData,
      ctx.reviewFormData,
      ctx.fromReserve,
      ctx.currentUserDepartmentId,
      ctx.defaultDepartmentId,
      ctx.defaultRequestPurposeId,
      ctx.defaultRequestTypeId
    );
  }
}

