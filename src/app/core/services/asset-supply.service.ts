import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';

/**
 * DTOs matching backend structure
 */
export interface AssetToSupplyDto {
  id: number;
  serialNumber: string;
  rfid?: string;
  assetTag?: string;
  condition?: string;
  status?: number;
  purchaseDate?: string;
  depotId: number;
  depot?: {
    id: number;
    nameEn?: string;
    nameAr?: string;
  };
  priority: number;
}

export interface ItemAssetsToSupplyDto {
  itemId: number;
  itemName?: string;
  requestedQuantity: number;
  availableQuantity: number;
  canFulfill: boolean;
  availableAssets: AssetToSupplyDto[];
}

export interface OrderAssetsToSupplyDto {
  orderId: number;
  requestNo?: string;
  departmentName?: string;
  items: ItemAssetsToSupplyDto[];
  canFullyFulfill: boolean;
}

export interface CreateAssetSupplyDetailDto {
  assetId: number;
  conditionOnSupply?: string;
  custodianId?: number;
  notes?: string;
}

export interface CreateAssetSupplyDto {
  orderId: number;
  receiverName: string;
  receiverMilitaryId: string;
  receiverRankId: number;
  location?: string;
  expectedReturnDate?: string;
  notes?: string;
  supplyDetails: CreateAssetSupplyDetailDto[];
}

/** Item info for a batch - which requested item(s) this batch contains */
export interface BatchItemDto {
  itemId: number;
  itemName?: string;
  itemNo?: string;
  quantity: number;
}

/** Depot DTO for localization (nameEn, nameAr, code, etc.) */
export interface DepotDto {
  id: number;
  nameAr: string;
  nameEn: string;
  code?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  isDeleted?: boolean;
}

/** Batch in a depot that contains assets matching the order's requested items */
export interface BatchForOrderDepotDto {
  id: number;
  batchNumber: string;
  quantity: number;
  depotId: number;
  depotName?: string;
  depot?: DepotDto;
  items?: BatchItemDto[];
}

/** DTO for saving per-item batch selections. Each row = one (depot, batch, item, quantity). */
export interface DepotBatchSelectionDto {
  depotId: number;
  batchId: number;
  itemId: number;
  quantity: number;
}

export interface SaveWeaponSupplySelectionDto {
  orderId: number;
  selections: DepotBatchSelectionDto[];
}

export interface AssetSupplyDto {
  id: number;
  orderId: number;
  supplyDate?: string;
  submissionStatus: string;
  fulfillmentStatus: string;
  department?: {
    id: number;
    nameEn?: string;
    nameAr?: string;
  };
  custodian?: {
    id: string;
    userName?: string;
    fullNameEN?: string;
    fullNameAR?: string;
  };
  receiverRank?: {
    id: number;
    nameEn?: string;
    nameAr?: string;
  };
  receiverName?: string;
  receiverMilitaryId?: string;
  location?: string;
  expectedReturnDate?: string;
  notes?: string;
  creationDate: string;
  createdBy?: string;
  supplyDetails?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class AssetSupplyService {
  private readonly baseEndpoint = '/AssetSupply';

  constructor(
    private apiService: ApiService,
    private config: ConfigService
  ) { }

  /**
   * Get batches in the given depots that contain assets matching the order's requested items
   */
  getBatchesForOrderDepots(orderId: number, depotIds: number[]): Observable<BatchForOrderDepotDto[]> {
    this.config.log(`Getting batches for order depots`, { orderId, depotIds });
    const params = depotIds.map(id => `depotIds=${id}`).join('&');
    const endpoint = `${this.baseEndpoint}/order/${orderId}/batches-for-depots?${params}`;
    return this.apiService.get<BatchForOrderDepotDto[]>(endpoint).pipe(
      catchError(error => {
        this.config.logError('Failed to get batches for order depots', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get available assets to supply for an order
   * @param orderId The order ID
   * @param depotIds Optional list of depot IDs to filter assets
   * @param batchIds Optional list of batch IDs to filter assets (when provided, only assets from these batches)
   */
  getAssetsToSupply(orderId: number, depotIds?: number[], batchIds?: number[]): Observable<OrderAssetsToSupplyDto> {
    this.config.log(`Getting assets to supply for order ${orderId}`, { depotIds, batchIds });
    
    const queryParams: string[] = [];
    if (depotIds && depotIds.length > 0) {
      depotIds.forEach(id => queryParams.push(`depotIds=${id}`));
    }
    if (batchIds && batchIds.length > 0) {
      batchIds.forEach(id => queryParams.push(`batchIds=${id}`));
    }
    const endpoint = `${this.baseEndpoint}/order/${orderId}/available-assets${queryParams.length ? '?' + queryParams.join('&') : ''}`;

    return this.apiService.get<OrderAssetsToSupplyDto>(endpoint).pipe(
      catchError(error => {
        this.config.logError('Failed to get assets to supply', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create and submit a new asset supply
   */
  createAndSubmit(dto: CreateAssetSupplyDto): Observable<number> {
    this.config.log('Creating asset supply', dto);
    
    return this.apiService.post<number>(`${this.baseEndpoint}`, dto).pipe(
      catchError(error => {
        this.config.logError('Failed to create asset supply', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get selected batches with their pre-picked assets for weapon supply review.
   * Backend returns batches grouped with assets (serial first, then non-serial).
   */
  getSelectedBatchesWithAssets(orderId: number): Observable<import('@models/batch.model').BatchDto[]> {
    this.config.log(`Getting selected batches with assets for order ${orderId}`);
    return this.apiService.get<import('@models/batch.model').BatchDto[]>(
      `${this.baseEndpoint}/order/${orderId}/selected-batches`
    ).pipe(
      catchError(error => {
        this.config.logError('Failed to get selected batches with assets', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get asset supply by order ID
   */
  getByOrderId(orderId: number): Observable<AssetSupplyDto> {
    this.config.log(`Getting asset supply for order ${orderId}`);
    
    return this.apiService.get<AssetSupplyDto>(`${this.baseEndpoint}/order/${orderId}`).pipe(
      catchError(error => {
        this.config.logError('Failed to get asset supply by order ID', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get saved depot and batch selections for weapon supply.
   */
  getWeaponSupplySelection(orderId: number): Observable<DepotBatchSelectionDto[]> {
    this.config.log('Getting weapon supply selection', { orderId });
    return this.apiService.get<DepotBatchSelectionDto[]>(
      `${this.baseEndpoint}/order/${orderId}/selection`
    ).pipe(
      catchError(error => {
        this.config.logError('Failed to get weapon supply selection', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Save depot and batch selections for weapon supply (replaces existing for the order)
   */
  saveWeaponSupplySelection(orderId: number, selections: DepotBatchSelectionDto[]): Observable<boolean> {
    this.config.log('Saving weapon supply selection', { orderId, selections });
    const dto: SaveWeaponSupplySelectionDto = { orderId, selections };
    return this.apiService.post<boolean>(
      `${this.baseEndpoint}/order/${orderId}/save-selection`,
      dto
    ).pipe(
      catchError(error => {
        this.config.logError('Failed to save weapon supply selection', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get asset supply by ID
   */
  getById(id: number): Observable<AssetSupplyDto> {
    this.config.log(`Getting asset supply ${id}`);
    
    return this.apiService.get<AssetSupplyDto>(`${this.baseEndpoint}/${id}`).pipe(
      catchError(error => {
        this.config.logError('Failed to get asset supply by ID', error);
        return throwError(() => error);
      })
    );
  }
}

