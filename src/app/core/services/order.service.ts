import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { APIOperationResponse } from '@models/api-response.model';

export interface CreateOrderRequest {
  orderNo: string;
  requestNo: string;
  reason: string;
  priority: number;
  notes?: string;
  departmentId: number;
  requestTypeId?: number | null;
  requesterId?: string | null;
  recieverId?: string | null;
  depotId?: number | null;
  requestPurposeId: number;
  isFromAllowance: boolean;
  usageDate: string;
  usageTime: string;
  usagePurpose: string;
  annualDiscard?: number | null;
  usageLocation: string;
  numberOfOfficer?: number | null;
  numberOfOtherRank?: number | null;
  requestItems: Array<{
    itemId: number;
    quantity: number;
    notes?: string;
  }>;
}

export interface OrderRequestItemDto {
  id: number;
  itemId: number;
  quantity: number;
  notes?: string;
  itemName?: string;
  itemNo?: string;
  itemType?: number;
}

export interface OrderDto {
  id: number;
  requestNo?: string;
  orderNo: string;
  requestType: number;
  reason?: string;
  priority: number;
  status: number;
  notes?: string;
  departmentId: number;
  requesterId?: string | null;
  recieverId?: string | null;
  depotId?: number | null;
  requestPurposeId: number;
  isFromAllowance: boolean;
  usageDate?: string;
  usageTime?: string;
  usagePurpose?: string;
  annualDiscard?: number | null;
  usageLocation?: string;
  numberOfOfficer?: number | null;
  numberOfOtherRank?: number | null;
  departmentNameAr?: string;
  departmentNameEn?: string;
  requesterName?: string;
  recieverName?: string;
  depotNameAr?: string;
  depotNameEn?: string;
  requestPurposeNameAr?: string;
  requestPurposeNameEn?: string;
  requestItems?: OrderRequestItemDto[];
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) {}

  private get baseUrl(): string {
    return `${this.config.apiUrl}/Order`;
  }

  createOrder(payload: CreateOrderRequest): Observable<APIOperationResponse<number>> {
    this.config.log('Creating order', payload);
    return this.http.post<APIOperationResponse<number>>(this.baseUrl, payload).pipe(
      catchError(error => {
        this.config.logError('Failed to create order', error);
        return throwError(() => error);
      })
    );
}

  getAllOrders(): Observable<OrderDto[]> {
    this.config.log('Fetching all orders');
    return this.http.get<APIOperationResponse<OrderDto[]>>(this.baseUrl).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch orders');
        }
        return response.data ?? [];
      }),
      catchError(error => {
        this.config.logError('Failed to fetch orders', error);
        return throwError(() => error);
      })
    );
  }

  getOrderById(id: number): Observable<OrderDto> {
    this.config.log(`Fetching order ${id}`);
    return this.http.get<APIOperationResponse<OrderDto>>(`${this.baseUrl}/${id}`).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to fetch order details');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError(`Failed to fetch order ${id}`, error);
        return throwError(() => error);
      })
    );
  }
}


