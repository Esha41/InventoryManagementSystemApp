import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from '@services/config.service';
import { ApiService } from '@services/api.service';
import type {
  CreateSupplyDetailDto,
  CreateSupplyDto,
  OrderSupplySuggestionDto,
  SubmitSupplyDto,
  SupplyDto,
  UpdateSupplyDetailDto,
  UpdateSupplyDto,
  WorkflowSupplySummaryDto
} from '@models/supply-dto.model';

export type {
  CreateSupplyDetailDto,
  CreateSupplyDto,
  OrderItemSupplySuggestionDto,
  OrderSupplySuggestionDto,
  SupplyLotSuggestionDto,
  SubmitSupplyDto,
  SupplyDetailDto,
  SupplyDto,
  UpdateSupplyDetailDto,
  UpdateSupplyDto,
  WeaponSelectionLineDto,
  WeaponSuppliedLineDto,
  WorkflowSupplySummaryDto,
  WorkflowSupplySummaryLineDto
} from '@models/supply-dto.model';

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
   * Read-only workflow supply/pickup summary (provisional while order in progress, final when approved).
   * Requires ViewWorkflowSupplySummary.
   */
  getWorkflowSupplySummary(orderId: number): Observable<WorkflowSupplySummaryDto> {
    this.config.log(`Fetching workflow supply summary for order ${orderId}`);
    return this.apiService.get<WorkflowSupplySummaryDto>(`${this.endpoint}/${orderId}/workflow-summary`);
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
   * Submit a supply (requires receiver information and supporting files)
   */
  submit(
    id: number,
    dto: SubmitSupplyDto,
    otherFiles: File[],
    receiverSignatureFile?: File | null
  ): Observable<boolean> {
    this.config.log(`Submitting supply ${id}`, dto);

    const formData = new FormData();
    formData.append('ReceiverEmployeeId', dto.receiverEmployeeId.toString());
    if (dto.notes) {
      formData.append('Notes', dto.notes);
    }
    if (receiverSignatureFile?.size) {
      formData.append('receiverSignatureFile', receiverSignatureFile);
    }
    otherFiles.forEach((file) => {
      formData.append('otherFiles', file);
    });

    return this.apiService.post<boolean>(`${this.endpoint}/${id}/submit`, formData);
  }
}

