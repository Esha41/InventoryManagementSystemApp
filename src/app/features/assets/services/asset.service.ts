import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, EMPTY, of } from 'rxjs';
import { map, catchError, expand, reduce } from 'rxjs/operators';
import { AssetDto, CreateAssetDto, UpdateAssetDto, CreateBulkAssetsFromTemplateDto, BulkCreateFromTemplateResultDto, BulkDeleteAssetsEnqueueResultDto, BulkDeleteAssetsStatusDto, StartBulkDeleteAssetsDto } from '@models/asset.model';
import { AssetItemCatalogSummaryDto } from '@models/inventory.model';
import { PagedListRequest, PaginatedList } from '@models/pagination.model';
import { APIOperationResponse } from '@models/api-response.model';
import { ConfigService } from '@services/config.service';
import { ApiService } from '@services/api.service';

import { IImportableService } from '@core/interfaces/importable-service.interface';
import { ImportResult } from '@models/import-result.model';
import { defaultPageSize } from '@constants/app.constants';

/**
 * Asset Service
 * Handles CRUD operations for individual tracked items (weapons)
 */
@Injectable({
    providedIn: 'root'
})
export class AssetService implements IImportableService {
    private readonly basePath = '/Asset';

    constructor(
        private http: HttpClient,
        private configService: ConfigService,
        private apiService: ApiService
    ) { }

    /**
     * Get paginated assets
     * Note: apiService.post automatically unwraps APIOperationResponse, so response is already PaginatedList
     */
    getAssetsPaginated(depotId: number | null, request: PagedListRequest): Observable<PaginatedList<AssetDto>> {
        let params = new HttpParams();
        if (depotId) {
            params = params.set('depotId', depotId.toString());
        }

        return this.apiService.post<PaginatedList<AssetDto>>(
            `${this.basePath}/search`,
            request,
            { params }
        ).pipe(
            map(response => {
                // Response is already unwrapped PaginatedList from apiService
                if (!response || !response.items) {
                    throw new Error('Invalid response structure');
                }
                return response;
            }),
            catchError(error => {
                console.error('Error fetching paginated assets:', error);
                throw error;
            })
        );
    }

    /**
     * Catalog items that have assets: id, name, item no, type, total asset count (paged).
     * POST /api/Asset/catalog-items/paged
     */
    getAssetCatalogItemSummariesPaged(
        request: PagedListRequest,
        query?: { depotId?: number; depotIds?: number[]; itemType?: number }
    ): Observable<PaginatedList<AssetItemCatalogSummaryDto>> {
        let params = new HttpParams();
        if (query?.depotId != null) params = params.set('depotId', String(query.depotId));
        if (query?.depotIds?.length) {
            for (const id of query.depotIds) {
                params = params.append('depotIds', String(id));
            }
        }
        if (query?.itemType != null) params = params.set('itemType', String(query.itemType));

        return this.apiService.post<PaginatedList<AssetItemCatalogSummaryDto>>(
            `${this.basePath}/catalog-items/paged`,
            request,
            { params }
        ).pipe(
            map(response => {
                if (!response || !response.items) {
                    throw new Error('Invalid response structure');
                }
                return response;
            }),
            catchError(error => {
                console.error('Error fetching paged asset catalog summaries:', error);
                throw error;
            })
        );
    }

    /**
     * Get all assets for a specific catalog item, optionally scoped to depot(s).
     * Used by the inventory dashboard accordion for weapon items.
     */
    getAssetsByItemId(itemId: number, depotId?: number, depotIds?: number[]): Observable<AssetDto[]> {
        let params = new HttpParams();
        if (depotIds?.length) {
            for (const id of depotIds) {
                params = params.append('depotIds', String(id));
            }
        } else if (depotId) {
            params = params.set('depotId', depotId.toString());
        }
        return this.apiService.get<AssetDto[]>(`${this.basePath}/item/${itemId}`, params);
    }

