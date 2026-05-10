import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, EMPTY } from 'rxjs';
import { map, catchError, expand, reduce } from 'rxjs/operators';
import { ConfigService } from '@services/config.service';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { API_ENDPOINTS, defaultPageSize } from '@constants/app.constants';
import {
  InventoryDto,
  CreateInventoryDto,
  UpdateInventoryDto,
  InventoryDetailDto,
  ItemInventorySummaryDto
} from '@models/inventory.model';
import { PagedRequest, PaginatedList } from '@models/api-response.model';

import { IImportableService } from '@core/interfaces/importable-service.interface';
import { ImportResult } from '@models/import-result.model';

/**
 * Warehouse Inventory Service
 * Handles warehouse inventory management operations with the backend
 * Note: In the frontend, we use "warehouse" terminology, but the backend uses "Inventory"
 */
@Injectable({
  providedIn: 'root'
})
export class InventoryService implements IImportableService {
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
   * Get warehouse inventory details for export (uses paginated endpoint for reliable data)
   * Filters by itemType: 1 = Ammunition, 3 = Explosive
   */
  getWarehouseInventoryDetailsForExport(depotId: number, itemType: 1 | 3): Observable<InventoryDetailDto[]> {
    this.config.log('Fetching warehouse inventory for export', { depotId, itemType });

    const request = {
      page: 1,
      pageSize: 100000,
      filter: {
        logic: 'and' as const,
        filters: [
          { field: 'Item.ItemType', operator: 'eq' as const, value: String(itemType) }
        ]
      }
    };

    return this.apiService.post<PaginatedList<InventoryDetailDto>>(
      `${this.endpoint}/depot/${depotId}/details/search`,
      request
    ).pipe(
      map(response => response?.items ?? [])
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
  create(dto: CreateInventoryDto, files?: File[]): Observable<InventoryDto> {
    this.config.log('Creating inventory', { depoId: dto.depoId });
    const formData = new FormData();
    // Append root-level fields
    Object.entries(dto).forEach(([key, value]) => {
      if (key === 'inventoryDetails') return;
      if (value === null || value === undefined) return;
      if (value instanceof Date) {
        formData.append(key, value.toISOString());
      } else {
        formData.append(key, String(value));
      }
    });
    // Append inventoryDetails as form fields
    dto.inventoryDetails?.forEach((detail, idx) => {
      Object.entries(detail).forEach(([k, v]) => {
        if (v === null || v === undefined) return;
        const field = `inventoryDetails[${idx}].${k}`;
        if (v instanceof Date) {
          formData.append(field, v.toISOString());
        } else {
          formData.append(field, String(v));
        }
      });
    });
    (files || []).forEach(f => formData.append('files', f, f.name));
    return this.apiService.post<InventoryDto>(this.endpoint, formData);
  }

  /**
   * Import inventory from Excel file
   */
  importData(file: File, language: string = 'en', depotId?: number): Observable<APIOperationResponse<ImportResult>> {
    this.config.log('Importing inventory from Excel', { fileName: file.name, depotId, language });

    const formData = new FormData();
    formData.append('file', file);
    if (depotId) {
      formData.append('depotId', depotId.toString());
    }

    return this.apiService.postRaw<ImportResult>(`${this.endpoint}/Import`, formData, { params: { language } });
  }

  /**
   * Preview inventory import from Excel file (validation only)
   */
  importPreview(file: File, language: string = 'en', depotId?: number): Observable<APIOperationResponse<ImportResult>> {
    this.config.log('Previewing inventory import', { fileName: file.name, depotId, language });

    const formData = new FormData();
    formData.append('file', file);
    if (depotId) {
      formData.append('depotId', depotId.toString());
    }

    return this.apiService.postRaw<ImportResult>(`${this.endpoint}/ImportPreview`, formData, { params: { language } });
  }

  /**
   * Update an existing inventory and its details
   * Always sends multipart/form-data to support optional file attachments.
   */
  // Overloads to support existing two-arg callers and new files parameter
  update(id: number, dto: UpdateInventoryDto): Observable<InventoryDto>;
  update(id: number, dto: UpdateInventoryDto, files?: File[], filesItemId?: number): Observable<InventoryDto>;
  update(id: number, dto: UpdateInventoryDto, files?: File[], filesItemId?: number): Observable<InventoryDto> {
    this.config.log('Updating inventory', { id });
    const formData = new FormData();
    // Send the entire DTO as JSON string under 'dto' to match backend [FromForm] binding
    formData.append('dto', JSON.stringify(dto));
    // Append files if any
    (files || []).forEach(f => formData.append('files', f, f.name));
    if (filesItemId) {
      formData.append('filesItemId', String(filesItemId));
    }

    return this.apiService.put<InventoryDto>(`${this.endpoint}/${id}`, formData);
  }

  /**
   * Soft delete an inventory
   */
  delete(id: number): Observable<boolean> {
    this.config.log('Deleting inventory', { id });
    return this.apiService.delete<boolean>(`${this.endpoint}/${id}`);
  }

  /**
   * Get ALL lots for a specific item, optionally filtered to a single depot.
   */
  getLotsByItemId(itemId: number, depotId?: number): Observable<LotDetailDto[]> {
    this.config.log(`Fetching all lots for item ${itemId}`, { depotId });
    const params = depotId ? `?depotId=${depotId}` : '';
    return this.apiService.get<LotDetailDto[]>(`${this.endpoint}/item/${itemId}/lots${params}`);
  }

  /**
   * Get available lots for a specific item and quantity (FEFO logic, excludes expired and empty lots)
   * @param itemId Item ID
   * @param requiredQuantity Required quantity
   * @param depotIds Optional list of depot IDs to filter by
   * @param excludeSupplyId Optional supply ID to exclude from availability calculations (useful when replacing supply details)
   */
  getAvailableLotsForQuantity(itemId: number, requiredQuantity: number, depotIds?: number[], excludeSupplyId?: number): Observable<LotDetailDto[]> {
    this.config.log(`Fetching available lots for item ${itemId}, quantity ${requiredQuantity}`, { excludeSupplyId });

    let url = `${this.endpoint}/item/${itemId}/available-lots?quantity=${requiredQuantity}`;

    if (depotIds && depotIds.length > 0) {
      depotIds.forEach(depotId => {
        url += `&depotIds=${depotId}`;
      });
    }

    if (excludeSupplyId) {
      url += `&excludeSupplyId=${excludeSupplyId}`;
    }

    return this.apiService.get<LotDetailDto[]>(url);
  }

  /**
   * Get lot details by lot number
   * Endpoint: GET /api/Inventory/lot/{lotNumber}
   */
  getLotByNumber(lotNumber: string): Observable<LotDetailDto> {
    const encoded = encodeURIComponent(lotNumber.trim());
    const url = `${this.endpoint}/lot/${encoded}`;
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
   * Full item summary list for all accessible depots (or selected depots), loaded via
   * repeated `POST /api/Inventory/items/summary/paged` requests (same page size) until all pages are merged.
   */
  getAllItemsSummary(
    depotIds?: number[],
    pageSize: number = defaultPageSize
  ): Observable<ItemInventorySummaryDto[]> {
    this.config.log('Fetching inventory summary for all items (paged accumulation)', { depotIds, pageSize });
    const maxPages = 5000;
    const query = !depotIds?.length ? undefined : depotIds.length === 1
      ? { depotId: depotIds[0] }
      : { depotIds };

    const fetchPage = (page: number) =>
      this.getAllItemsSummaryPaginated({ page, pageSize }, query).pipe(
        map(res => ({ res, requestedPage: page }))
      );

    return fetchPage(1).pipe(
      expand(({ res, requestedPage }) => {
        const totalPages = res.totalPages ?? 0;
        if (requestedPage >= totalPages || totalPages === 0 || requestedPage >= maxPages) {
          return EMPTY;
        }
        return fetchPage(requestedPage + 1);
      }),
      reduce<{ res: PaginatedList<ItemInventorySummaryDto>; requestedPage: number }, ItemInventorySummaryDto[]>(
        (acc, { res }) => acc.concat(res.items ?? []),
        []
      )
    );
  }

  /**
   * Paginated aggregated inventory summary (item rows), same depot rules as getAllItemsSummary.
   * Endpoint: POST /api/Inventory/items/summary/paged
   */
  getAllItemsSummaryPaginated(
    request: PagedRequest,
    query?: { depotId?: number; depotIds?: number[]; itemType?: number }
  ): Observable<PaginatedList<ItemInventorySummaryDto>> {
    let httpParams = new HttpParams();
    if (query?.depotId != null) httpParams = httpParams.set('depotId', String(query.depotId));
    if (query?.depotIds?.length) {
      for (const id of query.depotIds) {
        httpParams = httpParams.append('depotIds', String(id));
      }
    }
    if (query?.itemType != null) {
      httpParams = httpParams.set('itemType', String(query.itemType));
    }
    this.config.log('Fetching paginated inventory summary for all items', {
      depotId: query?.depotId,
      depotIds: query?.depotIds,
      itemType: query?.itemType,
      page: request.page
    });
    return this.apiService.post<PaginatedList<ItemInventorySummaryDto>>(
      `${this.endpoint}/items/summary/paged`,
      request,
      { params: httpParams }
    ).pipe(
      map(list => ({
        ...list,
        items: (list?.items ?? []).map(item => ({
          ...item,
          itemType: typeof item.itemType === 'string'
            ? this.convertItemTypeStringToNumber(item.itemType as string)
            : item.itemType
        }))
      }))
    );
  }

  /**
   * Convert itemType string to number
   */
  private convertItemTypeStringToNumber(itemType: string): number {
    const itemTypeMap: { [key: string]: number } = {
      'Ammunition': 1,
      'Weapon': 2,
      'Explosive': 3
    };
    return itemTypeMap[itemType] || 0;
  }

  /**
   * Download inventory import template with data validation (dropdowns for lookups)
   * This template is generated by the backend with Excel data validation
   * Note: Using HttpClient directly because ApiService doesn't support 'blob' response type yet
   */
  generateImportTemplate(language: string = 'en', depotId?: number): Observable<Blob> {
    this.config.log('Downloading inventory import template', { depotId, language });

    return this.http.get(`${this.config.apiUrl}${this.endpoint}/template?depotId=${depotId || ''}&language=${language}`, {
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
  lot: string;
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
  /** Lot-level selected purpose (when returned by API) */
  primaryPurposId?: number;
  primaryPurpos?: {
    id: number;
    nameAr: string;
    nameEn: string;
  };
  /** Catalog purposes for resolving id when navigation is partial */
  item?: {
    primaryPurposes?: Array<{ id: number; nameAr: string; nameEn: string }>;
  };
}

