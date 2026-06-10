import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '@services/api.service';

export interface AssetHistoryDto {
    id: number;
    assetId: number;
    assetSerialNumber?: string;
    batchNumber?: string;

    actionType: number;
    actionDate: string;

    previousStatus?: number;
    newStatus?: number;

    previousDepartmentId?: number;
    previousDepartmentName?: string;
    previousDepartmentNameAr?: string;
    newDepartmentId?: number;
    newDepartmentName?: string;
    newDepartmentNameAr?: string;

    previousCustodianId?: number;
    previousCustodianName?: string;
    previousCustodianNameAr?: string;
    newCustodianId?: number;
    newCustodianName?: string;
    newCustodianNameAr?: string;

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
