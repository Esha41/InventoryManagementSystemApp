import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';
import {
  WarehouseDto,
  WarehouseSummaryDto,
  CreateWarehouseDto,
  UpdateWarehouseDto
} from '@models/warehouse.model';

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
  getWarehouseById(_id: string): Observable<WarehouseDto> {
    return throwError(() => new Error('Use LookupService.getDepots() instead'));
  }

  /**
   * @deprecated Warehouse management is handled via Lookup API
   */
  createWarehouse(_warehouse: CreateWarehouseDto): Observable<WarehouseDto> {
    return throwError(() => new Error('Warehouse management via Lookup API'));
  }

  /**
   * @deprecated Warehouse management is handled via Lookup API
   */
  updateWarehouse(_id: string, _warehouse: UpdateWarehouseDto): Observable<WarehouseDto> {
    return throwError(() => new Error('Warehouse management via Lookup API'));
  }

  /**
   * @deprecated Warehouse management is handled via Lookup API
   */
  deleteWarehouse(_id: string): Observable<boolean> {
    return throwError(() => new Error('Warehouse management via Lookup API'));
  }

  // Note: Warehouse inventory operations are handled by InventoryService
  // Use inventoryService.getWarehouseInventoryItems() instead
}
