import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BatchDto, BatchSummaryDto, BulkUpdateBatchAssetsDto } from '@models/batch.model';
import { PagedListRequest, PaginatedList } from '@models/pagination.model';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';

@Injectable({
    providedIn: 'root'
})
export class BatchService {
    private get basePath(): string {
        return '/Batch';
    }

    constructor(
        private configService: ConfigService,
        private apiService: ApiService
    ) { }

    getSummary(depotId: number): Observable<BatchSummaryDto[]> {
        const params = new HttpParams().set('depotId', depotId.toString());
        return this.apiService.get<BatchSummaryDto[]>(`${this.basePath}/summary`, params);
    }

    getAll(depotId?: number): Observable<BatchDto[]> {
        let params = new HttpParams();
        if (depotId) {
            params = params.set('depotId', depotId.toString());
        }
        return this.apiService.get<BatchDto[]>(this.basePath, params);
    }

    search(depotId: number | null, request: PagedListRequest): Observable<PaginatedList<BatchDto>> {
        let params = new HttpParams();
        if (depotId) {
            params = params.set('depotId', depotId.toString());
        }
        return this.apiService.post<PaginatedList<BatchDto>>(`${this.basePath}/search`, request, { params }).pipe(
            map(response => {
                if (!response?.items) {
                    throw new Error('Invalid response structure');
                }
                return response;
            })
        );
    }

    getById(id: number, options?: {
        serialNumberOnly?: boolean;
        quantity?: number;
        filterByIsAssigned?: boolean;
    }): Observable<BatchDto | null> {
        let params = new HttpParams();
        if (options?.serialNumberOnly != null)
            params = params.set('serialNumberOnly', String(options.serialNumberOnly));
        if (options?.quantity != null)
            params = params.set('quantity', String(options.quantity));
        if (options?.filterByIsAssigned != null)
            params = params.set('filterByIsAssigned', String(options.filterByIsAssigned));
        return this.apiService.get<BatchDto | null>(`${this.basePath}/${id}`, params);
    }

    getByBatchNumber(batchNumber: string, options?: {
        serialNumberOnly?: boolean;
        quantity?: number;
        filterByIsAssigned?: boolean;
    }): Observable<BatchDto | null> {
        let params = new HttpParams();
        if (options?.serialNumberOnly != null)
            params = params.set('serialNumberOnly', String(options.serialNumberOnly));
        if (options?.quantity != null)
            params = params.set('quantity', String(options.quantity));
        if (options?.filterByIsAssigned != null)
            params = params.set('filterByIsAssigned', String(options.filterByIsAssigned));
        const encoded = encodeURIComponent(batchNumber.trim());
        return this.apiService.get<BatchDto | null>(`${this.basePath}/by-number/${encoded}`, params);
    }

    bulkUpdateAssets(batchId: number, dto: BulkUpdateBatchAssetsDto): Observable<boolean> {
        return this.apiService.put<boolean>(`${this.basePath}/${batchId}/assets`, dto);
    }

    delete(id: number): Observable<void> {
        return this.apiService.delete<void>(`${this.basePath}/${id}`);
    }

    removeAssetFromBatch(batchId: number, assetId: number): Observable<boolean> {
        return this.apiService.delete<boolean>(`${this.basePath}/${batchId}/assets/${assetId}`);
    }
}
