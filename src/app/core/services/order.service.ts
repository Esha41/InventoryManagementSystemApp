import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { APIOperationResponse } from '@models/api-response.model';

export interface CreateUpdateRequestItemDto {
  itemId: number;
  quantity: number;
  notes?: string;
}

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
  usageDateFrom: string;
  usageTimeFrom: string;
  usageDateTo: string;
  usageTimeTo: string;
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
  requestType: number | string; // Can be number (1, 2, 3) or string ('Order', 'Return', 'Discard')
  reason?: string;
  priority: number | string; // Can be number (1, 2, 3) or string ('High', 'Medium', 'Low')
  status: number | string; // Can be number (1, 2, 3, 4) or string ('New', 'UnderProcess', 'Approved', 'Rejected')
  notes?: string;
  departmentId: number;
  requesterId?: string | null;
  recieverId?: string | null;
  depotId?: number | null;
  requestPurposeId: number;
  isFromAllowance: boolean;
  usageDateFrom?: string;
  usageTimeFrom?: string;
  usageDateTo?: string;
  usageTimeTo?: string;
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
  creationDate?: string | Date;
  // Nested objects for localization (similar to ReturnDto and DiscardDto)
  department?: {
    id: number;
    code: string;
    nameAr: string;
    nameEn: string;
    isDeleted: boolean;
  };
  requester?: {
    id: string;
    userName: string;
    fullNameEN: string;
    fullNameAR: string;
    militoryId?: string | null;
    email?: string;
    rank?: any;
    department?: any;
  };
  requestPurpose?: {
    id: number;
    nameAr: string;
    nameEn: string;
    requestType: number;
  };
}

