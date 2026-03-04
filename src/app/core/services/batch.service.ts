import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { BatchDto, BatchSummaryDto, BulkUpdateBatchAssetsDto } from '@models/batch.model';
import { PagedListRequest, PaginatedList } from '@models/pagination.model';
import { APIOperationResponse } from '@models/api-response.model';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';

@Injectable({
    providedIn: 'root'
})
export class BatchService {
    private get baseUrl(): string {
        return `${this.configService.apiUrl}/Batch`;
    }

    constructor(
        private http: HttpClient,
        private configService: ConfigService,
        private apiService: ApiService
    ) { }

    getSummary(depotId: number): Observable<BatchSummaryDto[]> {
        const params = new HttpParams().set('depotId', depotId.toString());
        return this.http.get<APIOperationResponse<BatchSummaryDto[]>>(`${this.baseUrl}/summary`, { params }).pipe(
            map(response => {
                if (response.succeeded && response.data) {
                    return response.data;
                }
                throw new Error(response.message || 'Failed to fetch batch summary');
            }),
            catchError(error => {
                console.error('Error fetching batch summary:', error);
                return throwError(() => error);
            })
        );
    }

    getAll(depotId?: number): Observable<BatchDto[]> {
        let params = new HttpParams();
        if (depotId) {
            params = params.set('depotId', depotId.toString());
        }
        return this.http.get<APIOperationResponse<BatchDto[]>>(this.baseUrl, { params }).pipe(
            map(response => {
                if (response.succeeded && response.data) {
                    return response.data;
                }
                throw new Error(response.message || 'Failed to fetch batches');
            }),
            catchError(error => {
                console.error('Error fetching batches:', error);
                return throwError(() => error);
            })
        );
    }

    search(depotId: number | null, request: PagedListRequest): Observable<PaginatedList<BatchDto>> {
        let params = new HttpParams();
        if (depotId) {
            params = params.set('depotId', depotId.toString());
        }
        return this.apiService.post<PaginatedList<BatchDto>>(
            '/Batch/search',
            request,
            params
        ).pipe(
            map(response => {
                if (!response || !response.items) {
                    throw new Error('Invalid response structure');
                }
                return response;
            }),
            catchError(error => {
                console.error('Error searching batches:', error);
                throw error;
            })
        );
    }

    getById(id: number): Observable<BatchDto | null> {
        return this.http.get<APIOperationResponse<BatchDto>>(`${this.baseUrl}/${id}`).pipe(
            map(response => {
                if (response.succeeded) {
                    return response.data || null;
                }
                throw new Error(response.message || 'Failed to fetch batch');
            }),
            catchError(error => {
                console.error('Error fetching batch:', error);
                return throwError(() => error);
            })
        );
    }

    bulkUpdateAssets(batchId: number, dto: BulkUpdateBatchAssetsDto): Observable<APIOperationResponse<boolean>> {
        return this.http.put<APIOperationResponse<boolean>>(`${this.baseUrl}/${batchId}/assets`, dto).pipe(
            catchError(error => {
                console.error('Error bulk updating assets:', error);
                return throwError(() => error);
            })
        );
    }

    delete(id: number): Observable<APIOperationResponse<void>> {
        return this.http.delete<APIOperationResponse<void>>(`${this.baseUrl}/${id}`).pipe(
            catchError(error => {
                console.error('Error deleting batch:', error);
                return throwError(() => error);
            })
        );
    }

    removeAssetFromBatch(batchId: number, assetId: number): Observable<APIOperationResponse<boolean>> {
        return this.http.delete<APIOperationResponse<boolean>>(`${this.baseUrl}/${batchId}/assets/${assetId}`).pipe(
            catchError(error => {
                console.error('Error removing asset from batch:', error);
                return throwError(() => error);
            })
        );
    }

}
