import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { APIOperationResponse } from '@models/api-response.model';
import { API_ENDPOINTS } from '@constants/app.constants';
import {
  InventoryDto,
  CreateInventoryDto,
  UpdateInventoryDto,
  InventoryDetailDto,
  ItemInventorySummaryDto
} from '@models/inventory.model';

/**
 * Warehouse Inventory Service
 * Handles warehouse inventory management operations with the backend
 * Note: In the frontend, we use "warehouse" terminology, but the backend uses "Inventory"
 */
@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) { }

  private get baseUrl(): string {
    return `${this.config.apiUrl}${API_ENDPOINTS.INVENTORY.BASE}`;
  }

  /**
   * Get all inventories with details
   */
  getAll(): Observable<InventoryDto[]> {
    this.config.log('Fetching all inventories');

    return this.http.get<APIOperationResponse<InventoryDto[]>>(this.baseUrl).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        console.warn('Failed to load inventories:', response.message);
        return [];
      }),
      catchError(err => {
        this.config.logError('Failed to fetch inventories', err);
        throw err;
      })
    );
  }

  /**
   * Get inventory by ID with all details and navigation properties
   */
  getById(id: number): Observable<InventoryDto | null> {
    this.config.log('Fetching inventory', { id });

    return this.http.get<APIOperationResponse<InventoryDto>>(`${this.baseUrl}/${id}`).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        console.warn('Failed to load inventory:', response.message);
        return null;
      }),
      catchError(err => {
        this.config.logError('Failed to fetch inventory', err);
        throw err;
      })
    );
  }

  /**
   * Get inventory details by depot ID
   * This returns all inventory items for a specific depot (warehouse)
   */
  getByDepoId(depoId: number): Observable<InventoryDto[]> {
    this.config.log('Fetching inventories for depot', { depoId });

    return this.getAll().pipe(
      map(inventories => inventories.filter(inv => inv.depoId === depoId))
    );
  }

  /**
   * Get all warehouse inventory items (flattened list)
   * This is the main method used by warehouse-inventory component
   * Returns all items (ammunition, weapons, etc.) in a specific warehouse
   */
  getWarehouseInventoryItems(warehouseId: number): Observable<InventoryDetailDto[]> {
    this.config.log('Fetching warehouse inventory items', { warehouseId });

    return this.getByDepoId(warehouseId).pipe(
      map(inventories => {
        const details: InventoryDetailDto[] = [];
        inventories.forEach(inventory => {
          if (inventory.inventoryDetails) {
            details.push(...inventory.inventoryDetails);
          }
        });
        return details;
      })
    );
  }

  /**
   * @deprecated Use getWarehouseInventoryItems() instead
   * Alias for backward compatibility
   */
  getInventoryDetailsByDepoId(depoId: number): Observable<InventoryDetailDto[]> {
    return this.getWarehouseInventoryItems(depoId);
  }

  /**
   * Create a new inventory with details
   */
  create(dto: CreateInventoryDto): Observable<InventoryDto> {
    this.config.log('Creating inventory', { depoId: dto.depoId });

    return this.http.post<APIOperationResponse<InventoryDto>>(this.baseUrl, dto).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          this.config.log('Inventory created successfully', { id: response.data.id });
          return response.data;
        }
        throw new Error(response.message || 'Failed to create inventory');
      }),
      catchError(err => {
        this.config.logError('Failed to create inventory', err);
        throw err;
      })
    );
  }

  /**
   * Import inventory from Excel file
   */
  importData(file: File, depotId: number): Observable<APIOperationResponse<any>> {
    this.config.log('Importing inventory from Excel', { fileName: file.name, depotId });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('depotId', depotId.toString());

    return this.http.post<APIOperationResponse<any>>(`${this.baseUrl}/Import`, formData).pipe(
      map(response => {
        if (response.succeeded) {
          this.config.log('Inventory import completed', { 
            successCount: response.data?.successCount || 0,
            failureCount: response.data?.failureCount || 0
          });
        }
        return response;
      }),
      catchError(err => {
        this.config.logError('Failed to import inventory', err);
        throw err;
      })
    );
  }
  
  /**
   * Preview inventory import from Excel file (validation only)
   */
  importPreview(file: File, depotId: number): Observable<APIOperationResponse<any>> {
    this.config.log('Previewing inventory import', { fileName: file.name, depotId });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('depotId', depotId.toString());

    return this.http.post<APIOperationResponse<any>>(`${this.baseUrl}/ImportPreview`, formData).pipe(
      map(response => {
        if (response.succeeded) {
          this.config.log('Import preview completed', { 
            successCount: response.data?.successCount || 0,
            failureCount: response.data?.failureCount || 0
          });
        }
        return response;
      }),
      catchError(err => {
        this.config.logError('Failed to preview import', err);
        throw err;
      })
    );
  }

  /**
   * Update an existing inventory and its details
   */
  update(id: number, dto: UpdateInventoryDto): Observable<InventoryDto> {
    this.config.log('Updating inventory', { id });

    return this.http.put<APIOperationResponse<InventoryDto>>(`${this.baseUrl}/${id}`, dto).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          this.config.log('Inventory updated successfully', { id });
          return response.data;
        }
        throw new Error(response.message || 'Failed to update inventory');
      }),
      catchError(err => {
        this.config.logError('Failed to update inventory', err);
        throw err;
      })
    );
  }

  /**
   * Soft delete an inventory
   */
  delete(id: number): Observable<boolean> {
    this.config.log('Deleting inventory', { id });

    return this.http.delete<APIOperationResponse<boolean>>(`${this.baseUrl}/${id}`).pipe(
      map(response => {
        if (response.succeeded) {
          this.config.log('Inventory deleted successfully', { id });
          return true;
        }
        throw new Error(response.message || 'Failed to delete inventory');
      }),
      catchError(err => {
        this.config.logError('Failed to delete inventory', err);
        throw err;
      })
    );
  }

  /**
   * Get ALL lots for a specific item (including expired and empty lots)
   */
  getLotsByItemId(itemId: number): Observable<LotDetailDto[]> {
    this.config.log(`Fetching all lots for item ${itemId}`);

    return this.http.get<APIOperationResponse<LotDetailDto[]>>(
      `${this.baseUrl}/item/${itemId}/lots`
    ).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        console.warn('Failed to load lots:', response.message);
        return [];
      }),
      catchError(err => {
        this.config.logError(`Failed to fetch lots for item ${itemId}`, err);
        throw err;
      })
    );
  }

  /**
   * Get available lots for a specific item and quantity (FEFO logic, excludes expired and empty lots)
   */
  getAvailableLotsForQuantity(itemId: number, requiredQuantity: number, depotIds?: number[]): Observable<LotDetailDto[]> {
    this.config.log(`Fetching available lots for item ${itemId}, quantity ${requiredQuantity}`);

    let url = `${this.baseUrl}/item/${itemId}/available-lots?quantity=${requiredQuantity}`;

    if (depotIds && depotIds.length > 0) {
      depotIds.forEach(depotId => {
        url += `&depotIds=${depotId}`;
      });
    }

    return this.http.get<APIOperationResponse<LotDetailDto[]>>(url).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        console.warn('Failed to load available lots:', response.message);
        return [];
      }),
      catchError(err => {
        this.config.logError(`Failed to fetch available lots for item ${itemId}`, err);
        throw err;
      })
    );
  }

  /**
   * Get lot details by lot number
   * Endpoint: GET /api/Inventory/lot/{lotNumber}
   */
  getLotByNumber(lotNumber: number): Observable<LotDetailDto> {
    const url = `${this.baseUrl}/lot/${lotNumber}`;
    console.log('getLotByNumber - Making API call to:', url);
    this.config.log(`Fetching lot details for lot ${lotNumber}`);

    return this.http.get<APIOperationResponse<LotDetailDto>>(url).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Lot not found');
      }),
      catchError(err => {
        this.config.logError(`Failed to fetch lot ${lotNumber}`, err);
        throw err;
      })
    );
  }
  /**
   * Get aggregated inventory summary for a specific item
   * Endpoint: GET /api/Inventory/item/{itemId}/summary
   */
  getItemInventorySummary(itemId: number): Observable<ItemInventorySummaryDto> {
    this.config.log(`Fetching inventory summary for item ${itemId}`);

    return this.http.get<APIOperationResponse<ItemInventorySummaryDto>>(
      `${this.baseUrl}/item/${itemId}/summary`
    ).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to fetch inventory summary');
      }),
      catchError(err => {
        this.config.logError(`Failed to fetch inventory summary for item ${itemId}`, err);
        throw err;
      })
    );
  }

  /**
   * Get aggregated inventory summary for all items
   * Endpoint: GET /api/Inventory/items/summary
   */
  getAllItemsSummary(): Observable<ItemInventorySummaryDto[]> {
    this.config.log('Fetching inventory summary for all items');

    return this.http.get<APIOperationResponse<ItemInventorySummaryDto[]>>(
      `${this.baseUrl}/items/summary`
    ).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          // Transform itemType from string to number if needed
          return response.data.map(item => ({
            ...item,
            itemType: typeof item.itemType === 'string' 
              ? this.convertItemTypeStringToNumber(item.itemType)
              : item.itemType
          }));
        }
        console.warn('Failed to load items summary:', response.message);
        return [];
      }),
      catchError(err => {
        this.config.logError('Failed to fetch items summary', err);
        throw err;
      })
    );
  }

  /**
   * Convert itemType string to number
   */
  private convertItemTypeStringToNumber(itemType: string): number {
    const itemTypeMap: { [key: string]: number } = {
      'Ammunition': 1,
      'Weapon': 2,
      'Explosive': 3,
      'Accessory': 4
    };
    return itemTypeMap[itemType] || 0;
  }

  /**
   * Download inventory import template with data validation (dropdowns for lookups)
   * This template is generated by the backend with Excel data validation
   */
  downloadImportTemplate(depotId: number): Observable<Blob> {
    this.config.log('Downloading inventory import template', { depotId });

    return this.http.get(`${this.baseUrl}/template?depotId=${depotId}`, {
      responseType: 'blob',
      observe: 'body'
    }).pipe(
      map(blob => {
        this.config.log('Template downloaded successfully', { depotId, size: blob.size });
        return blob;
      }),
      catchError(err => {
        this.config.logError('Failed to download template', err);
        throw err;
      })
    );
  }
}

export interface LotDetailDto {
  inventoryDetailId: number;
  itemId: number;
  itemName: string;
  lot: number;
  originalQuantity: number;
  usedQuantity: number;
  remainingQuantity: number;
  reservedQuantityByOrdersOnProcessing: number;
  isEmptyLot: boolean;
  isExpired: boolean;
  expiryDate?: string;
  batchNo?: string;
  readyForIssue: boolean;
  inventoryId: number;
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
  country?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
}

