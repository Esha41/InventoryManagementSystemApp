import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import {
  LookupItem,
  CreateUpdateLookupDto,
  AttachmentRequirementLookupDraft,
  RequestPurposeType,
  RequestPurposeAllowanceContext
} from '@models/lookup.model';
import { normalizeRequestPurposeAllowanceContext } from '@utils/request-purpose-allowance.utils';

/** Full request purpose row from API (GET list/detail). */
export interface RequestPurposeApiDto {
  id: number;
  nameEn?: string | null;
  nameAr?: string | null;
  requestType?: number;
  /** Raw API numeric enum before toLookupItem. */
  allowanceContext?: unknown;
  code?: string;
  isDeleted?: boolean;
  itemTypes?: number[] | null;
  attachmentRequirements?: ApiAttachmentRequirement[] | null;
}

interface ApiAttachmentRequirement {
  id: number;
  nameEn?: string | null;
  nameAr?: string | null;
  isRequired: boolean;
  minCount: number;
  maxCount: number;
  displayOrder: number;
}

/** Request purpose item compatible with LookupItem + attachment slots for admin. */
export interface RequestPurposeItem extends LookupItem {
  id: number;
  requestType?: number;
}

/**
 * Service for Request Purpose CRUD operations.
 * Used by lookup management for Discard, Return, and Order request purposes.
 */
@Injectable({
  providedIn: 'root'
})
export class RequestPurposeService {
  constructor(private apiService: ApiService) {}

  private getEndpoint(type: RequestPurposeType): string {
    switch (type) {
      case 'discard':
        return API_ENDPOINTS.REQUEST_PURPOSES.FOR_DISCARD;
      case 'return':
        return API_ENDPOINTS.REQUEST_PURPOSES.FOR_RETURN;
      case 'order':
        return API_ENDPOINTS.REQUEST_PURPOSES.FOR_ORDER;
      default:
        throw new Error(`Unknown request purpose type: ${type}`);
    }
  }

  getAll(type: RequestPurposeType): Observable<LookupItem[]> {
    const endpoint = this.getEndpoint(type);
    return this.apiService.get<RequestPurposeApiDto[]>(endpoint).pipe(
      map(raw => (Array.isArray(raw) ? raw : []).map(item => this.toLookupItem(item)))
    );
  }

  /** Order purposes filtered by allowance mode (new-issue flow). */
  getAllForOrder(isFromAllowance: boolean): Observable<RequestPurposeItem[]> {
    const endpoint = `${API_ENDPOINTS.REQUEST_PURPOSES.FOR_ORDER}?isFromAllowance=${isFromAllowance}`;
    return this.apiService.get<RequestPurposeApiDto[]>(endpoint).pipe(
      map(raw => (Array.isArray(raw) ? raw : []).map(item => this.toLookupItem(item)))
    );
  }

  create(type: RequestPurposeType, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    const endpoint = this.getEndpoint(type);
    const body = this.toRequestPurposePayload(dto);
    return this.apiService.post<number>(endpoint, body).pipe(
      map(id =>
        ({
          id,
          nameEn: dto.nameEn,
          nameAr: dto.nameAr,
          attachmentRequirements: dto.attachmentRequirements ?? []
        }) as RequestPurposeItem
      )
    );
  }

  update(id: number, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    const endpoint = API_ENDPOINTS.REQUEST_PURPOSES.BY_ID(id);
    const body = this.toRequestPurposePayload(dto);
    return this.apiService.put<boolean>(endpoint, body).pipe(
      map(() => ({
        id,
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        attachmentRequirements: dto.attachmentRequirements ?? []
      }) as RequestPurposeItem)
    );
  }

  delete(id: number): Observable<boolean> {
    const endpoint = API_ENDPOINTS.REQUEST_PURPOSES.BY_ID(id);
    return this.apiService.delete<unknown>(endpoint).pipe(map(() => true));
  }

  private toRequestPurposePayload(dto: CreateUpdateLookupDto): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      nameEn: dto.nameEn,
      nameAr: dto.nameAr
    };
    if (dto.allowanceContext != null) {
      payload['allowanceContext'] = dto.allowanceContext;
    }
    payload['itemTypes'] = dto.itemTypes ?? [];
    if (dto.attachmentRequirements != null && dto.attachmentRequirements.length > 0) {
      payload['attachmentRequirements'] = dto.attachmentRequirements.map(r => ({
        id: r.id != null && r.id > 0 ? r.id : null,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        isRequired: r.isRequired,
        minCount: r.minCount,
        maxCount: r.maxCount,
        displayOrder: r.displayOrder
      }));
    } else {
      payload['attachmentRequirements'] = [];
    }
    return payload;
  }

  private toLookupItem(item: RequestPurposeApiDto): RequestPurposeItem {
    return {
      id: item.id,
      nameEn: item.nameEn ?? '',
      nameAr: item.nameAr ?? '',
      code: item.code,
      isDeleted: item.isDeleted,
      requestType: item.requestType,
      allowanceContext: normalizeRequestPurposeAllowanceContext(item.allowanceContext),
      itemTypes: Array.isArray(item.itemTypes) ? item.itemTypes : [],
      attachmentRequirements: this.mapAttachmentRequirements(item.attachmentRequirements)
    };
  }

  private mapAttachmentRequirements(
    list: ApiAttachmentRequirement[] | null | undefined
  ): AttachmentRequirementLookupDraft[] {
    if (!list?.length) {
      return [];
    }
    return [...list]
      .filter(a => a != null)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map(a => ({
        id: a.id,
        nameEn: a.nameEn ?? '',
        nameAr: a.nameAr ?? '',
        isRequired: !!a.isRequired,
        minCount: a.minCount ?? 0,
        maxCount: a.maxCount ?? 1,
        displayOrder: a.displayOrder ?? 0
      }));
  }
}
