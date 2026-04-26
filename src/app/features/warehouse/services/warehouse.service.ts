import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { 
  WarehouseDto, 
  WarehouseSummaryDto, 
  CreateWarehouseDto, 
  UpdateWarehouseDto,
  WarehouseLocationDto
} from '@models/warehouse.model';
import {
  WarehouseInventoryItem,
  WarehouseInventoryResponse,
  WarehouseInventoryRequest,
  WarehouseInventorySummary
} from '@models/warehouse-inventory.model';
import { ApiResponse } from '@models/api-response.model';

/**
 * Warehouse Service
 * Handles all warehouse management operations with the backend
 */
@Injectable({
  providedIn: 'root'
})
export class WarehouseService {
  private warehousesSubject = new BehaviorSubject<WarehouseDto[]>([]);
  public warehouses$ = this.warehousesSubject.asObservable();

  private warehouseSummarySubject = new BehaviorSubject<WarehouseSummaryDto[]>([]);
  public warehouseSummary$ = this.warehouseSummarySubject.asObservable();

  constructor(
    private apiService: ApiService,
    private configService: ConfigService
  ) {}

  // ==================== WAREHOUSE MANAGEMENT ====================
  // Note: Warehouses are actually "Depots" in the backend
  // Use LookupService.getDepots() instead of this service
  // This service is kept for backward compatibility but should be deprecated

  /**
   * @deprecated Use LookupService.getDepots() instead
   * Warehouses are managed as Depots via the Lookup API
   */
  getWarehouses(): Observable<WarehouseDto[]> {
    // This method references non-existent endpoints
    // Warehouse management should use LookupService
    return throwError(() => new Error('Use LookupService.getDepots() instead'));
  }

  /**
   * @deprecated Use LookupService.getDepots() instead
   */
  getWarehouseSummary(): Observable<WarehouseSummaryDto[]> {
    return throwError(() => new Error('Use LookupService.getDepots() instead'));
  }

  /**
   * @deprecated Use LookupService.getDepots() instead
   */
  getWarehouseById(id: string): Observable<WarehouseDto> {
    return throwError(() => new Error('Use LookupService.getDepots() instead'));
  }

  /**
   * @deprecated Warehouse management is handled via Lookup API
   */
  createWarehouse(warehouse: CreateWarehouseDto): Observable<WarehouseDto> {
    return throwError(() => new Error('Warehouse management via Lookup API'));
  }

  /**
   * @deprecated Warehouse management is handled via Lookup API
   */
  updateWarehouse(id: string, warehouse: UpdateWarehouseDto): Observable<WarehouseDto> {
    return throwError(() => new Error('Warehouse management via Lookup API'));
  }

  /**
   * @deprecated Warehouse management is handled via Lookup API
   */
  deleteWarehouse(id: string): Observable<boolean> {
    return throwError(() => new Error('Warehouse management via Lookup API'));
  }

  // Note: Warehouse inventory operations are handled by InventoryService
  // Use inventoryService.getWarehouseInventoryItems() instead
}
