/**
 * Supply Request Detail Service
 * Handles all business logic for supply request detail page
 */

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, forkJoin } from 'rxjs';
import { switchMap, catchError, tap, delay, map } from 'rxjs/operators';
import { OrderService, OrderDto } from '@services/order.service';
import { SupplyService, OrderSupplySuggestionDto, CreateSupplyDto, CreateSupplyDetailDto, SupplyDto } from '@services/supply.service';
import { InventoryService, LotDetailDto } from '@services/inventory.service';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { BaseRequestDto } from '@models/workflow-approval.model';
import { SupplyRequestDetail, OrderItem } from '@models/supply-request.model';
import { mapOrderToRequestDetail, applySuggestionToItems } from '../../utils/supply-request.mapper';
import { mapLotDetailsToLotItems } from '@utils/lot.utils';
import { mapWorkflowStepsToApprovalSteps } from '@utils/approval-workflow.utils';
import { mapApprovalHistory, mapRequestStatus } from '@utils/request-mapper.utils';
import { ConfigService } from '@services/config.service';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { getCurrentLang } from '@utils/localization.utils';

export interface LoadRequestDetailResult {
  orderData: OrderDto;
  requestDetail: SupplyRequestDetail;
  issueNo: string;
}

export interface LoadSuggestionsResult {
  suggestion: OrderSupplySuggestionDto;
  existingSupply: SupplyDto | null;
}

@Injectable({
  providedIn: 'root'
})
export class SupplyRequestDetailService {
  constructor(
    private orderService: OrderService,
    private supplyService: SupplyService,
    private inventoryService: InventoryService,
    private apiService: ApiService,
    private config: ConfigService,
    private toastService: ToastService,
    private translate: TranslateService,
    private router: Router
  ) { }

  /**
   * Load order details and map to request detail
   */
  loadRequestDetail(orderId: number): Observable<LoadRequestDetailResult> {
    return this.orderService.getOrderById(orderId).pipe(
      map((order: OrderDto) => {
        const issueNo = order.requestNo || order.orderNo || `#${order.id}`;
        const requestDetail = mapOrderToRequestDetail(order);
        return { orderData: order, requestDetail, issueNo };
      })
    );
  }