    /**
     * Same as {@link getAssetsByItemId} but paged. POST /api/Asset/item/{itemId}/paged
     */
    getAssetsByItemIdPaged(itemId: number, request: PagedListRequest, depotId?: number, depotIds?: number[]): Observable<PaginatedList<AssetDto>> {
        let params = new HttpParams();
        if (depotIds?.length) {
            for (const id of depotIds) {
                params = params.append('depotIds', String(id));
            }
        } else if (depotId) {
            params = params.set('depotId', depotId.toString());
        }
        return this.apiService.post<PaginatedList<AssetDto>>(`${this.basePath}/item/${itemId}/paged`, request, { params }).pipe(
            map(response => {
                if (!response || !response.items) {
                    throw new Error('Invalid response structure');
                }
                return response;
            }),
            catchError(error => {
                console.error('Error fetching assets by item (paged):', error);
                throw error;
            })
        );
    }

    /**
     * All assets for one catalog item via repeated `POST /api/Asset/item/{itemId}/paged` (no `GET /api/Asset`).
     */
    getAssetsByItemIdAllPages(itemId: number, depotId?: number, pageSize: number = defaultPageSize, depotIds?: number[]): Observable<AssetDto[]> {
        const maxPages = 5000;
        const fetchPage = (page: number) =>
            this.getAssetsByItemIdPaged(itemId, { page, pageSize }, depotId, depotIds).pipe(
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
            reduce<{ res: PaginatedList<AssetDto>; requestedPage: number }, AssetDto[]>(
                (acc, { res }) => acc.concat(res.items ?? []),
                []
            )
        );
    }

    /**
     * Get all assets
     */
    getAll<T = AssetDto>(query?: { search?: string; depotId?: number; depotIds?: number[] }): Observable<T[]> {
        let params = new HttpParams();
        if (query?.search) params = params.set('search', query.search);
        if (query?.depotId != null) params = params.set('depotId', String(query.depotId));
        if (query?.depotIds?.length) {
            for (const id of query.depotIds) {
                params = params.append('depotIds', String(id));
            }
        }

        return this.apiService.get<T[]>(this.basePath, params);
    }

    /**
     * Get asset by ID
     */
    getById<T = AssetDto>(id: number): Observable<T | null> {
        return this.apiService.get<T | null>(`${this.basePath}/${id}`);
    }

    /**
     * Get asset by Serial Number
     */
    getBySerialNumber<T = AssetDto>(serialNumber: string): Observable<T | null> {
        return this.apiService.get<T | null>(`${this.basePath}/serial/${serialNumber}`);
    }

    /**
     * Create new asset
     */
    create<T = AssetDto>(data: CreateAssetDto, files?: File[]): Observable<T> {
        const formData = new FormData();

        Object.keys(data).forEach(key => {
            const value = (data as unknown as Record<string, unknown>)[key];
            if (value !== null && value !== undefined) {
                if (value instanceof Date) {
                    formData.append(key, value.toISOString());
                } else {
                    formData.append(key, String(value));
                }
            }
        });

        if (files?.length) {
            files.forEach(file => formData.append('files', file, file.name));
        }

        return this.apiService.post<T>(this.basePath, formData);
    }

    /**
     * Create bulk assets
     */
    createBulk<T = number[]>(data: CreateAssetDto[], files?: File[]): Observable<T> {
        const formData = new FormData();
        formData.append('dtosJson', JSON.stringify(data));
        (files || []).forEach(file => formData.append('files', file, file.name));
        return this.apiService.post<T>(`${this.basePath}/Bulk`, formData);
    }

    createBulkFromTemplate(data: CreateBulkAssetsFromTemplateDto, files?: File[]): Observable<BulkCreateFromTemplateResultDto> {
        const formData = new FormData();
        formData.append('dtoJson', JSON.stringify(data));
        files?.forEach(file => formData.append('files', file, file.name));
        return this.apiService.post<BulkCreateFromTemplateResultDto>(`${this.basePath}/bulk-template`, formData);
    }

