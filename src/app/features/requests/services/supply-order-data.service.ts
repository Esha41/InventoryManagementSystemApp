import { Injectable } from '@angular/core';
import { Observable, of, EMPTY, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { OrderService } from '@services/order.service';
import { OrderDto } from '@models/order.model';
import { SupplyService, SupplyDto } from '@services/supply.service';
import { InventoryService, LotDetailDto } from '@services/inventory.service';
import { AmmunitionService } from '@services/ammunition.service';
import { ExplosiveService } from '@services/explosive.service';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { BaseRequestDto, WorkflowApprovalStep } from '@models/workflow-approval.model';
import { OrderRequestItemDto, CreateRequestItemDto } from '@models/order.model';
import { SupplyItemDisplay, LotItem } from '@models/supply-order.model';
import { mapSupplyDetailsToDisplay } from '@utils/supply-order.mapper';
import { mapLotDetailsToLotItems, formatLocation, determineCondition, calculateDaysUntilExpiry } from '@utils/lot.utils';
import { mapApprovalHistory, mapRequestStatus } from '@utils/request-mapper.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';

/**
 * Supply Order Data Service
 * Handles data loading and business logic for supply order operations
 * Extracted from supply-order.component.ts to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class SupplyOrderDataService {
  constructor(
    private readonly orderService: OrderService,
    private readonly supplyService: SupplyService,
    private readonly inventoryService: InventoryService,
    private readonly ammunitionService: AmmunitionService,
    private readonly explosiveService: ExplosiveService,
    private readonly apiService: ApiService,
    private readonly translateService: TranslateService
  ) { }

  /**
   * Load supply data by order ID
   */
  loadSupplyByOrderId(orderId: number): Observable<{
    supply: SupplyDto;
    order: OrderDto;
    orderItems: OrderRequestItemDto[];
    supplyItems: SupplyItemDisplay[];
  }> {
    return forkJoin({
      supply: this.supplyService.getByOrderId(orderId),
      fullOrder: this.orderService.getOrderById(orderId)
    }).pipe(
      map(({ supply, fullOrder }) => {
        const order = supply.order || fullOrder;

        // Merge full order data (with nested objects) into supply.order if it exists
        if (supply.order && fullOrder) {
          // Copy nested objects from fullOrder
          if (fullOrder.department && !supply.order.department) {
            supply.order.department = fullOrder.department;
          }
          if (fullOrder.requester && !supply.order.requester) {
            supply.order.requester = fullOrder.requester;
          }
          if (fullOrder.requestPurpose && !supply.order.requestPurpose) {
            supply.order.requestPurpose = fullOrder.requestPurpose;
          }

          // Populate flat properties from nested objects
          this.populateOrderFlatProperties(supply.order);
        }

        // Use fullOrder if supply.order is not available
        const finalOrder = supply.order || fullOrder;
        const orderItems = finalOrder?.requestItems || [];
        const supplyItems = mapSupplyDetailsToDisplay(supply, getCurrentLang(this.translateService));

        return {
          supply,
          order: finalOrder!,
          orderItems,
          supplyItems
        };
      }),
      switchMap((result) => this.enrichSupplyItemsWithLotDetails(result.supplyItems).pipe(
        map((enrichedItems) => ({ ...result, supplyItems: enrichedItems }))
      )),
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load supply for this order');
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Enrich supply items with depot name and expiry date from inventory when not provided by API
   */
  private enrichSupplyItemsWithLotDetails(supplyItems: SupplyItemDisplay[]): Observable<SupplyItemDisplay[]> {
    const needsEnrichment = supplyItems.filter((si) => !si.depotName || !si.expiryDate);
    if (needsEnrichment.length === 0) return of(supplyItems);

    const currentLang = getCurrentLang(this.translateService);
    const enrichmentCalls = needsEnrichment.map((si) =>
      this.inventoryService.getLotByNumber(si.lot).pipe(
        map((lot) => {
          if (lot.itemId === si.itemId) {
            const depot = lot.depot;
            const depotName = si.depotName || (depot ? getLocalizedName(depot, currentLang) : undefined);
            const depotNameAr = si.depotNameAr || (depot ? getLocalizedName(depot, 'ar') : undefined);
            const depotNameEn = si.depotNameEn || (depot ? getLocalizedName(depot, 'en') : undefined);
            return { ...si, depotName, depotNameAr, depotNameEn, expiryDate: si.expiryDate || lot.expiryDate };
          }
          return si;
        }),
        catchError(() => of(si))
      )
    );

    return forkJoin(enrichmentCalls).pipe(
      map((enriched) => {
        const enrichedMap = new Map(needsEnrichment.map((si, i) => [si.supplyDetailId, enriched[i]]));
        return supplyItems.map((si) => enrichedMap.get(si.supplyDetailId) || si);
      })
    );
  }

  /**
   * Populate flat properties from nested objects
   * Also handles PascalCase property names from backend
   */
  private populateOrderFlatProperties(order: OrderDto | any): void {
    if (!order) return;

    // Normalize nested object property names (handle both camelCase and PascalCase)
    if ((order as any).Department && !order.department) {
      order.department = (order as any).Department;
    }
    if ((order as any).Requester && !order.requester) {
      order.requester = (order as any).Requester;
    }
    if ((order as any).RequestPurpose && !order.requestPurpose) {
      order.requestPurpose = (order as any).RequestPurpose;
    }

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
   * Load supply data by supply ID
   */
  loadSupplyData(supplyId: number): Observable<{
    supply: SupplyDto;
    order: OrderDto;
    orderItems: OrderRequestItemDto[];
    supplyItems: SupplyItemDisplay[];
  }> {
    return this.supplyService.getById(supplyId).pipe(
      switchMap((supply: SupplyDto) => {
        // Load full order details to get nested objects
        const orderId = supply.orderId;
        if (!orderId) {
          // If no orderId, use supply.order as-is
          const order = supply.order;
          const orderItems = order?.requestItems || [];
          const supplyItems = mapSupplyDetailsToDisplay(supply, getCurrentLang(this.translateService));
          return this.enrichSupplyItemsWithLotDetails(supplyItems).pipe(
            map((enrichedItems) => ({
              supply,
              order: order!,
              orderItems,
              supplyItems: enrichedItems
            }))
          );
        }

        // Load both supply and full order details in parallel
        return forkJoin({
          fullOrder: this.orderService.getOrderById(orderId),
          supplyData: of(supply)
        }).pipe(
          map(({ fullOrder, supplyData }) => {
            const order = supplyData.order || fullOrder;

            // Merge nested objects from fullOrder into supply.order if it exists
            if (supplyData.order && fullOrder) {
              // Copy nested objects from fullOrder
              if (fullOrder.department && !supplyData.order.department) {
                supplyData.order.department = fullOrder.department;
              }
              if (fullOrder.requester && !supplyData.order.requester) {
                supplyData.order.requester = fullOrder.requester;
              }
              if (fullOrder.requestPurpose && !supplyData.order.requestPurpose) {
                supplyData.order.requestPurpose = fullOrder.requestPurpose;
              }

              // Populate flat properties from nested objects
              this.populateOrderFlatProperties(supplyData.order);
            } else if (fullOrder) {
              // Use fullOrder if supply.order is not available
              this.populateOrderFlatProperties(fullOrder);
            }

            const finalOrder = supplyData.order || fullOrder;
            const orderItems = finalOrder?.requestItems || [];
            const supplyItems = mapSupplyDetailsToDisplay(supplyData, getCurrentLang(this.translateService));

            return {
              supply: supplyData,
              order: finalOrder!,
              orderItems,
              supplyItems
            };
          })
        );
      }),
      switchMap((result) => this.enrichSupplyItemsWithLotDetails(result.supplyItems).pipe(
        map((enrichedItems) => ({ ...result, supplyItems: enrichedItems }))
      )),
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load supply order');
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Load full order details (for nested objects like department, requester)
   */
  loadFullOrderDetails(orderId: number): Observable<OrderDto> {
    return this.orderService.getOrderById(orderId).pipe(
      catchError(() => {
        // Return empty on error - this is a fallback call
        console.warn('Failed to load full order details for department/requester info');
        return EMPTY;
      })
    );
  }

  /**
   * Load approval workflow for an order
   */
  loadApprovalWorkflow(orderId: number): Observable<{
    approvalWorkflow: WorkflowApprovalStep[];
    baseRequestData: BaseRequestDto | null;
  }> {
    return this.apiService.get<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    ).pipe(
      map((response: any) => {
        const data: BaseRequestDto[] = Array.isArray(response) ? response : [];

        const baseRequest = data.find(r => r.id === orderId);
        const baseRequestData = baseRequest || null;

        let approvalWorkflow: WorkflowApprovalStep[] = [];
        if (baseRequest && baseRequest.approvalHistory) {
          const requestStatus = mapRequestStatus(baseRequest.status);
          approvalWorkflow = mapApprovalHistory(baseRequest.approvalHistory, requestStatus);
        }

        return {
          approvalWorkflow,
          baseRequestData
        };
      }),
      catchError(() => {
        return of({
          approvalWorkflow: [],
          baseRequestData: null
        });
      })
    );
  }

  /**
   * Load available lots for a specific item and quantity (excludes expired/empty)
   */
  loadAvailableLotsForQuantity(itemId: number, quantity: number): Observable<LotItem[]> {
    return this.inventoryService.getAvailableLotsForQuantity(itemId, quantity).pipe(
      map((lots: LotDetailDto[]) => mapLotDetailsToLotItems(lots)),
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load available lots');
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Load ALL lots for a specific item (including expired and empty lots)
   */
  loadAllLotsForItem(itemId: number): Observable<LotItem[]> {
    return this.inventoryService.getLotsByItemId(itemId).pipe(
      map((lots: LotDetailDto[]) => mapLotDetailsToLotItems(lots, undefined, true)),
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load lots');
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Get lot by number
   */
  getLotByNumber(lotNumber: number): Observable<LotDetailDto> {
    return this.inventoryService.getLotByNumber(lotNumber).pipe(
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Lot not found or error loading details');
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Transform LotDetailDto to LotItem for manual lot entry
   * This handles the transformation logic that was in the component
   */
  transformLotDetailToLotItem(lot: LotDetailDto): LotItem {
    const currentLang = getCurrentLang(this.translateService);

    return {
      inventoryDetailId: lot.inventoryDetailId,
      lotNumber: lot.lot,
      quantity: lot.remainingQuantity,
      expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : undefined,
      location: formatLocation(lot.depot),
      condition: lot.isExpired ? 'Near Expiry' : determineCondition(lot.expiryDate),
      daysUntilExpiry: calculateDaysUntilExpiry(lot.expiryDate),
      selectedQuantity: 0,
      depotName: getLocalizedName(lot.depot, currentLang),
      supplierName: getLocalizedName(lot.supplier, currentLang),
      manufacturerName: getLocalizedName(lot.manufacturer, currentLang)
    };
  }

  /**
   * Load available items (ammunition) excluding already added items
   * @param existingItemIds - IDs of items already in the order
   * @param allowedItemTypes - Optional array of allowed item types to filter by
   *                           1=Ammunition, 2=Weapon, 3=Explosive
   *                           If not provided, all items are returned
   */
  loadAvailableItems(existingItemIds: number[], allowedItemTypes?: number[]): Observable<any[]> {
    const requests: Observable<any[]>[] = [];

    // Map allowed types to service calls (Weapons removed)
    const typeToService = {
      1: () => this.ammunitionService.getAll(), // Ammunition
      3: () => this.explosiveService.getAll()   // Explosive
    };

    if (allowedItemTypes && allowedItemTypes.length > 0) {
      // Fetch only for specified types (excluding Weapons if passed)
      allowedItemTypes.forEach(type => {
        const serviceCall = (typeToService as any)[type];
        if (serviceCall) {
          requests.push(serviceCall().pipe(
            catchError(() => of([])) // Silence errors for specific service and return empty
          ));
        }
      });
    } else {
      // If none specified, fetch Ammunition and Explosives only
      requests.push(this.ammunitionService.getAll().pipe(catchError(() => of([]))));
      requests.push(this.explosiveService.getAll().pipe(catchError(() => of([]))));
    }

    if (requests.length === 0) return of([]);

    return forkJoin(requests).pipe(
      map((results: any[][]) => {
        // Flatten combined results
        const items = results.reduce((acc, val) => acc.concat(val), []);

        // Filter out items already in the order
        return (items || []).filter(item => !existingItemIds.includes(item.id));
      }),
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load items');
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Add supply detail (lot) to supply
   */
  addSupplyDetail(
    supplyId: number,
    detail: { itemId: number; lot: number; quantity: number; notes?: string }
  ): Observable<void> {
    return this.supplyService.addSupplyDetail(supplyId, detail).pipe(
      map(() => void 0),
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to add lot');
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Update supply detail (lot quantity)
   */
  updateSupplyDetail(
    supplyId: number,
    supplyDetailId: number,
    detail: { itemId: number; lot: number; quantity: number; notes?: string }
  ): Observable<void> {
    return this.supplyService.updateSupplyDetail(supplyId, supplyDetailId, detail).pipe(
      map(() => void 0),
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to update item');
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Delete supply detail (lot)
   */
  deleteSupplyDetail(supplyId: number, supplyDetailId: number): Observable<void> {
    return this.supplyService.deleteSupplyDetail(supplyId, supplyDetailId).pipe(
      map(() => void 0),
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to delete item');
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Add order item
   */
  addOrderItem(orderId: number, item: CreateRequestItemDto): Observable<APIOperationResponse<number>> {
    return this.orderService.addOrderItem(orderId, item).pipe(
      catchError((error) => {
        const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(error, 'Failed to add item', this.translateService);
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Update order item quantity
   */
  updateOrderItemQuantity(orderId: number, itemId: number, quantity: number): Observable<APIOperationResponse<boolean>> {
    return this.orderService.updateOrderItemQuantity(orderId, itemId, quantity).pipe(
      catchError((error) => {
        const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(error, 'Failed to update item quantity', this.translateService);
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Delete order item
   */
  deleteOrderItem(orderId: number, itemId: number): Observable<APIOperationResponse<boolean>> {
    return this.orderService.deleteOrderItem(orderId, itemId).pipe(
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to remove item');
        throw new Error(errorMessage);
      })
    );
  }
}

