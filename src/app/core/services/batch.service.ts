import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BatchDto, BatchSummaryDto, BulkUpdateBatchAssetsDto, UpdateBatchDto } from '@models/batch.model';
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
        filterByIsAssigned?: boolean;
        assetsPage?: number;
        assetsPageSize?: number;
        includeAllAssets?: boolean;
    }): Observable<BatchDto | null> {
        let params = new HttpParams();
        if (options?.serialNumberOnly != null)
            params = params.set('serialNumberOnly', String(options.serialNumberOnly));
        if (options?.filterByIsAssigned != null)
            params = params.set('filterByIsAssigned', String(options.filterByIsAssigned));
        if (options?.assetsPage != null)
            params = params.set('assetsPage', String(options.assetsPage));
        if (options?.assetsPageSize != null)
            params = params.set('assetsPageSize', String(options.assetsPageSize));
        if (options?.includeAllAssets === true)
            params = params.set('includeAllAssets', 'true');
        return this.apiService.get<BatchDto | null>(`${this.basePath}/${id}`, params);
    }

    getByBatchNumber(batchNumber: string, options?: {
        depotId?: number;
        serialNumberOnly?: boolean;
        filterByIsAssigned?: boolean;
        assetsPage?: number;
        assetsPageSize?: number;
        includeAllAssets?: boolean;
    }): Observable<BatchDto[]> {
        let params = new HttpParams();
        if (options?.depotId != null)
            params = params.set('depotId', String(options.depotId));
        if (options?.serialNumberOnly != null)
            params = params.set('serialNumberOnly', String(options.serialNumberOnly));
        if (options?.filterByIsAssigned != null)
            params = params.set('filterByIsAssigned', String(options.filterByIsAssigned));
        if (options?.assetsPage != null)
            params = params.set('assetsPage', String(options.assetsPage));
        if (options?.assetsPageSize != null)
            params = params.set('assetsPageSize', String(options.assetsPageSize));
        if (options?.includeAllAssets === true)
            params = params.set('includeAllAssets', 'true');
        const encoded = encodeURIComponent(batchNumber.trim());
        return this.apiService.get<BatchDto[]>(`${this.basePath}/by-number/${encoded}`, params);
    }

    updateBatch(batchId: number, dto: UpdateBatchDto): Observable<boolean> {
        return this.apiService.put<boolean>(`${this.basePath}/${batchId}`, dto);
    }

    bulkUpdateAssets(batchId: number, dto: BulkUpdateBatchAssetsDto, files?: File[]): Observable<boolean> {
        // Always send multipart/form-data to keep the API consistent with other endpoints (Asset bulk, Inventory update).
        const formData = new FormData();
        formData.append('dtoJson', JSON.stringify(dto));
        (files || []).forEach(f => formData.append('files', f));
        return this.apiService.put<boolean>(`${this.basePath}/${batchId}/assets`, formData);
    }

    delete(id: number): Observable<void> {
        return this.apiService.delete<void>(`${this.basePath}/${id}`);
    }

    removeAssetFromBatch(batchId: number, assetId: number): Observable<boolean> {
        return this.apiService.delete<boolean>(`${this.basePath}/${batchId}/assets/${assetId}`);
    }
}