export interface OrderStatusSummaryItem {
  status: number;
  count?: number;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) { }

  private get baseUrl(): string {
    return `${this.config.apiUrl}/Order`;
  }

  createOrder(payload: CreateOrderRequest, files?: File[]): Observable<APIOperationResponse<number>> {
    this.config.log('Creating order', payload);

    // Always send as FormData (multipart/form-data) to match backend expectations
    const formData = new FormData();

    // Append DTO fields matching backend CreateOrderDto structure
    if (payload.reason) formData.append('Reason', payload.reason);
    formData.append('Priority', payload.priority.toString());
    if (payload.notes) formData.append('Notes', payload.notes);
    formData.append('RequestPurposeId', payload.requestPurposeId.toString());
    formData.append('IsFromAllowance', payload.isFromAllowance.toString());
    formData.append('UsageDateFrom', payload.usageDateFrom);
    formData.append('UsageTimeFrom', payload.usageTimeFrom);
    formData.append('UsageDateTo', payload.usageDateTo);
    formData.append('UsageTimeTo', payload.usageTimeTo);
    if (payload.usagePurpose) formData.append('UsagePurpose', payload.usagePurpose);
    if (payload.annualDiscard !== null && payload.annualDiscard !== undefined) {
      formData.append('AnnualDiscard', payload.annualDiscard.toString());
    }
    if (payload.usageLocation) formData.append('UsageLocation', payload.usageLocation);
    if (payload.numberOfOfficer !== null && payload.numberOfOfficer !== undefined) {
      formData.append('NumberOfOfficer', payload.numberOfOfficer.toString());
    }
    if (payload.numberOfOtherRank !== null && payload.numberOfOtherRank !== undefined) {
      formData.append('NumberOfOtherRank', payload.numberOfOtherRank.toString());
    }

    // Append RequestItems array - ASP.NET Core expects indexed notation for arrays
    if (payload.requestItems && payload.requestItems.length > 0) {
      payload.requestItems.forEach((item, index) => {
        formData.append(`RequestItems[${index}].ItemId`, item.itemId.toString());
        formData.append(`RequestItems[${index}].Quantity`, item.quantity.toString());
        if (item.notes) {
          formData.append(`RequestItems[${index}].Notes`, item.notes);
        }
      });
    }

    // Append files if provided
    if (files && files.length > 0) {
      files.forEach(file => {
        formData.append('files', file);
      });
    }

    // Get auth token and set headers
    const token = localStorage.getItem('auth_token');
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Don't set Content-Type - browser will set it with boundary for FormData

    return this.http.post<APIOperationResponse<number>>(this.baseUrl, formData, { headers }).pipe(
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
    // Add cache-busting headers to ensure fresh data
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    return this.http.get<APIOperationResponse<OrderDto>>(`${this.baseUrl}/${id}`, { headers }).pipe(
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

  /**
   * Returns a lightweight summary of orders by status for the current user scope.
   * Backend endpoint: GET {baseUrl}/summary
   */
  getOrderSummary(): Observable<OrderStatusSummaryItem[]> {
    this.config.log('Fetching order summary');
    return this.http.get<APIOperationResponse<OrderStatusSummaryItem[]>>(`${this.baseUrl}/summary`).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch order summary');
        }
        return response.data ?? [];
      }),
      catchError(error => {
        this.config.logError('Failed to fetch order summary', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Verify if requested quantity is available in allowance
   * Backend endpoint: GET /api/Order/verify-allowance?itemId={itemId}&requestedQuantity={quantity}
   */
  verifyAllowance(itemId: number, requestedQuantity: number): Observable<{ availableQuantity: number; isValid: boolean; message?: string }> {
    this.config.log(`Verifying allowance for item ${itemId}, quantity ${requestedQuantity}`);
    const params = new HttpParams()
      .set('itemId', itemId.toString())
      .set('requestedQuantity', requestedQuantity.toString());

    return this.http.get<any>(`${this.baseUrl}/verify-allowance`, { params }).pipe(
      map(response => {
        // Handle different response structures
        const availableQuantity = response?.availableQuantity ?? response?.data?.availableQuantity ?? 0;
        const isValid = requestedQuantity <= availableQuantity;

        return {
          availableQuantity,
          isValid,
          message: response?.message
        };
      }),
      catchError(error => {
        this.config.logError('Failed to verify allowance', error);
        // Extract error message if available
        const errorMessage = error?.error?.message || error?.message || 'Failed to verify allowance';
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Add a new item to an existing order
   * Backend endpoint: POST {baseUrl}/{orderId}/items
   */
  addOrderItem(orderId: number, itemDto: CreateUpdateRequestItemDto): Observable<APIOperationResponse<number>> {
    this.config.log(`Adding item to order ${orderId}`, itemDto);
    return this.http.post<APIOperationResponse<number>>(`${this.baseUrl}/${orderId}/items`, itemDto).pipe(
      catchError(error => {
        this.config.logError(`Failed to add item to order ${orderId}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update the quantity of an existing order item
   * Backend endpoint: PUT {baseUrl}/{orderId}/items/{itemId}/quantity
   */
  updateOrderItemQuantity(orderId: number, itemId: number, newQuantity: number): Observable<APIOperationResponse<boolean>> {
    this.config.log(`Updating item ${itemId} quantity in order ${orderId}`, { newQuantity });
    return this.http.put<APIOperationResponse<boolean>>(`${this.baseUrl}/${orderId}/items/${itemId}/quantity`, newQuantity).pipe(
      catchError(error => {
        this.config.logError(`Failed to update item ${itemId} quantity in order ${orderId}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete an item from an order
   * Backend endpoint: DELETE {baseUrl}/{orderId}/items/{itemId}
   */
  deleteOrderItem(orderId: number, itemId: number): Observable<APIOperationResponse<boolean>> {
    this.config.log(`Deleting item ${itemId} from order ${orderId}`);
    return this.http.delete<APIOperationResponse<boolean>>(`${this.baseUrl}/${orderId}/items/${itemId}`).pipe(
      catchError(error => {
        this.config.logError(`Failed to delete item ${itemId} from order ${orderId}`, error);
        return throwError(() => error);
      })
    );
  }
}


