import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { APIOperationResponse } from '@models/api-response.model';

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
  custodianId?: string;
  notes?: string;
}

export interface CreateAssetSupplyDto {
  orderId: number;
  custodianId?: string;
  receiverName: string;
  receiverMilitaryId: string;
  receiverRankId: number;
  location?: string;
  expectedReturnDate?: string;
  notes?: string;
  supplyDetails: CreateAssetSupplyDetailDto[];
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
   * Get available assets to supply for an order
   * @param orderId The order ID
   * @param depotIds Optional list of depot IDs to filter assets
   */
  getAssetsToSupply(orderId: number, depotIds?: number[]): Observable<OrderAssetsToSupplyDto> {
    this.config.log(`Getting assets to supply for order ${orderId}`, { depotIds });
    
    let endpoint = `${this.baseEndpoint}/order/${orderId}/available-assets`;
    
    // Add depot IDs as query parameters if provided
    if (depotIds && depotIds.length > 0) {
      const params = depotIds.map(id => `depotIds=${id}`).join('&');
      endpoint += `?${params}`;
    }

    return this.apiService.getWithAuth<APIOperationResponse<OrderAssetsToSupplyDto>>(endpoint).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to get assets to supply');
        }
        return response.data;
      }),
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
    
    return this.apiService.postWithAuth<APIOperationResponse<number>>(
      `${this.baseEndpoint}`,
      dto
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to create asset supply');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError('Failed to create asset supply', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get asset supply by order ID
   */
  getByOrderId(orderId: number): Observable<AssetSupplyDto> {
    this.config.log(`Getting asset supply for order ${orderId}`);
    
    return this.apiService.getWithAuth<APIOperationResponse<AssetSupplyDto>>(
      `${this.baseEndpoint}/order/${orderId}`
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Asset supply not found');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError('Failed to get asset supply by order ID', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get asset supply by ID
   */
  getById(id: number): Observable<AssetSupplyDto> {
    this.config.log(`Getting asset supply ${id}`);
    
    return this.apiService.getWithAuth<APIOperationResponse<AssetSupplyDto>>(
      `${this.baseEndpoint}/${id}`
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Asset supply not found');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError('Failed to get asset supply by ID', error);
        return throwError(() => error);
      })
    );
  }
}