    /**
     * Start async chunked soft-delete (Hangfire). Poll with {@link getBulkDeleteStatus}.
     */
    startBulkDelete(dto: StartBulkDeleteAssetsDto): Observable<BulkDeleteAssetsEnqueueResultDto> {
        return this.apiService.post<BulkDeleteAssetsEnqueueResultDto>(`${this.basePath}/bulk-delete`, dto);
    }

    getBulkDeleteStatus(jobId: string): Observable<BulkDeleteAssetsStatusDto> {
        return this.apiService.get<BulkDeleteAssetsStatusDto>(
            `${this.basePath}/bulk-delete/${encodeURIComponent(jobId)}/status`);
    }

    /**
     * Update existing asset
     */
    update<T = AssetDto>(id: number, data: UpdateAssetDto, files?: File[]): Observable<T> {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            const value = (data as unknown as Record<string, unknown>)[key];
            if (value !== null && value !== undefined) {
                if (value instanceof Date) {
                    formData.append(key, value.toISOString());
                } else {
                    formData.append(key, String(value));
                }
            }
        });
        (files || []).forEach(file => formData.append('files', file, file.name));
        return this.apiService.put<T>(`${this.basePath}/${id}`, formData);
    }

    /**
     * Delete asset (soft delete)
     */
    delete(id: number): Observable<void> {
        return this.apiService.delete<void>(`${this.basePath}/${id}`);
    }

    /**
     * Get assets by depot ID
     */
    getByDepotId<T = AssetDto>(depotId: number): Observable<T[]> {
        return this.getAll<T>({ depotId });
    }

    /**
     * Update serial number for a single asset
     */
    updateSerialNumber(assetId: number, serialNumber: string | null): Observable<boolean> {
        return this.apiService.put<boolean>(
            `${this.basePath}/${assetId}/serial-number`,
            { serialNumber }
        );
    }

    /**
     * Check if serial number is unique
     */
    checkSerialNumberUnique(serialNumber: string, excludeId?: number): Observable<boolean> {
        let params = new HttpParams().set('serialNumber', serialNumber);
        if (excludeId) params = params.set('excludeId', excludeId.toString());

        return this.apiService.get<boolean>(`${this.basePath}/check-serial`, params).pipe(
            catchError(() => of(true))
        );
    }

    /**
     * Check if RFID is unique
     */
    checkRfidUnique(rfid: string, excludeId?: number): Observable<boolean> {
        let params = new HttpParams().set('rfid', rfid);
        if (excludeId) params = params.set('excludeId', excludeId.toString());

        return this.apiService.get<boolean>(`${this.basePath}/check-rfid`, params).pipe(
            catchError(() => of(true))
        );
    }

    /**
     * Import assets from Excel file
     */
    importData(file: File, language: string = 'en', depotId?: number): Observable<APIOperationResponse<ImportResult>> {
        const formData = new FormData();
        formData.append('file', file);
        if (depotId) formData.append('depotId', depotId.toString());
        const params = new HttpParams().set('language', language);

        return this.apiService.postRaw<ImportResult>(`${this.basePath}/Import`, formData, { params });
    }

    /**
     * Preview asset import from Excel file (validation only)
     */
    importPreview(file: File, language: string = 'en', depotId?: number): Observable<APIOperationResponse<ImportResult>> {
        const formData = new FormData();
        formData.append('file', file);
        if (depotId) formData.append('depotId', depotId.toString());
        const params = new HttpParams().set('language', language);

        return this.apiService.postRaw<ImportResult>(`${this.basePath}/ImportPreview`, formData, { params });
    }

    /**
     * Download asset import template (HttpClient required for blob response)
     */
    generateImportTemplate(language: string = 'en', depotId?: number): Observable<Blob> {
        const url = `${this.configService.apiUrl}${this.basePath}/template?depotId=${depotId || ''}&language=${language}`;
        return this.http.get(url, { responseType: 'blob', observe: 'body' }).pipe(
            map(blob => blob as Blob)
        );
    }
}
