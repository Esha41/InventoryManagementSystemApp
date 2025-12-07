import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';
import { APIOperationResponse } from '@models/api-response.model';

// ==================== Supply DTOs ====================


export interface SupplyLotSuggestionDto {
  inventoryDetailId: number;
  itemId: number;
  itemName: string;
  lot: number;
  availableQuantity: number;
  suggestedQuantity: number;
  expiryDate?: string;
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
}

export interface OrderItemSupplySuggestionDto {
  requestItemId: number;
  itemId: number;
  itemName: string;
  requestedQuantity: number;
  suggestedQuantity: number;
  canFulfillCompletely: boolean;
  lotSuggestions: SupplyLotSuggestionDto[];
}

export interface OrderSupplySuggestionDto {
  orderId: number;
  orderNo: string;
  departmentId: number;
  canFulfillCompletely: boolean;
  itemSuggestions: OrderItemSupplySuggestionDto[];
  message: string;
}

export interface CreateSupplyDetailDto {
  itemId: number;
  lot: number;
  quantity: number;
  notes?: string;
}

export interface CreateSupplyDto {
  orderId: number;
  supplyDetails: CreateSupplyDetailDto[];
}

export interface UpdateSupplyDto {
  recieverName: string;
  receiverRankId: number;
  recieverMilitaryId: string;
  notes?: string;
}

export interface SubmitSupplyDto {
  recieverName: string;
  receiverRankId: number;
  recieverMilitaryId: string;
  notes?: string;
}

export interface UpdateSupplyDetailDto {
  itemId: number;
  lot: number;
  quantity: number;
  notes?: string;
}

export interface SupplyDetailDto {
  id: number;
  supplyId: number;
  itemId: number;
  lot: number;
  quantity: number;
  notes?: string;
  requestedQuantity: number;
  totalSuppliedQuantity: number;
  isFullyFulfilled: boolean;
  item?: {
    id: number;
    name?: string; // BaseItemDto uses 'name' not 'nameEn/nameAr'
    itemNo?: string;
    itemType?: number;
    batchNo?: string;
  };
}

export interface FileUploadDto {
  id: number;
  fileUrl: string;
  fileName: string;
  originalName: string;
  isMain: boolean;
  entity: number;
  entityId: number;
}

export interface SupplyDto {
  id: number;
  orderId: number;
  supplyDate?: string;
  recieverName?: string;
  receiverRankId?: number;
  recieverMilitaryId?: string;
  submissionStatus: number; // SupplySubmissionStatus enum
  fulfillmentStatus: number; // SupplyFulfillmentStatus enum
  notes?: string;
  order?: any;
  receiverRank?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
  supplyDetails: SupplyDetailDto[];
  files?: FileUploadDto[];
}

// ==================== Service ====================

