import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';

export enum OrderItemActionType {
    Added = 1,
    QuantityModified = 2,
    Deleted = 3,
    FinalApproved = 4,
    Supplied = 5,
    AssetSupplied = 6
}

export interface OrderItemHistoryDto {
    id: number;
    orderId: number;
    orderRequestNo?: string;
    requestItemId?: number;
    itemId: number;
    itemName?: string;
    itemNo?: string;
    actionType: OrderItemActionType;
    actionDate: string;
    orderStatus: number;
    previousQuantity?: number;
    newQuantity?: number;
    approvedQuantity?: number;
    suppliedQuantity?: number;
    departmentId: number;
    departmentNameAr: string;
    departmentNameEn: string;
    modifiedByUserId: string;
    modifiedByUserName: string;
    modifiedByUserNameEn: string;
    modifiedByUserNameAr: string;
    workflowApprovalStepId?: number;
    workflowStepId?: number;
    workflowStepName?: string;
    description: string;
    notes?: string;
}

@Injectable({
    providedIn: 'root'
})
export class OrderItemTrackingService {
    private readonly endpoint = '/OrderItemTracking';

    constructor(private apiService: ApiService) { }

    /**
     * Get all history for an order
     */
    getOrderItemHistory(orderId?: number, requestNo?: string): Observable<OrderItemHistoryDto[]> {
        let params = new HttpParams();
        if (orderId) params = params.set('orderId', orderId.toString());
        if (requestNo) params = params.set('requestNo', requestNo);

        return this.apiService.get<OrderItemHistoryDto[]>(`${this.endpoint}/history`, params);
    }

    /**
     * Get history for a specific item in an order
     */
    getItemHistory(orderId: number, itemId: number): Observable<OrderItemHistoryDto[]> {
        return this.apiService.get<OrderItemHistoryDto[]>(`${this.endpoint}/history/${orderId}/items/${itemId}`);
    }

    /**
     * Get final approved quantities snapshot
     */
    getApprovedQuantities(orderId?: number, requestNo?: string): Observable<OrderItemHistoryDto[]> {
        let params = new HttpParams();
        if (orderId) params = params.set('orderId', orderId.toString());
        if (requestNo) params = params.set('requestNo', requestNo);

        return this.apiService.get<OrderItemHistoryDto[]>(`${this.endpoint}/approved-quantities`, params);
    }
}
