import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

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
    private readonly basePath = '/AssetHistory';

    constructor(private apiService: ApiService) { }

    getByAssetId(assetId: number): Observable<AssetHistoryDto[]> {
        return this.apiService.get<AssetHistoryDto[]>(`${this.basePath}/asset/${assetId}`);
    }

    getByOrderId(orderId: number): Observable<AssetHistoryDto[]> {
        return this.apiService.get<AssetHistoryDto[]>(`${this.basePath}/order/${orderId}`);
    }

    getBySupplyId(supplyId: number): Observable<AssetHistoryDto[]> {
        return this.apiService.get<AssetHistoryDto[]>(`${this.basePath}/supply/${supplyId}`);
    }

    getByActionType(actionType: number, fromDate?: string, toDate?: string): Observable<AssetHistoryDto[]> {
        let params = new HttpParams();
        if (fromDate) params = params.set('fromDate', fromDate);
        if (toDate) params = params.set('toDate', toDate);

        return this.apiService.get<AssetHistoryDto[]>(`${this.basePath}/action-type/${actionType}`, params);
    }
}
