import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { APIOperationResponse } from '@models/api-response.model';

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

  /**
   * Get the count of lots expiring in the next 30 days, optionally scoped to a depot.
   */
  getExpiringLotsCount(depotId?: number): Observable<number> {
    const params = depotId ? `?depotId=${depotId}` : '';
    return this.apiService.get<number>(`${this.baseEndpoint}/expiring-lots/count${params}`);
  }

  /**
   * Get the list of lots that are about to expire in the next 30 days with their details
   */
  getExpiringLots(): Observable<ExpiringLotDto[]> {
    return this.apiService.get<ExpiringLotDto[]>(`${this.baseEndpoint}/expiring-lots`);
  }

  /**
   * Get the count of items below minimum stock level, optionally scoped to a depot.
   */
  getLowStockItemsCount(depotId?: number): Observable<number> {
    const params = depotId ? `?depotId=${depotId}` : '';
    return this.apiService.get<number>(`${this.baseEndpoint}/low-stock/count${params}`);
  }

  /**
   * Get the list of items that are below minimum stock level with their details
   */
  getLowStockItems(): Observable<any[]> {
    return this.apiService.get<any[]>(`${this.baseEndpoint}/low-stock`);
  }
}
