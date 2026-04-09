import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AssetDto, CreateAssetDto, UpdateAssetDto, CreateBulkAssetsFromTemplateDto, BulkCreateFromTemplateResultDto } from '@models/asset.model';
import { PagedListRequest, PaginatedList } from '@models/pagination.model';
import { APIOperationResponse } from '@models/api-response.model';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';

import { IImportableService } from '../interfaces/importable-service.interface';
import { ImportResult } from '../models';

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
     * Get all assets
     */
    getAll<T = AssetDto>(query?: { search?: string; depotId?: number }): Observable<T[]> {
        let params = new HttpParams();
        if (query?.search) params = params.set('search', query.search);
        if (query?.depotId) params = params.set('depotId', query.depotId.toString());

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

    createBulkFromTemplate(data: CreateBulkAssetsFromTemplateDto): Observable<BulkCreateFromTemplateResultDto> {
        return this.apiService.post<BulkCreateFromTemplateResultDto>(`${this.basePath}/bulk-template`, data);
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
