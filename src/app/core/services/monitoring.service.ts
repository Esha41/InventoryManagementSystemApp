import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  DraftSupplyListItemDto,
  InventoryDashboardSummaryDto,
  InventoryHeadlineMetricsDto,
  OrderAwaitingFulfillmentListItemDto
} from '@models/inventory-dashboard-monitoring.model';

export interface ExpiringLotDto {
  inventoryDetailId: number;
  itemId: number;
  itemName: string;
  itemNo?: string;
  lot: string;
  batchNo?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  remainingQuantity: number;
  depot?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
  supplier?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
  manufacturer?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
}

export interface LowStockItemDto {
  itemId: number;
  itemName: string;
  itemNo?: string;
  nsn?: string;
  minimumQuantity?: number;
  totalStock: number;
  holdQuantity: number;
  suppliedQuantity: number;
  remaining: number;
}

/** Matches backend `PaginatedList<T>` (camelCase JSON). */
export interface PaginatedListDto<T> {
  items: T[];
  pageIndex: number;
  totalPages: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private readonly baseEndpoint = '/Monitoring';

  constructor(private apiService: ApiService) { }

  private buildCountParams(depotId?: number, depotIds?: number[]): HttpParams | undefined {
    if (depotIds && depotIds.length > 0) {
      let p = new HttpParams();
      for (const id of depotIds) {
        p = p.append('depotIds', String(id));
      }
      return p;
    }
    if (depotId != null) {
      return new HttpParams().set('depotId', String(depotId));
    }
    return undefined;
  }

  getExpiringLotsCount(depotId?: number, depotIds?: number[]): Observable<number> {
    return this.apiService.get<number>(`${this.baseEndpoint}/expiring-lots/count`, this.buildCountParams(depotId, depotIds));
  }

  /**
   * Paged expiring lots (same rules as `/expiring-lots/count`). Defaults: page 1, pageSize 10.
   */
  getExpiringLotsPaginated(
    page: number,
    pageSize: number,
    depotId?: number,
    depotIds?: number[]
  ): Observable<PaginatedListDto<ExpiringLotDto>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));
    if (depotIds && depotIds.length > 0) {
      for (const id of depotIds) {
        params = params.append('depotIds', String(id));
      }
    } else if (depotId != null) {
      params = params.set('depotId', String(depotId));
    }
    return this.apiService.get<PaginatedListDto<ExpiringLotDto>>(`${this.baseEndpoint}/expiring-lots`, params);
  }

  getLowStockItemsCount(depotId?: number, depotIds?: number[]): Observable<number> {
    return this.apiService.get<number>(`${this.baseEndpoint}/low-stock/count`, this.buildCountParams(depotId, depotIds));
  }

  /**
   * Paged low-stock rows. Defaults match API (page 1, pageSize 10).
   */
  getLowStockItemsPaginated(
    page: number,
    pageSize: number,
    depotId?: number,
    depotIds?: number[]
  ): Observable<PaginatedListDto<LowStockItemDto>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));
    if (depotIds && depotIds.length > 0) {
      for (const id of depotIds) {
        params = params.append('depotIds', String(id));
      }
    } else if (depotId != null) {
      params = params.set('depotId', String(depotId));
    }
    return this.apiService.get<PaginatedListDto<LowStockItemDto>>(`${this.baseEndpoint}/low-stock`, params);
  }

  getInventoryDashboardSummary(depotIds?: number[]): Observable<InventoryDashboardSummaryDto> {
    let params = '';
    if (depotIds && depotIds.length > 0) {
      params = '?' + depotIds.map(id => `depotIds=${id}`).join('&');
    }
    return this.apiService.get<InventoryDashboardSummaryDto>(`${this.baseEndpoint}/dashboard/inventory-summary${params}`);
  }

  /** Stat-card headline metrics (totals, by-type, low stock, expiring soon). */
  getInventoryHeadlineMetrics(depotIds?: number[]): Observable<InventoryHeadlineMetricsDto> {
    let params = '';
    if (depotIds && depotIds.length > 0) {
      params = '?' + depotIds.map(id => `depotIds=${id}`).join('&');
    }
    return this.apiService.get<InventoryHeadlineMetricsDto>(
      `${this.baseEndpoint}/dashboard/inventory-headline-metrics${params}`
    );
  }

  getDraftSuppliesList(depotIds?: number[]): Observable<DraftSupplyListItemDto[]> {
    let params = '';
    if (depotIds && depotIds.length > 0) {
      params = '?' + depotIds.map(id => `depotIds=${id}`).join('&');
    }
    return this.apiService.get<DraftSupplyListItemDto[]>(`${this.baseEndpoint}/dashboard/draft-supplies${params}`);
  }

  getOrdersAwaitingFulfillmentList(depotIds?: number[]): Observable<OrderAwaitingFulfillmentListItemDto[]> {
    let params = '';
    if (depotIds && depotIds.length > 0) {
      params = '?' + depotIds.map(id => `depotIds=${id}`).join('&');
    }
    return this.apiService.get<OrderAwaitingFulfillmentListItemDto[]>(
      `${this.baseEndpoint}/dashboard/orders-awaiting-fulfillment${params}`
    );
  }
}
