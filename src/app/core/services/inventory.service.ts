import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { API_ENDPOINTS } from '@constants/app.constants';
import {
  InventoryDto,
  CreateInventoryDto,
  UpdateInventoryDto,
  InventoryDetailDto,
  ItemInventorySummaryDto
} from '@models/inventory.model';
import { PagedRequest, PaginatedList } from '@models/api-response.model';

/**
 * Warehouse Inventory Service
 * Handles warehouse inventory management operations with the backend
 * Note: In the frontend, we use "warehouse" terminology, but the backend uses "Inventory"
 */
@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly endpoint = API_ENDPOINTS.INVENTORY.BASE;

  constructor(
    private apiService: ApiService,
    private http: HttpClient, // Kept for Blob operations until ApiService supports them
    private config: ConfigService
  ) { }

  /**
   * Get all inventories with details
   */
  getAll(): Observable<InventoryDto[]> {
    this.config.log('Fetching all inventories');
    return this.apiService.get<InventoryDto[]>(this.endpoint);
  }

  /**
   * Get inventory by ID with all details and navigation properties
   */
  getById(id: number): Observable<InventoryDto> {
    this.config.log('Fetching inventory', { id });
    return this.apiService.get<InventoryDto>(`${this.endpoint}/${id}`);
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
   * Get paginated inventory details by depot ID
   */
  getInventoryDetailsPaginated(depotId: number, request: PagedRequest): Observable<PaginatedList<InventoryDetailDto>> {
    this.config.log('Fetching paginated warehouse inventory items', { depotId, page: request.page, pageSize: request.pageSize });
    return this.apiService.post<PaginatedList<InventoryDetailDto>>(`${this.endpoint}/depot/${depotId}/details/search`, request);
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
    return this.apiService.post<InventoryDto>(this.endpoint, dto);
  }

  /**
   * Import inventory from Excel file
   */
  importData(file: File, depotId: number, language: string = 'en'): Observable<APIOperationResponse<any>> {
    this.config.log('Importing inventory from Excel', { fileName: file.name, depotId, language });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('depotId', depotId.toString());

    return this.apiService.postRaw<any>(`${this.endpoint}/Import`, formData, { params: { language } });
  }

  /**
   * Preview inventory import from Excel file (validation only)
   */
  importPreview(file: File, depotId: number, language: string = 'en'): Observable<APIOperationResponse<any>> {
    this.config.log('Previewing inventory import', { fileName: file.name, depotId, language });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('depotId', depotId.toString());

    return this.apiService.postRaw<any>(`${this.endpoint}/ImportPreview`, formData, { params: { language } });
  }

  /**
   * Update an existing inventory and its details
   */
  update(id: number, dto: UpdateInventoryDto): Observable<InventoryDto> {
    this.config.log('Updating inventory', { id });
    return this.apiService.put<InventoryDto>(`${this.endpoint}/${id}`, dto);
  }

  /**
   * Soft delete an inventory
   */
  delete(id: number): Observable<boolean> {
    this.config.log('Deleting inventory', { id });
    return this.apiService.delete<boolean>(`${this.endpoint}/${id}`);
  }

  /**
   * Get ALL lots for a specific item (including expired and empty lots)
   */
  getLotsByItemId(itemId: number): Observable<LotDetailDto[]> {
    this.config.log(`Fetching all lots for item ${itemId}`);
    return this.apiService.get<LotDetailDto[]>(`${this.endpoint}/item/${itemId}/lots`);
  }

  /**
   * Get available lots for a specific item and quantity (FEFO logic, excludes expired and empty lots)
   */
  getAvailableLotsForQuantity(itemId: number, requiredQuantity: number, depotIds?: number[]): Observable<LotDetailDto[]> {
    this.config.log(`Fetching available lots for item ${itemId}, quantity ${requiredQuantity}`);

    let url = `${this.endpoint}/item/${itemId}/available-lots?quantity=${requiredQuantity}`;

    if (depotIds && depotIds.length > 0) {
      depotIds.forEach(depotId => {
        url += `&depotIds=${depotId}`;
      });
    }

    return this.apiService.get<LotDetailDto[]>(url);
  }

  /**
   * Get lot details by lot number
   * Endpoint: GET /api/Inventory/lot/{lotNumber}
   */
  getLotByNumber(lotNumber: number): Observable<LotDetailDto> {
    const url = `${this.endpoint}/lot/${lotNumber}`;
    console.log('getLotByNumber - Making API call to:', url);
    this.config.log(`Fetching lot details for lot ${lotNumber}`);
    return this.apiService.get<LotDetailDto>(url);
  }
  /**
   * Get aggregated inventory summary for a specific item
   * Endpoint: GET /api/Inventory/item/{itemId}/summary
   */
  getItemInventorySummary(itemId: number): Observable<ItemInventorySummaryDto> {
    this.config.log(`Fetching inventory summary for item ${itemId}`);
    return this.apiService.get<ItemInventorySummaryDto>(`${this.endpoint}/item/${itemId}/summary`);
  }

  /**
   * Get aggregated inventory summary for all items
   * Endpoint: GET /api/Inventory/items/summary
   */
  getAllItemsSummary(): Observable<ItemInventorySummaryDto[]> {
    this.config.log('Fetching inventory summary for all items');

    return this.apiService.get<ItemInventorySummaryDto[]>(`${this.endpoint}/items/summary`).pipe(
      map(items => items.map(item => ({
        ...item,
        itemType: typeof item.itemType === 'string'
          ? this.convertItemTypeStringToNumber(item.itemType)
          : item.itemType
      })))
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
   * Note: Using HttpClient directly because ApiService doesn't support 'blob' response type yet
   */
  downloadImportTemplate(depotId: number, language: string = 'en'): Observable<Blob> {
    this.config.log('Downloading inventory import template', { depotId, language });

    return this.http.get(`${this.config.apiUrl}${this.endpoint}/template?depotId=${depotId}&language=${language}`, {
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

