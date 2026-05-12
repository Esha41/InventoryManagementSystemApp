/**
 * Workflow Approval Data Service
 * Handles all data loading operations for workflow approval detail
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, map, catchError, take } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { SupplyService, SupplyDto } from '@requests/services/supply.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { AssetSupplyService } from '@requests/services/asset-supply.service';
import { BaseRequestDto } from '@models/workflow-approval.model';
import { RequestItemDto } from '@models/request-item.model';
import { RequestTypeEnum } from '@utils/request-mapper.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';

export interface LoadRequestDetailResult {
  baseRequest: BaseRequestDto;
  isWeaponOrder: boolean;
  orderSupplyDate: string | Date | null;
}

export interface WorkflowApprovalStepOption {
  id: number;
  stepOrder: number;
  applicationRoleId: string;
  applicationRoleName?: string;
  applicationRoleNameAr?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowApprovalDataService {
  constructor(
    private apiService: ApiService,
    private supplyService: SupplyService,
    private lookupService: LookupService,
    private assetSupplyService: AssetSupplyService,
    private translateService: TranslateService,
    private toastService: ToastService
  ) { }

  /**
   * Load base request by ID
   */
  loadBaseRequest(requestId: number, destroy$: Subject<void>): Observable<BaseRequestDto> {
    return this.apiService.get<BaseRequestDto>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.BASE_REQUEST_BY_ID(requestId)
    ).pipe(takeUntil(destroy$));
  }

  /**
   * Load request items and merge into base request
   */
  loadRequestItems(baseRequest: BaseRequestDto, requestId: number, destroy$: Subject<void>): Promise<void> {
    return new Promise((resolve) => {
      let endpoint = '';

      const requestTypeValue = baseRequest.requestType;

      if (typeof requestTypeValue === 'number') {
        switch (requestTypeValue) {
          case RequestTypeEnum.Order:
            endpoint = API_ENDPOINTS.ORDERS.BY_ID(requestId);
            break;
          case RequestTypeEnum.Return:
            endpoint = API_ENDPOINTS.RETURNS.BY_ID(requestId);
            break;
          case RequestTypeEnum.Discard:
            endpoint = API_ENDPOINTS.DISCARDS.BY_ID(requestId);
            break;
          default:
            resolve();
            return;
        }
      } else if (typeof requestTypeValue === 'string') {
        const requestTypeLower = requestTypeValue.toLowerCase();
        switch (requestTypeLower) {
          case 'order':
            endpoint = API_ENDPOINTS.ORDERS.BY_ID(requestId);
            break;
          case 'return':
            endpoint = API_ENDPOINTS.RETURNS.BY_ID(requestId);
            break;
          case 'discard':
            endpoint = API_ENDPOINTS.DISCARDS.BY_ID(requestId);
            break;
          default:
            resolve();
            return;
        }
      } else {
        resolve();
        return;
      }

      this.apiService.get<BaseRequestDto>(endpoint)
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: (detailData: BaseRequestDto) => {

            // Merge full details (including usage info) into baseRequest
            if (detailData) {
              Object.assign(baseRequest, detailData);
            }

            const detailRecord = detailData as unknown as Record<string, unknown> | null | undefined;
            const detailItems = detailRecord?.['requestItems'] ?? detailRecord?.['RequestItems'];

            if (Array.isArray(detailItems)) {
              baseRequest.requestItems = detailItems as BaseRequestDto['requestItems'];
            }

            resolve();
          },
          error: () => {
            resolve();
          }
        });
    });
  }

  /**
   * Check if order contains weapon items
   */
  checkIfWeaponOrder(requestItems: RequestItemDto[]): boolean {
    if (!requestItems || requestItems.length === 0) {
      return false;
    }

    return requestItems.every((item: RequestItemDto) => {
      const rawItemType: unknown = item.itemType;
      const normalizedItemType =
        typeof rawItemType === 'number'
          ? rawItemType
          : typeof rawItemType === 'string'
            ? (rawItemType.toLowerCase() === 'weapon' ? 2 : Number(rawItemType))
            : undefined;

      return normalizedItemType === 2;
    });
  }

  /**
   * Extract supply date from order data
   */
  extractSupplyDate(detailData: BaseRequestDto): string | Date | null {
    if (detailData?.supplyDate) {
      return detailData.supplyDate;
    }
    return null;
  }

  /**
   * Load depot selection status for weapon orders.
   * Returns true if at least one depot has been selected and saved.
   */
  loadDepotSelectionStatus(requestId: number, destroy$: Subject<void>): Observable<boolean> {
    return this.assetSupplyService.getWeaponSupplySelection(requestId).pipe(
      takeUntil(destroy$),
      map(selections => Array.isArray(selections) && selections.length > 0),
      catchError(() => of(false))
    );
  }

  /**
   * Load supply data for an order
   */
  loadSupplyData(requestId: number, destroy$: Subject<void>): Observable<SupplyDto | null> {
    return new Observable(observer => {
      this.supplyService.getByOrderId(requestId)
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: (supply: SupplyDto) => {
            observer.next(supply);
            observer.complete();
          },
          error: () => {
            // Supply might not exist yet, which is fine
            observer.next(null);
            observer.complete();
          }
        });
    });
  }

  /**
   * Load ranks for dropdown
   */
  loadRanks(destroy$: Subject<void>): Observable<LookupItem[]> {
    return new Observable(observer => {
      this.lookupService.getLookupItems('Rank')
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: (items: LookupItem[]) => {
            observer.next(items ?? []);
            observer.complete();
          },
          error: () => {
            this.showFailedToLoadRanksToast();
            observer.next([]);
            observer.complete();
          }
        });
    });
  }

  /**
   * Load previous workflow steps for return for review
   */
  loadPreviousWorkflowSteps(requestId: number, destroy$: Subject<void>): Observable<WorkflowApprovalStepOption[]> {
    return new Observable(observer => {
      this.apiService.get<WorkflowApprovalStepOption[]>(
        `${API_ENDPOINTS.WORKFLOW_APPROVAL.BASE}/previous-steps/${requestId}`
      )
        .pipe(takeUntil(destroy$))
        .subscribe({
          next: (response: WorkflowApprovalStepOption[]) => {
            const data = Array.isArray(response) ? response : [];
            observer.next(data);
            observer.complete();
          },
          error: (error: unknown) => {
            const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(
              error,
              'Failed to load previous workflow steps',
              this.translateService
            );
            observer.error(errorMessage);
          }
        });
    });
  }

  private showFailedToLoadRanksToast(): void {
    this.translateService
      .get(['toast.error', 'workflowApprovalDetail.errors.failedToLoadRanks', 'toast.failedToLoadRoles'])
      .pipe(take(1))
      .subscribe(translations => {
        const errorMsg =
          translations['workflowApprovalDetail.errors.failedToLoadRanks'] || translations['toast.failedToLoadRoles'];
        this.toastService.error(errorMsg, translations['toast.error']);
      });
  }
}
