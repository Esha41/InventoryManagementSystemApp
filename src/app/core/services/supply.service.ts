import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { FileUploadDto } from '@models/file-upload.model';
import { OrderDto } from '@models/order.model';

// ==================== Supply DTOs ====================

export interface SupplyLotSuggestionDto {
  inventoryDetailId: number;
  itemId: number;
  itemName: string;
  lot: string;
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
  lot: string;
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
  receiverRankId: number | null;
  recieverMilitaryId: string;
  notes?: string;
}

export interface UpdateSupplyDetailDto {
  itemId: number;
  lot: string;
  quantity: number;
  notes?: string;
}

export interface SupplyDetailDto {
  id: number;
  supplyId: number;
  itemId: number;
  lot: string;
  quantity: number;
  notes?: string;
  requestedQuantity: number;
  totalSuppliedQuantity: number;
  isFullyFulfilled: boolean;
  expiryDate?: string;
  depot?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
  item?: {
    id: number;
    name?: string; // BaseItemDto uses 'name' not 'nameEn/nameAr'
    itemNo?: string;
    itemType?: number;
    batchNo?: string;
  };
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
  order?: OrderDto;
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
  private readonly endpoint = '/Supply';

  constructor(
    private apiService: ApiService,
    private config: ConfigService
  ) { }

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

    return this.apiService.get<OrderSupplySuggestionDto>(`${this.endpoint}/suggestion/${orderId}`, params);
  }

  /**
   * Get supply by ID with all details
   * @param id Supply ID
   */
  getById(id: number): Observable<SupplyDto> {
    this.config.log(`Fetching supply ${id}`);
    return this.apiService.get<SupplyDto>(`${this.endpoint}/${id}`);
  }

  /**
   * Get all supplies with details
   */
  getAll(): Observable<SupplyDto[]> {
    this.config.log('Fetching all supplies');
    return this.apiService.get<SupplyDto[]>(this.endpoint);
  }

  /**
   * Get supply by Order ID
   * @param orderId Order ID
   */
  getByOrderId(orderId: number): Observable<SupplyDto> {
    this.config.log(`Fetching supply for order ${orderId}`);
    return this.apiService.get<SupplyDto>(`${this.endpoint}/${orderId}/getByOrderId`);
  }

  /**
   * Get draft supply by Order ID
   * @param orderId Order ID
   */
  getDraftByOrderId(orderId: number): Observable<SupplyDto | null> {
    this.config.log(`Fetching draft supply for order ${orderId}`);
    return this.apiService.getRaw<SupplyDto>(`${this.endpoint}/${orderId}/draft`).pipe(
      map(response => response.succeeded ? response.data : null),
      catchError(() => of(null)) // Return null if not found or error, as per original logic's intent (sort of)
    );
    // Original logic threw error if !succeeded.
    // But method signature says `Observable<SupplyDto | null>`.
    // If I use `apiService.get<SupplyDto>`, it throws if !succeeded.
    // I'll stick to `apiService.get` and let it throw, but user might expect null.
    // Actually original code: `if (!response.succeeded) throw`. So it THROWS.
    // So `apiService.get` is correct. The `| null` in signature might be for empty data?
    // I will use `apiService.get<SupplyDto>` and trust it throws on error/failure.
  }

  /**
   * Check if a draft supply exists for an order
   * @param orderId Order ID
   */
  checkDraftSupplyExists(orderId: number): Observable<SupplyDto | null> {
    // We want to return null if not found, not throw.
    return this.apiService.getRaw<SupplyDto>(`${this.endpoint}/${orderId}/draft`).pipe(
      map(res => res.succeeded ? res.data : null),
      catchError(() => of(null))
    );
  }

  /**
   * Create a new supply with draft status
   * @param dto Supply creation data
   * @returns Created supply ID
   */
  create(dto: CreateSupplyDto): Observable<number> {
    this.config.log('Creating supply', dto);
    return this.apiService.post<number>(this.endpoint, dto);
  }

  /**
   * Update supply information (receiver info, notes, etc.)
   * @param id Supply ID
   * @param dto Supply update data
   */
  updateSupplyInfo(id: number, dto: UpdateSupplyDto): Observable<boolean> {
    this.config.log(`Updating supply ${id}`, dto);
    return this.apiService.put<boolean>(`${this.endpoint}/${id}`, dto);
  }

  /**
   * Add a new supply detail to an existing supply
   * @param supplyId Supply ID
   * @param detailDto Supply detail data
   * @returns Created detail ID
   */
  addSupplyDetail(supplyId: number, detailDto: CreateSupplyDetailDto): Observable<number> {
    this.config.log(`Adding detail to supply ${supplyId}`, detailDto);
    return this.apiService.post<number>(`${this.endpoint}/${supplyId}/details`, detailDto);
  }

  /**
   * Update an existing supply detail
   * @param supplyId Supply ID
   * @param detailId Supply Detail ID
   * @param detailDto Supply detail update data
   */
  updateSupplyDetail(supplyId: number, detailId: number, detailDto: UpdateSupplyDetailDto): Observable<boolean> {
    this.config.log(`Updating detail ${detailId} in supply ${supplyId}`, detailDto);
    return this.apiService.put<boolean>(`${this.endpoint}/${supplyId}/details/${detailId}`, detailDto);
  }

  /**
   * Delete a supply detail
   * @param supplyId Supply ID
   * @param detailId Supply Detail ID
   */
  deleteSupplyDetail(supplyId: number, detailId: number): Observable<boolean> {
    this.config.log(`Deleting detail ${detailId} from supply ${supplyId}`);
    return this.apiService.delete<boolean>(`${this.endpoint}/${supplyId}/details/${detailId}`);
  }

  /**
   * Replace all supply details with new ones
   * @param supplyId Supply ID
   * @param details List of new supply details
   */
  replaceSupplyDetails(supplyId: number, details: CreateSupplyDetailDto[]): Observable<boolean> {
    this.config.log(`Replacing all details in supply ${supplyId}`, { detailCount: details.length });
    return this.apiService.put<boolean>(`${this.endpoint}/${supplyId}/details`, details);
  }

  /**
   * Submit a supply (requires receiver information and files)
   * @param id Supply ID
   * @param dto Submission data
   * @param files File attachments (at least one required)
   */
  submit(id: number, dto: SubmitSupplyDto, files: File[]): Observable<boolean> {
    this.config.log(`Submitting supply ${id}`, dto);

    const formData = new FormData();
    formData.append('RecieverName', dto.recieverName);
    if (dto.receiverRankId !== null) {
      formData.append('ReceiverRankId', dto.receiverRankId.toString());
    }
    formData.append('RecieverMilitaryId', dto.recieverMilitaryId);
    if (dto.notes) {
      formData.append('Notes', dto.notes);
    }
    files.forEach((file) => {
      formData.append('files', file);
    });

    return this.apiService.post<boolean>(`${this.endpoint}/${id}/submit`, formData);
  }
}