  /**
   * Load approval history and update request detail
   */
  loadApprovalHistory(orderId: number, requestDetail: SupplyRequestDetail): Observable<SupplyRequestDetail> {
    return this.apiService.getWithAuth<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    ).pipe(
      map((response: any) => {
        const data: BaseRequestDto[] = Array.isArray(response)
          ? response
          : (response?.data || []);

        const baseRequest = data.find(r => r.id === orderId);

        if (baseRequest && baseRequest.approvalHistory) {
          const requestStatus = mapRequestStatus(baseRequest.status);
          const workflowSteps = mapApprovalHistory(baseRequest.approvalHistory, requestStatus);
          requestDetail.approvalWorkflow = mapWorkflowStepsToApprovalSteps(workflowSteps);
        }

        return requestDetail;
      }),
      catchError((error) => {
        this.config.logError('Failed to load approval history', error);
        return of(requestDetail);
      })
    );
  }

  /**
   * Load supply suggestions and check for existing draft supply
   */
  loadSuggestionsWithDraftCheck(orderId: number): Observable<LoadSuggestionsResult> {
    return this.supplyService.checkDraftSupplyExists(orderId).pipe(
      switchMap((existingSupply) => {
        if (existingSupply) {
          return this.supplyService.getById(existingSupply.id).pipe(
            map((supply) => ({
              suggestion: {
                orderId,
                orderNo: '',
                departmentId: 0,
                canFulfillCompletely: false,
                itemSuggestions: [],
                message: 'Draft loaded'
              },
              existingSupply: supply
            }))
          );
        }

        return this.supplyService.getSupplySuggestion(orderId).pipe(
          map((suggestion) => ({ suggestion, existingSupply: null }))
        );
      })
    );
  }

  /**
   * Apply suggestions to request detail
   */
  applySuggestions(requestDetail: SupplyRequestDetail, suggestion: OrderSupplySuggestionDto): void {
    const currentLang = getCurrentLang(this.translate);
    applySuggestionToItems(requestDetail, suggestion, currentLang);
  }

  /**
   * Restore existing selections from draft supply
   */
  restoreExistingSelections(
    requestDetail: SupplyRequestDetail,
    supplyDetails: any[]
  ): { restoredCount: number; notFoundCount: number } {
    if (!requestDetail || !supplyDetails || supplyDetails.length === 0) {
      return { restoredCount: 0, notFoundCount: 0 };
    }

    const selectionsByItemAndLot = new Map<string, number>();
    supplyDetails.forEach(detail => {
      if (detail.itemId && detail.lot && detail.quantity > 0) {
        const key = `${detail.itemId}_${detail.lot}`;
        selectionsByItemAndLot.set(key, detail.quantity);
      }
    });

    let restoredCount = 0;
    let notFoundCount = 0;

    requestDetail.items.forEach(item => {
      if (!item.availableLots || item.availableLots.length === 0) {
        return;
      }

      item.availableLots.forEach(lot => {
        const key = `${item.itemId}_${lot.lotNumber}`;
        const existingQuantity = selectionsByItemAndLot.get(key);
        if (existingQuantity !== undefined) {
          lot.selectedQuantity = existingQuantity;
          restoredCount++;
        }
      });

      item.totalSelectedForDischarge = item.availableLots.reduce(
        (sum, lot) => sum + lot.selectedQuantity,
        0
      );
    });

    selectionsByItemAndLot.forEach((quantity, key) => {
      const [itemId, lotNumber] = key.split('_');
      const item = requestDetail.items.find(i => i.itemId.toString() === itemId);
      if (item) {
        const lot = item.availableLots?.find(l => l.lotNumber.toString() === lotNumber);
        if (!lot) {
          notFoundCount++;
        }
      }
    });

    return { restoredCount, notFoundCount };
  }

  /**
   * Load lots for items with existing selections but no suggestions
   */
  loadLotsForExistingSelections(
    requestDetail: SupplyRequestDetail,
    supplyDetails: any[]
  ): Observable<void> {
    if (!requestDetail || !supplyDetails || supplyDetails.length === 0) {
      return of(undefined);
    }

    const detailsByItem = new Map<number, any[]>();
    supplyDetails.forEach(detail => {
      if (detail.itemId) {
        if (!detailsByItem.has(detail.itemId)) {
          detailsByItem.set(detail.itemId, []);
        }
        detailsByItem.get(detail.itemId)!.push(detail);
      }
    });

    const loadPromises: Observable<any>[] = [];

    detailsByItem.forEach((details, itemId) => {
      const item = requestDetail.items.find(i => i.itemId === itemId);
      if (item) {
        loadPromises.push(
          this.inventoryService.getAvailableLotsForQuantity(itemId, item.approvedQuantity).pipe(
            map((lots) => ({ item, lots, details }))
          )
        );
      }
    });

    if (loadPromises.length === 0) {
      return of(undefined);
    }

    return forkJoin(loadPromises).pipe(
      tap((results) => {
        results.forEach(({ item, lots, details }) => {
          if (!item || !lots || lots.length === 0) {
            return;
          }

          item.availableLots = mapLotDetailsToLotItems(lots);

          const selectionsByLot = new Map<number, number>();
          details.forEach((detail: any) => {
            if (detail.lot && detail.quantity > 0) {
              selectionsByLot.set(detail.lot, detail.quantity);
            }
          });

          item.availableLots.forEach((lot: any) => {
            const selectedQty = selectionsByLot.get(lot.lotNumber);
            if (selectedQty !== undefined) {
              lot.selectedQuantity = selectedQty;
            }
          });

          item.totalSelectedForDischarge = item.availableLots.reduce(
            (sum: number, lot: any) => sum + lot.selectedQuantity,
            0
          );
        });
      }),
      map(() => undefined),
      catchError((error) => {
        this.config.logError('Failed to load lots for existing selections', error);
        return of(undefined);
      })
    );
  }

  /**
   * Load available lots for an item and quantity
   */
  loadAvailableLotsForQuantity(itemId: number, quantity: number): Observable<LotDetailDto[]> {
    return this.inventoryService.getAvailableLotsForQuantity(itemId, quantity);
  }

  /**
   * Get lot by number
   */
  getLotByNumber(lotNumber: number): Observable<LotDetailDto> {
    return this.inventoryService.getLotByNumber(lotNumber);
  }

  /**
   * Process discharge - creates or updates supply record
   */
  processDischarge(
    orderId: number,
    requestDetail: SupplyRequestDetail
  ): Observable<number> {
    return this.supplyService.checkDraftSupplyExists(orderId).pipe(
      switchMap((existingSupply) => {
        if (existingSupply) {
          return this.supplyService.getById(existingSupply.id).pipe(
            switchMap((supply) => this.updateExistingSupply(supply, requestDetail))
          );
        } else {
          return this.createNewSupply(orderId, requestDetail);
        }
      }),
      catchError((error) => {
        const errorMessage = error?.error?.message || error?.message || '';
        if (errorMessage.includes('Draft supply already exists') || errorMessage.includes('already exists for this order')) {
          return this.supplyService.getByOrderId(orderId).pipe(
            switchMap((supply) => this.updateExistingSupply(supply, requestDetail))
          );
        }
        return this.createNewSupply(orderId, requestDetail);
      })
    );
  }

  /**
   * Create new supply from selections
   */
  private createNewSupply(orderId: number, requestDetail: SupplyRequestDetail): Observable<number> {
    const supplyDetails = this.buildSupplyDetails(requestDetail);

    if (supplyDetails.length === 0) {
      const message = this.translate.instant('supplyRequestDetail.noItemsSelectedForDischarge');
      const title = this.translate.instant('toast.error');
      this.toastService.error(message, title);
      throw new Error('No items selected');
    }

    const createSupplyDto: CreateSupplyDto = {
      orderId: orderId,
      supplyDetails: supplyDetails
    };

    return this.supplyService.create(createSupplyDto).pipe(
      tap((supplyId: number) => {
        const message = this.translate.instant('supplyRequestDetail.dischargeProcessedSuccessfully', {
          supplyId: supplyId
        });
        const title = this.translate.instant('toast.success');
        this.toastService.success(message, title);
      }),
      delay(1500),
      tap(() => {
        this.router.navigate(['/requests-management', orderId, 'workflow-approval']);
      })
    );
  }

  /**
   * Update existing draft supply
   */
  private updateExistingSupply(supply: SupplyDto, requestDetail: SupplyRequestDetail): Observable<number> {
    const newSupplyDetails = this.buildSupplyDetails(requestDetail);

    if (newSupplyDetails.length === 0) {
      const message = this.translate.instant('supplyRequestDetail.noItemsSelectedForDischarge');
      const title = this.translate.instant('toast.error');
      this.toastService.error(message, title);
      throw new Error('No items selected');
    }

    return this.supplyService.replaceSupplyDetails(supply.id, newSupplyDetails).pipe(
      tap(() => {
        const message = this.translate.instant('supplyRequestDetail.draftUpdatedSuccessfully', {
          count: newSupplyDetails.length
        });
        const title = this.translate.instant('toast.success');
        this.toastService.success(message, title);
      }),
      delay(1500),
      tap(() => {
        this.router.navigate(['/requests-management', supply.orderId, 'workflow-approval']);
      }),
      map(() => supply.id),
      catchError((error) => {
        this.config.logError('Failed to update existing supply', error);
        const errorMessage = error?.error?.message || error?.message || this.translate.instant('supplyRequestDetail.failedToUpdateDraft');
        const title = this.translate.instant('toast.error');
        this.toastService.error(errorMessage, title);
        throw error;
      })
    );
  }

  /**
   * Build supply details array from request detail selections
   * Consolidates duplicate item+lot combinations by summing quantities
   */
  private buildSupplyDetails(requestDetail: SupplyRequestDetail): CreateSupplyDetailDto[] {
    const supplyDetails: CreateSupplyDetailDto[] = [];

    requestDetail.items.forEach(item => {
      item.availableLots.forEach(lot => {
        if (lot.selectedQuantity > 0) {
          supplyDetails.push({
            itemId: item.itemId,
            lot: lot.lotNumber,
            quantity: lot.selectedQuantity,
            notes: undefined
          });
        }
      });
    });

    // Consolidate duplicates by grouping on itemId+lot and summing quantities
    const consolidatedMap = new Map<string, CreateSupplyDetailDto>();

    supplyDetails.forEach(detail => {
      const key = `${detail.itemId}_${detail.lot}`;
      const existing = consolidatedMap.get(key);

      if (existing) {
        // Sum quantities for duplicate item+lot combinations
        existing.quantity += detail.quantity;
        this.config.log(`Consolidated duplicate lot ${detail.lot} for item ${detail.itemId}: ${existing.quantity}`);
      } else {
        consolidatedMap.set(key, { ...detail });
      }
    });

    const consolidated = Array.from(consolidatedMap.values());

    if (consolidated.length < supplyDetails.length) {
      this.config.log(`Consolidated ${supplyDetails.length} supply details into ${consolidated.length} unique combinations`);
    }

    return consolidated;
  }

  /**
   * Get supply suggestion for order
   */
  getSupplySuggestion(orderId: number): Observable<OrderSupplySuggestionDto> {
    return this.supplyService.getSupplySuggestion(orderId);
  }
}

