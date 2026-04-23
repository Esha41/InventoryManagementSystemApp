import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { LookupItem } from '@models/lookup.model';
import { CreateUpdateLookupDto } from '@models/lookup.model';
import { RequestPurposeType } from '@models/lookup.model';

/** Request purpose item compatible with LookupItem */
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
      case 'discard': return API_ENDPOINTS.REQUEST_PURPOSES.FOR_DISCARD;
      case 'return': return API_ENDPOINTS.REQUEST_PURPOSES.FOR_RETURN;
      case 'order': return API_ENDPOINTS.REQUEST_PURPOSES.FOR_ORDER;
      default: throw new Error(`Unknown request purpose type: ${type}`);
    }
  }

  getAll(type: RequestPurposeType): Observable<LookupItem[]> {
    const endpoint = this.getEndpoint(type);
    return this.apiService.get<RequestPurposeItem[]>(endpoint).pipe(
      map(items => (Array.isArray(items) ? items : []).map(item => this.toLookupItem(item)))
    );
  }

  create(type: RequestPurposeType, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    const endpoint = this.getEndpoint(type);
    const body = { nameEn: dto.nameEn, nameAr: dto.nameAr };
    return this.apiService.post<number>(endpoint, body).pipe(
      map(id => ({ id, nameEn: dto.nameEn, nameAr: dto.nameAr } as LookupItem))
    );
  }

  update(id: number, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    const endpoint = API_ENDPOINTS.REQUEST_PURPOSES.BY_ID(id);
    const body = { nameEn: dto.nameEn, nameAr: dto.nameAr };
    return this.apiService.put<boolean>(endpoint, body).pipe(
      map(() => ({ id, nameEn: dto.nameEn, nameAr: dto.nameAr } as LookupItem))
    );
  }

  delete(id: number): Observable<boolean> {
    const endpoint = API_ENDPOINTS.REQUEST_PURPOSES.BY_ID(id);
    return this.apiService.delete<unknown>(endpoint).pipe(
      map(() => true)
    );
  }

  private toLookupItem(item: RequestPurposeItem): LookupItem {
    return {
      id: item.id,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      code: item.code,
      isDeleted: item.isDeleted
    };
  }
}
