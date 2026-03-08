/**
 * Supply Request Detail Service
 * Handles all business logic for supply request detail page
 */

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, forkJoin } from 'rxjs';
import { switchMap, catchError, tap, delay, map } from 'rxjs/operators';
import { OrderService } from '@services/order.service';
import { OrderDto } from '@models/order.model';
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
import { ErrorHandler } from '@utils/error-handler.utils';

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
        // Ensure nested objects and flat properties are populated
        this.populateOrderData(order);

        const issueNo = order.requestNo || order.orderNo || `#${order.id}`;
        const requestDetail = mapOrderToRequestDetail(order);
        return { orderData: order, requestDetail, issueNo };
      })
    );
  }

  /**
   * Populate nested objects and flat properties from nested objects if missing
   */
  private populateOrderData(order: OrderDto): void {
    // Populate department flat properties from nested object if missing
    if (order.department) {
      if (!order.departmentNameEn && order.department.nameEn) {
        order.departmentNameEn = order.department.nameEn;
      }
      if (!order.departmentNameAr && order.department.nameAr) {
        order.departmentNameAr = order.department.nameAr;
      }
    }

    // Populate requester flat properties from nested object if missing
    if (order.requester) {
      if (!order.requesterName) {
        order.requesterName = order.requester.fullNameEN ||
          order.requester.fullNameAR ||
          order.requester.userName;
      }
      if (!order.requesterNameEn && order.requester.fullNameEN) {
        order.requesterNameEn = order.requester.fullNameEN;
      }
      if (!order.requesterNameAr && order.requester.fullNameAR) {
        order.requesterNameAr = order.requester.fullNameAR;
      }
    }

    // Populate requestPurpose flat properties from nested object if missing
    if (order.requestPurpose) {
      if (!order.requestPurposeNameEn && order.requestPurpose.nameEn) {
        order.requestPurposeNameEn = order.requestPurpose.nameEn;
      }
      if (!order.requestPurposeNameAr && order.requestPurpose.nameAr) {
        order.requestPurposeNameAr = order.requestPurpose.nameAr;
      }
    }
  }

  /**
   * Load approval history and update request detail
   */
  loadApprovalHistory(orderId: number, requestDetail: SupplyRequestDetail): Observable<SupplyRequestDetail> {
    return this.apiService.get<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    ).pipe(
      map((response: any) => {
        const data: BaseRequestDto[] = Array.isArray(response) ? response : [];

        const baseRequest = data.find(r => r.id === orderId);

        if (baseRequest && baseRequest.approvalHistory) {
          const requestStatus = mapRequestStatus(baseRequest.status);
          const workflowSteps = mapApprovalHistory(baseRequest.approvalHistory, requestStatus);

          // Add requester as the first step with localized names
          const requesterStep: any = {
            id: 0,
            approverName: baseRequest.requesterName || requestDetail.requesterName || 'Unknown Requester',
            approverNameEn: baseRequest['requesterNameEn'] || requestDetail.requesterName,
            approverNameAr: baseRequest['requesterNameAr'],
            status: 'Approved',
            applicationRoleName: 'Requester (Order Requesting Entity)',
            applicationRoleNameAr: baseRequest['requesterRoleNameAr'],
            approvedDateTime: baseRequest.requestDate || requestDetail.requestDate,
            approvedDate: baseRequest.requestDate || requestDetail.requestDate,
            isPending: false,
            comments: ''
          };

          // Keep WorkflowApprovalStep format to preserve Arabic names
          requestDetail.approvalWorkflow = [requesterStep, ...workflowSteps] as any;
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
   * @param requestDetail Request detail
   * @param supplyDetails Existing supply details
   * @param excludeSupplyId Optional supply ID to exclude from availability calculations (when replacing supply)
   */
  loadLotsForExistingSelections(
    requestDetail: SupplyRequestDetail,
    supplyDetails: any[],
    excludeSupplyId?: number
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
          this.inventoryService.getAvailableLotsForQuantity(itemId, item.approvedQuantity, undefined, excludeSupplyId).pipe(
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
   * @param itemId Item ID
   * @param quantity Required quantity
   * @param excludeSupplyId Optional supply ID to exclude from availability calculations (when replacing supply)
   */
  loadAvailableLotsForQuantity(itemId: number, quantity: number, excludeSupplyId?: number): Observable<LotDetailDto[]> {
    return this.inventoryService.getAvailableLotsForQuantity(itemId, quantity, undefined, excludeSupplyId);
  }

  /**
   * Load ALL lots for an item (including expired and empty lots)
   */
  loadAllLotsForItem(itemId: number): Observable<LotDetailDto[]> {
    return this.inventoryService.getLotsByItemId(itemId);
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
          // If a draft exists, we use the update/replace logic explicitly
          return this.supplyService.getById(existingSupply.id).pipe(
            switchMap((supply) => this.updateExistingSupply(supply, requestDetail))
          );
        } else {
          // No draft exists, call create
          return this.createNewSupply(orderId, requestDetail);
        }
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
          count: supplyDetails.length
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
        const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(error, this.translate.instant('supplyRequestDetail.failedToUpdateDraft'), this.translate);
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

  /**
   * Determine allowed item types based on existing items in the supply request
   * Rules:
   * - If request has only ammunition items, only allow ammunition (type 1)
   * - If request has only explosives, only allow explosives (type 3)
   * - If request has both ammunition and explosives, allow both (types 1 and 3)
   * - If request is empty, default to both (types 1 and 3)
   * Item types: 1=Ammunition, 2=Weapon, 3=Explosive
   */
  getAllowedItemTypes(orderData: OrderDto | null, requestDetail: SupplyRequestDetail | null): number[] {
    // Helper function to convert itemType (string or number) to numeric type
    const normalizeItemType = (itemType: number | string | undefined): number | null => {
      if (!itemType) return null;

      if (typeof itemType === 'number') {
        return itemType;
      }

      // Convert string to number (case-insensitive)
      const itemTypeMap: { [key: string]: number } = {
        'Ammunition': 1,
        'ammunition': 1,
        'Weapon': 2,
        'weapon': 2,
        'Explosive': 3,
        'explosive': 3
      };

      return itemTypeMap[itemType] || null;
    };

    const existingTypes = new Set<number>();

    // First, try to get item types from orderData.requestItems
    if (orderData?.requestItems && orderData.requestItems.length > 0) {
      orderData.requestItems.forEach(item => {
        const numericType = normalizeItemType(item.itemType);
        if (numericType) {
          existingTypes.add(numericType);
        }
      });
    }

    // Also check requestDetail.items (has string itemType) - don't skip if orderData has items
    // because requestDetail might have more accurate data
    if (requestDetail?.items && requestDetail.items.length > 0) {
      requestDetail.items.forEach(item => {
        const numericType = normalizeItemType(item.itemType);
        if (numericType) {
          existingTypes.add(numericType);
        }
      });
    }

    // Determine allowed types based on what exists
    if (existingTypes.size === 0) {
      // Empty request - default to both ammunition and explosives
      return [1, 3];
    }

    // If only ammunition exists, return only ammunition
    if (existingTypes.size === 1 && existingTypes.has(1)) {
      return [1];
    }

    // If only explosives exists, return only explosives
    if (existingTypes.size === 1 && existingTypes.has(3)) {
      return [3];
    }

    // If both ammunition and explosives exist, return both
    if (existingTypes.has(1) && existingTypes.has(3)) {
      return [1, 3];
    }

    // If only ammunition or explosives (but not both), return what exists
    if (existingTypes.has(1)) {
      return [1];
    }
    if (existingTypes.has(3)) {
      return [3];
    }

    // Default fallback
    return [1, 3];
  }
}

