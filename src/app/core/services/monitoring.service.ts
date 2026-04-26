import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  DraftSupplyListItemDto,
  InventoryDashboardSummaryDto,
  OrderAwaitingFulfillmentListItemDto
} from '@models/inventory-dashboard-monitoring.model';

export interface ExpiringLotDto {
  inventoryDetailId: number;
  itemId: number;
  itemName: string;
  itemNo?: string;
  lot: number;
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

  getExpiringLots(): Observable<ExpiringLotDto[]> {
    return this.apiService.get<ExpiringLotDto[]>(`${this.baseEndpoint}/expiring-lots`);
  }

  getLowStockItemsCount(depotId?: number, depotIds?: number[]): Observable<number> {
    return this.apiService.get<number>(`${this.baseEndpoint}/low-stock/count`, this.buildCountParams(depotId, depotIds));
  }

  getLowStockItems(): Observable<any[]> {
    return this.apiService.get<any[]>(`${this.baseEndpoint}/low-stock`);
  }

  getInventoryDashboardSummary(depotIds?: number[]): Observable<InventoryDashboardSummaryDto> {
    let params = '';
    if (depotIds && depotIds.length > 0) {
      params = '?' + depotIds.map(id => `depotIds=${id}`).join('&');
    }
    return this.apiService.get<InventoryDashboardSummaryDto>(`${this.baseEndpoint}/dashboard/inventory-summary${params}`);
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
