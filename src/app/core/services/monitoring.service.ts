import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PaginatedList, PagedListRequest } from '@models/pagination.model';
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

export interface CriticalStockItemDto {
  itemId: number;
  itemName: string;
  itemNo?: string;
  nsn?: string;
  criticalQuantity?: number;
  totalStock: number;
  holdQuantity: number;
  suppliedQuantity: number;
  remaining: number;
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

  private buildPostOptions(depotId?: number, depotIds?: number[]): { params?: HttpParams } {
    const p = this.buildCountParams(depotId, depotIds);
    return p ? { params: p } : {};
  }

  getExpiringLotsCount(depotId?: number, depotIds?: number[]): Observable<number> {
    return this.apiService.get<number>(`${this.baseEndpoint}/expiring-lots/count`, this.buildCountParams(depotId, depotIds));
  }

  /**
   * POST `Monitoring/expiring-lots/Paginated` — same pattern as `api/Ammunition/Paginated` (body: PagedListRequest).
   */
  getExpiringLotsPaginated(
    request: PagedListRequest,
    depotId?: number,
    depotIds?: number[]
  ): Observable<PaginatedList<ExpiringLotDto>> {
    return this.apiService.post<PaginatedList<ExpiringLotDto>>(
      `${this.baseEndpoint}/expiring-lots/Paginated`,
      request,
      this.buildPostOptions(depotId, depotIds)
    );
  }

  getLowStockItemsCount(depotId?: number, depotIds?: number[]): Observable<number> {
    return this.apiService.get<number>(`${this.baseEndpoint}/low-stock/count`, this.buildCountParams(depotId, depotIds));
  }

  /**
   * POST `Monitoring/low-stock/Paginated` — same pattern as `api/Ammunition/Paginated` (body: PagedListRequest).
   */
  getLowStockItemsPaginated(
    request: PagedListRequest,
    depotId?: number,
    depotIds?: number[]
  ): Observable<PaginatedList<LowStockItemDto>> {
    return this.apiService.post<PaginatedList<LowStockItemDto>>(
      `${this.baseEndpoint}/low-stock/Paginated`,
      request,
      this.buildPostOptions(depotId, depotIds)
    );
  }

  getCriticalStockItemsCount(depotId?: number, depotIds?: number[]): Observable<number> {
    return this.apiService.get<number>(`${this.baseEndpoint}/critical-stock/count`, this.buildCountParams(depotId, depotIds));
  }

  getCriticalStockItems(): Observable<CriticalStockItemDto[]> {
    return this.apiService.get<CriticalStockItemDto[]>(`${this.baseEndpoint}/critical-stock`);
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
