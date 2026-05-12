import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { OrderSubmissionService, OrderSubmissionData } from '@requests/services/order-submission.service';
import {
  CartridgeState,
  UsageFormData,
  ReviewFormData,
  RequestPurposeState,
  OrderSubmissionState,
  RequestPurposeDto
} from '../new-issue-request.state';
import type { WeaponAssociation } from '@models/request-item.model';
import { getDepartmentIdForRequest as getDepartmentIdForRequestUtil } from '@requests/utils/issue-request.utils';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { normalizeArrayResponse } from '@utils/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
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
  weaponAssociations: Map<number, WeaponAssociation[]>;
}

export interface RunSubmissionCallbacks {
  onSuccess(orderId: number | null, orderNumber: string | null): void;
  onValidationFailure(message: string): void;
  onTransportError(message: string): void;
}

/**
 * Handles all data loading and order submission for the new-issue-request flow.
 * Merged from IssueRequestDataService + IssueRequestSubmissionService.
 */
@Injectable({ providedIn: 'root' })
export class IssueRequestSubmissionService {
  constructor(
    private apiService: ApiService,
    private orderSubmissionService: OrderSubmissionService,
    private translate: TranslateService,
    private toastService: ToastService
  ) {}

  // ---- Data loading (merged from IssueRequestDataService) -----------------

  loadRequestPurposes(): Observable<RequestPurposeDto[]> {
    return this.apiService
      .get<RequestPurposeDto[]>(API_ENDPOINTS.REQUEST_PURPOSES.FOR_ORDER)
      .pipe(map(data => normalizeArrayResponse<RequestPurposeDto>(data)));
  }

  rebuildRequestPurposeOptions(requestPurposeState: RequestPurposeState): Map<number, { usePurpose: string }> {
    const currentLang = getCurrentLang(this.translate);
    const optionsMap = new Map<number, { usePurpose: string }>();

    requestPurposeState.requestPurposeOptions = requestPurposeState.requestPurposesSource.map(p => ({
      label: getLocalizedName(p, currentLang),
      value: p.id
    }));

    requestPurposeState.requestPurposesSource.forEach(p => {
      optionsMap.set(p.id, { usePurpose: getLocalizedName(p, currentLang) });
    });

    return optionsMap;
  }

  updateUsePurposeFromSelection(
    id: number | null,
    optionsMap: Map<number, { usePurpose: string }>,
    usageFormData: { usePurpose: string }
  ): void {
    if (id && optionsMap.has(id)) {
      usageFormData.usePurpose = optionsMap.get(id)?.usePurpose || '';
    }
  }

  // ---- Submission ---------------------------------------------------------

  validateSubmission(ctx: RunSubmissionContext): { isValid: boolean; error?: string } {
    const ammoIds = ctx.cartridgeState.selectedEntries
      .filter(e => e.itemType === 'Ammunition')
      .map(e => e.id);

    const missingAssociation = ammoIds.some(id => {
      const list = ctx.weaponAssociations.get(id);
      if (!list?.length) return true;
      return !list.every(row =>
        (row.type === 'catalog' && !!row.weaponItemId) ||
        (row.type === 'other' && !!row.otherName?.trim())
      );
    });

    if (missingAssociation) {
      return { isValid: false, error: 'newIssueRequest.validation.ammoMustHaveWeapon' };
    }

    return this.orderSubmissionService.validateOrder(this.buildSubmissionDataFromContext(ctx));
  }

  loadConfirmationDialogConfig(): Observable<{ title: string; message: string; type: 'success'; confirmText: string; cancelText: string }> {
    return this.translate.get([
      'newIssueRequest.confirmDialog.title',
      'newIssueRequest.confirmDialog.message',
      'common.yes',
      'common.cancel'
    ]).pipe(
      map((t: Record<string, string>) => ({
        title: t['newIssueRequest.confirmDialog.title'] || 'Confirm Request',
        message: t['newIssueRequest.confirmDialog.message'] || 'Are you sure you want to submit this order request?',
        type: 'success' as const,
        confirmText: t['common.yes'] || 'Yes',
        cancelText: t['common.cancel'] || 'Cancel'
      }))
    );
  }

  runSubmission(ctx: RunSubmissionContext, callbacks: RunSubmissionCallbacks): void {
    const validation = this.validateSubmission(ctx);
    if (!validation.isValid) {
      callbacks.onValidationFailure(validation.error ?? 'Validation failed');
      return;
    }

    const submissionData = this.buildSubmissionDataFromContext(ctx);
    const payload = this.orderSubmissionService.buildOrderPayload(submissionData);
    ctx.orderSubmissionState.submittingOrder = true;
    ctx.orderSubmissionState.orderSubmitError = null;
    const files = ctx.files && ctx.files.length > 0 ? ctx.files : undefined;

    this.orderSubmissionService.submitOrder(payload, files).subscribe({
      next: (result) => {
        ctx.orderSubmissionState.submittingOrder = false;
        if (result.success) {
          callbacks.onSuccess(result.orderId ?? null, result.orderNumber ?? null);
        } else {
          const msg = result.error || 'Failed to submit order. Please try again.';
          this.showTranslatedTitleErrorToast(msg);
          callbacks.onTransportError(msg);
        }
      },
      error: (error: unknown) => {
        ctx.orderSubmissionState.submittingOrder = false;
        const msg = ErrorHandler.resolveOrderSubmissionError(undefined, error, 'Failed to submit order');
        this.showTranslatedTitleErrorToast(msg);
        callbacks.onTransportError(msg);
      }
    });
  }

  private showTranslatedTitleErrorToast(body: string): void {
    this.translate
      .get('toast.error')
      .pipe(take(1))
      .subscribe(title => this.toastService.error(body, title));
  }

  private buildSubmissionDataFromContext(ctx: RunSubmissionContext): OrderSubmissionData {
    return {
      selectedEntries: ctx.cartridgeState.selectedEntries,
      selectedRequestPurposeId: ctx.requestPurposeState.selectedRequestPurposeId,
      usePurpose: ctx.usageFormData.usePurpose,
      requestPurposeNotes: ctx.usageFormData.requestPurposeNotes,
      usageDateFrom: ctx.usageFormData.usageDateFrom,
      usageTimeFrom: ctx.usageFormData.usageTimeFrom,
      usageDateTo: ctx.usageFormData.usageDateTo,
      usageTimeTo: ctx.usageFormData.usageTimeTo,
      usageLocation: ctx.usageFormData.usageLocation,
      numberOfOfficers: ctx.usageFormData.numberOfOfficers,
      numberOfOtherRanks: ctx.usageFormData.numberOfOtherRanks,
      requesterComments: ctx.reviewFormData.requesterComments,
      fromReserve: ctx.fromReserve,
      departmentId: getDepartmentIdForRequestUtil(ctx.currentUserDepartmentId, ctx.defaultDepartmentId),
      defaultRequestPurposeId: ctx.defaultRequestPurposeId,
      defaultRequestTypeId: ctx.defaultRequestTypeId,
      orderType: ctx.reviewFormData.orderType,
      weaponAssociations: ctx.weaponAssociations
    };
  }
}
