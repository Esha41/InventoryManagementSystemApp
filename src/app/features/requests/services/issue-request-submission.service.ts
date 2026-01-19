import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { OrderSubmissionService, OrderSubmissionData } from '@services/order-submission.service';
import {
  CartridgeState,
  UsageFormData,
  ReviewFormData,
  RequestPurposeState,
  OrderSubmissionState
} from '@requests/pages/new-issue/new-issue-request.state';
import { getDepartmentIdForRequest as getDepartmentIdForRequestUtil } from '@utils/issue-request.utils';

export interface SubmissionDialogConfig {
  title: string;
  message: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  confirmText: string;
  cancelText: string;
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
    private translate: TranslateService
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
}

