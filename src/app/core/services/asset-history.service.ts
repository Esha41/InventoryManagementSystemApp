import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { APIOperationResponse } from '@models/api-response.model';

export interface AssetHistoryDto {
    id: number;
    assetId: number;
    assetSerialNumber?: string;
    actionType: number;
    actionTypeName: string;
    actionDate: string;
    description: string;
    previousStatus?: number;
    previousStatusName?: string;
    newStatus?: number;
    newStatusName?: string;
    previousDepartmentId?: number;
    previousDepartmentName?: string;
    newDepartmentId?: number;
    newDepartmentName?: string;
    previousCustodianId?: string;
    previousCustodianName?: string;
    newCustodianId?: string;
    newCustodianName?: string;
    previousLocation?: string;
    newLocation?: string;
    orderId?: number;
    orderRequestNo?: string;
    assetSupplyId?: number;
    assetAssignmentId?: number;
    performedByUserId?: string;
    performedByUserName?: string;
    notes?: string;
    metadata?: string;
    creationDate: string;
}

@Injectable({
    providedIn: 'root'
})
export class AssetHistoryService {
    private apiUrl = `${environment.apiUrl}/AssetHistory`;

    constructor(private http: HttpClient) { }

    getByAssetId(assetId: number): Observable<AssetHistoryDto[]> {
        return this.http.get<APIOperationResponse<AssetHistoryDto[]>>(`${this.apiUrl}/asset/${assetId}`)
            .pipe(map(response => response.data));
    }

    getByOrderId(orderId: number): Observable<AssetHistoryDto[]> {
        return this.http.get<APIOperationResponse<AssetHistoryDto[]>>(`${this.apiUrl}/order/${orderId}`)
            .pipe(map(response => response.data));
    }

    getBySupplyId(supplyId: number): Observable<AssetHistoryDto[]> {
        return this.http.get<APIOperationResponse<AssetHistoryDto[]>>(`${this.apiUrl}/supply/${supplyId}`)
            .pipe(map(response => response.data));
    }

    getByActionType(actionType: number, fromDate?: string, toDate?: string): Observable<AssetHistoryDto[]> {
        let params = new HttpParams();
        if (fromDate) params = params.set('fromDate', fromDate);
        if (toDate) params = params.set('toDate', toDate);

        return this.http.get<APIOperationResponse<AssetHistoryDto[]>>(`${this.apiUrl}/action-type/${actionType}`, { params })
            .pipe(map(response => response.data));
    }
}
