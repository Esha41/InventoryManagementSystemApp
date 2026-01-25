import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AssetDto, CreateAssetDto, UpdateAssetDto } from '@models/asset.model';
import { PagedListRequest, PaginatedList } from '@models/pagination.model';
import { APIOperationResponse } from '@models/api-response.model';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';

/**
 * Asset Service
 * Handles CRUD operations for individual tracked items (weapons)
 */
@Injectable({
    providedIn: 'root'
})
export class AssetService {
    private get baseUrl(): string {
        return `${this.configService.apiUrl}/Asset`;
    }

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
            '/Asset/search',
            request,
            params
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

        if (query?.search) {
            params = params.set('search', query.search);
        }

        if (query?.depotId) {
            params = params.set('depotId', query.depotId.toString());
        }

        return this.http.get<APIOperationResponse<T[]>>(this.baseUrl, { params }).pipe(
            map(response => {
                if (response.succeeded && response.data) {
                    return response.data;
                }
                throw new Error(response.message || 'Failed to fetch assets');
            }),
            catchError(error => {
                console.error('Error fetching assets:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Get asset by ID
     */
    getById<T = AssetDto>(id: number): Observable<T | null> {
        return this.http.get<APIOperationResponse<T>>(`${this.baseUrl}/${id}`).pipe(
            map(response => {
                if (response.succeeded) {
                    return response.data || null;
                }
                throw new Error(response.message || 'Failed to fetch asset');
            }),
            catchError(error => {
                console.error('Error fetching asset:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Get asset by Serial Number
     */
    getBySerialNumber<T = AssetDto>(serialNumber: string): Observable<T | null> {
        return this.http.get<APIOperationResponse<T>>(`${this.baseUrl}/serial/${serialNumber}`).pipe(
            map(response => {
                if (response.succeeded) {
                    return response.data || null;
                }
                throw new Error(response.message || 'Failed to fetch asset by serial number');
            }),
            catchError(error => {
                console.error('Error fetching asset by serial:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Create new asset
     */
    create<T = AssetDto>(data: CreateAssetDto, files?: File[]): Observable<APIOperationResponse<T>> {
        const formData = new FormData();

        // Append asset data
        Object.keys(data).forEach(key => {
            const value = (data as any)[key];
            if (value !== null && value !== undefined) {
                if (value instanceof Date) {
                    formData.append(key, value.toISOString());
                } else {
                    formData.append(key, value.toString());
                }
            }
        });

        // Append files if provided
        if (files && files.length > 0) {
            files.forEach(file => {
                formData.append('files', file, file.name);
            });
        }

        return this.http.post<APIOperationResponse<T>>(this.baseUrl, formData).pipe(
            catchError(error => {
                console.error('Error creating asset:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Create bulk assets
     */
    createBulk<T = number[]>(data: CreateAssetDto[]): Observable<APIOperationResponse<T>> {
        console.log('[DEBUG] createBulk called with', data.length, 'items');
        return this.http.post<APIOperationResponse<T>>(`${this.baseUrl}/Bulk`, data).pipe(
            catchError(error => {
                console.error('Error creating bulk assets:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Update existing asset
     */
    update<T = AssetDto>(id: number, data: UpdateAssetDto): Observable<APIOperationResponse<T>> {
        return this.http.put<APIOperationResponse<T>>(`${this.baseUrl}/${id}`, data).pipe(
            catchError(error => {
                console.error('Error updating asset:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Delete asset (soft delete)
     */
    delete(id: number): Observable<APIOperationResponse<void>> {
        return this.http.delete<APIOperationResponse<void>>(`${this.baseUrl}/${id}`).pipe(
            catchError(error => {
                console.error('Error deleting asset:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Get assets by depot ID
     */
    getByDepotId<T = AssetDto>(depotId: number): Observable<T[]> {
        return this.getAll<T>({ depotId });
    }

    /**
     * Check if serial number is unique
     */
    checkSerialNumberUnique(serialNumber: string, excludeId?: number): Observable<boolean> {
        let params = new HttpParams().set('serialNumber', serialNumber);

        if (excludeId) {
            params = params.set('excludeId', excludeId.toString());
        }

        return this.http.get<APIOperationResponse<boolean>>(`${this.baseUrl}/check-serial`, { params }).pipe(
            map(response => response.data ?? true),
            catchError(() => {
                // If endpoint doesn't exist, assume it's unique
                return [true];
            })
        );
    }

    /**
     * Check if RFID is unique
     */
    checkRfidUnique(rfid: string, excludeId?: number): Observable<boolean> {
        let params = new HttpParams().set('rfid', rfid);

        if (excludeId) {
            params = params.set('excludeId', excludeId.toString());
        }

        return this.http.get<APIOperationResponse<boolean>>(`${this.baseUrl}/check-rfid`, { params }).pipe(
            map(response => response.data ?? true),
            catchError(() => {
                // If endpoint doesn't exist, assume it's unique
                return [true];
            })
        );
    }

    /**
     * Import assets from Excel file
     */
    importData(file: File, depotId: number, language: string = 'en'): Observable<APIOperationResponse<any>> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('depotId', depotId.toString());
        const params = new HttpParams().set('language', language);

        return this.http.post<APIOperationResponse<any>>(`${this.baseUrl}/Import`, formData, { params }).pipe(
            catchError(error => {
                console.error('Error importing assets:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Preview asset import from Excel file (validation only)
     */
    importPreview(file: File, depotId: number, language: string = 'en'): Observable<APIOperationResponse<any>> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('depotId', depotId.toString());
        const params = new HttpParams().set('language', language);

        return this.http.post<APIOperationResponse<any>>(`${this.baseUrl}/ImportPreview`, formData, { params }).pipe(
            catchError(error => {
                console.error('Error previewing asset import:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Download asset import template
     */
    downloadImportTemplate(depotId: number, language: string = 'en'): Observable<Blob> {
        return this.http.get(`${this.baseUrl}/template?depotId=${depotId}&language=${language}`, {
            responseType: 'blob',
            observe: 'body'
        }).pipe(
            catchError(error => {
                console.error('Error downloading template:', error);
                return throwError(() => error);
            })
        );
    }
}