@Injectable({ providedIn: 'root' })
export class SupplyService {
  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private apiService: ApiService
  ) {}

  private get baseUrl(): string {
    return `${this.config.apiUrl}/Supply`;
  }

  /**
   * Get supply suggestion for an order based on FEFO (First Expiry First Out) logic
   * @param orderId Order ID
   * @param depotIds Optional list of depot IDs to filter suggestions
   */
  getSupplySuggestion(orderId: number, depotIds?: number[]): Observable<OrderSupplySuggestionDto> {
    this.config.log(`Fetching supply suggestion for order ${orderId}`, { depotIds });
    
    let params = new HttpParams();
    if (depotIds && depotIds.length > 0) {
      depotIds.forEach(id => {
        params = params.append('depotIds', id.toString());
      });
    }

    return this.http.get<APIOperationResponse<OrderSupplySuggestionDto>>(
      `${this.baseUrl}/suggestion/${orderId}`,
      { params }
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to fetch supply suggestion');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError(`Failed to fetch supply suggestion for order ${orderId}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get supply by ID with all details
   * @param id Supply ID
   */
  getById(id: number): Observable<SupplyDto> {
    this.config.log(`Fetching supply ${id}`);
    return this.http.get<APIOperationResponse<SupplyDto>>(`${this.baseUrl}/${id}`).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to fetch supply details');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError(`Failed to fetch supply ${id}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all supplies with details
   */
  getAll(): Observable<SupplyDto[]> {
    this.config.log('Fetching all supplies');
    return this.http.get<APIOperationResponse<SupplyDto[]>>(this.baseUrl).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch supplies');
        }
        return response.data ?? [];
      }),
      catchError(error => {
        this.config.logError('Failed to fetch supplies', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get supply by Order ID
   * @param orderId Order ID
   */
  getByOrderId(orderId: number): Observable<SupplyDto> {
    this.config.log(`Fetching supply for order ${orderId}`);
    return this.http.get<APIOperationResponse<SupplyDto>>(
      `${this.baseUrl}/${orderId}/getByOrderId`
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to fetch supply for order');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError(`Failed to fetch supply for order ${orderId}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if a draft supply exists for an order
   * @param orderId Order ID
   */
  checkDraftSupplyExists(orderId: number): Observable<SupplyDto | null> {
    this.config.log(`Checking for draft supply for order ${orderId}`);
    return this.getAll().pipe(
      map(supplies => {
        // Find draft supply for this order (SupplySubmissionStatus: Draft = 1, Submitted = 2)
        const draftSupply = supplies.find(s => s.orderId === orderId && s.submissionStatus === 1);
        return draftSupply || null;
      }),
      catchError(error => {
        this.config.logError(`Failed to check draft supply for order ${orderId}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a new supply with draft status
   * @param dto Supply creation data
   * @returns Created supply ID
   */
  create(dto: CreateSupplyDto): Observable<number> {
    this.config.log('Creating supply', dto);
    return this.http.post<APIOperationResponse<number>>(this.baseUrl, dto).pipe(
      map(response => {
        if (!response.succeeded || response.data === undefined) {
          throw new Error(response.message || 'Failed to create supply');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError('Failed to create supply', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update supply information (receiver info, notes, etc.)
   * @param id Supply ID
   * @param dto Supply update data
   */
  updateSupplyInfo(id: number, dto: UpdateSupplyDto): Observable<boolean> {
    this.config.log(`Updating supply ${id}`, dto);
    return this.http.put<APIOperationResponse<boolean>>(`${this.baseUrl}/${id}`, dto).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to update supply');
        }
        return response.data ?? false;
      }),
      catchError(error => {
        this.config.logError(`Failed to update supply ${id}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Add a new supply detail to an existing supply
   * @param supplyId Supply ID
   * @param detailDto Supply detail data
   * @returns Created detail ID
   */
  addSupplyDetail(supplyId: number, detailDto: CreateSupplyDetailDto): Observable<number> {
    this.config.log(`Adding detail to supply ${supplyId}`, detailDto);
    return this.http.post<APIOperationResponse<number>>(
      `${this.baseUrl}/${supplyId}/details`,
      detailDto
    ).pipe(
      map(response => {
        if (!response.succeeded || response.data === undefined) {
          throw new Error(response.message || 'Failed to add supply detail');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError(`Failed to add detail to supply ${supplyId}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update an existing supply detail
   * @param supplyId Supply ID
   * @param detailId Supply Detail ID
   * @param detailDto Supply detail update data
   */
  updateSupplyDetail(supplyId: number, detailId: number, detailDto: UpdateSupplyDetailDto): Observable<boolean> {
    this.config.log(`Updating detail ${detailId} in supply ${supplyId}`, detailDto);
    return this.http.put<APIOperationResponse<boolean>>(
      `${this.baseUrl}/${supplyId}/details/${detailId}`,
      detailDto
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to update supply detail');
        }
        return response.data ?? false;
      }),
      catchError(error => {
        this.config.logError(`Failed to update detail ${detailId} in supply ${supplyId}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a supply detail
   * @param supplyId Supply ID
   * @param detailId Supply Detail ID
   */
  deleteSupplyDetail(supplyId: number, detailId: number): Observable<boolean> {
    this.config.log(`Deleting detail ${detailId} from supply ${supplyId}`);
    return this.http.delete<APIOperationResponse<boolean>>(
      `${this.baseUrl}/${supplyId}/details/${detailId}`
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to delete supply detail');
        }
        return response.data ?? false;
      }),
      catchError(error => {
        this.config.logError(`Failed to delete detail ${detailId} from supply ${supplyId}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Replace all supply details with new ones in a single atomic operation
   * This avoids the "cannot delete last detail" constraint
   * @param supplyId Supply ID
   * @param details List of new supply details
   */
  replaceSupplyDetails(supplyId: number, details: CreateSupplyDetailDto[]): Observable<boolean> {
    this.config.log(`Replacing all details in supply ${supplyId}`, { detailCount: details.length });
    return this.http.put<APIOperationResponse<boolean>>(
      `${this.baseUrl}/${supplyId}/details`,
      details
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to replace supply details');
        }
        return response.data ?? false;
      }),
      catchError(error => {
        this.config.logError(`Failed to replace details in supply ${supplyId}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Submit a supply (requires receiver information and files)
   * @param id Supply ID
   * @param dto Submission data
   * @param files File attachments (at least one required)
   */
  submit(id: number, dto: SubmitSupplyDto, files: File[]): Observable<boolean> {
    this.config.log(`Submitting supply ${id}`, dto);
    
    // Create FormData for multipart/form-data request
    const formData = new FormData();
    
    // Append DTO fields
    formData.append('RecieverName', dto.recieverName);
    formData.append('ReceiverRankId', dto.receiverRankId.toString());
    formData.append('RecieverMilitaryId', dto.recieverMilitaryId);
    if (dto.notes) {
      formData.append('Notes', dto.notes);
    }
    
    // Append files
    files.forEach((file, index) => {
      formData.append('files', file);
    });
    
    return this.apiService.postWithAuth<APIOperationResponse<boolean>>(
      `/Supply/${id}/submit`,
      formData
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to submit supply');
        }
        return response.data ?? false;
      }),
      catchError(error => {
        this.config.logError(`Failed to submit supply ${id}`, error);
        return throwError(() => error);
      })
    );
  }
}

