import { Injectable } from '@angular/core';
import { Observable, of, EMPTY } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { OrderService, OrderDto } from './order.service';
import { SupplyService, SupplyDto } from './supply.service';
import { InventoryService, LotDetailDto } from './inventory.service';
import { AmmunitionService } from './ammunition.service';
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { BaseRequestDto, WorkflowApprovalStep } from '@models/workflow-approval.model';
import { OrderRequestItemDto, CreateUpdateRequestItemDto } from './order.service';
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
    private readonly apiService: ApiService,
    private readonly translateService: TranslateService
  ) {}

  /**
   * Load supply data by order ID
   */
  loadSupplyByOrderId(orderId: number): Observable<{
    supply: SupplyDto;
    order: OrderDto;
    orderItems: OrderRequestItemDto[];
    supplyItems: SupplyItemDisplay[];
  }> {
    return this.supplyService.getByOrderId(orderId).pipe(
      map((supply: SupplyDto) => {
        const order = supply.order;
        const orderItems = order?.requestItems || [];
        const supplyItems = mapSupplyDetailsToDisplay(supply);

        return {
          supply,
          order: order!,
          orderItems,
          supplyItems
        };
      }),
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load supply for this order');
        throw new Error(errorMessage);
      })
    );
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
      map((supply: SupplyDto) => {
        const order = supply.order;
        const orderItems = order?.requestItems || [];
        const supplyItems = mapSupplyDetailsToDisplay(supply);

        return {
          supply,
          order: order!,
          orderItems,
          supplyItems
        };
      }),
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
    return this.apiService.getWithAuth<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    ).pipe(
      map((response: any) => {
        const data: BaseRequestDto[] = Array.isArray(response)
          ? response
          : (response?.data || []);

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
   * Load available lots for a specific item and quantity
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
   */
  loadAvailableItems(existingItemIds: number[]): Observable<any[]> {
    return this.ammunitionService.getAll().pipe(
      map((items) => {
        return (items || []).filter(item => !existingItemIds.includes(item.id));
      }),
      catchError(() => {
        throw new Error('Failed to load items');
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
  addOrderItem(orderId: number, item: CreateUpdateRequestItemDto): Observable<APIOperationResponse<number>> {
    return this.orderService.addOrderItem(orderId, item).pipe(
      catchError((error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to add item');
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
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to update item quantity');
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

