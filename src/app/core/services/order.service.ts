import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { CreateOrderDto, OrderDto, OrderStatusSummaryItem } from '@models/order.model';
import { CreateRequestItemDto } from '@models/request-item.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly endpoint = '/Order';

  constructor(
    private apiService: ApiService,
    private config: ConfigService
  ) { }

  createOrder(payload: CreateOrderDto, files?: File[]): Observable<APIOperationResponse<number>> {
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

    // Use postRaw to return the wrapped response as expected by the caller return type
    return this.apiService.postRaw<number>(this.endpoint, formData);
  }

  getAllOrders(): Observable<OrderDto[]> {
    this.config.log('Fetching all orders');
    return this.apiService.get<OrderDto[]>(this.endpoint);
  }

  getOrderById(id: number): Observable<OrderDto> {
    this.config.log(`Fetching order ${id}`);
    const headers = new HttpHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    return this.apiService.get<OrderDto>(`${this.endpoint}/${id}`, undefined, { headers }).pipe(
      map((order: OrderDto) => {
        // Normalize nested object property names
        if ((order as any).Department && !order.department) {
          order.department = (order as any).Department;
        }
        if ((order as any).Requester && !order.requester) {
          order.requester = (order as any).Requester;
        }
        if ((order as any).RequestPurpose && !order.requestPurpose) {
          order.requestPurpose = (order as any).RequestPurpose;
        }

        // Populate flat properties
        if (order.department) {
          if (!order.departmentNameEn && order.department.nameEn) {
            order.departmentNameEn = order.department.nameEn;
          }
          if (!order.departmentNameAr && order.department.nameAr) {
            order.departmentNameAr = order.department.nameAr;
          }
        }

        if (order.requester) {
          if (!order.requesterName) {
            order.requesterName = order.requester.fullNameEN ||
              order.requester.fullNameAR ||
              order.requester.userName;
          }
          // ... other assignments ...
          if (!order.requesterNameEn && order.requester.fullNameEN) {
            order.requesterNameEn = order.requester.fullNameEN;
          }
          if (!order.requesterNameAr && order.requester.fullNameAR) {
            order.requesterNameAr = order.requester.fullNameAR;
          }
        }

        if (order.requestPurpose) {
          if (!order.requestPurposeNameEn && order.requestPurpose.nameEn) {
            order.requestPurposeNameEn = order.requestPurpose.nameEn;
          }
          if (!order.requestPurposeNameAr && order.requestPurpose.nameAr) {
            order.requestPurposeNameAr = order.requestPurpose.nameAr;
          }
        }

        return order;
      })
    );
  }

  getOrderSummary(): Observable<OrderStatusSummaryItem[]> {
    this.config.log('Fetching order summary');
    return this.apiService.get<OrderStatusSummaryItem[]>(`${this.endpoint}/summary`);
  }

  verifyAllowance(itemId: number, requestedQuantity: number): Observable<{ availableQuantity: number; isValid: boolean; message?: string }> {
    this.config.log(`Verifying allowance for item ${itemId}, quantity ${requestedQuantity}`);
    const params = new HttpParams()
      .set('itemId', itemId.toString())
      .set('requestedQuantity', requestedQuantity.toString());

    return this.apiService.get<any>(`${this.endpoint}/verify-allowance`, params).pipe(
      map(data => {
        const availableQuantity = data?.availableQuantity ?? data?.data?.availableQuantity ?? 0;
        const isValid = requestedQuantity <= availableQuantity;
        return {
          availableQuantity,
          isValid,
          message: data?.message
        };
      })
    );
  }

  addOrderItem(orderId: number, itemDto: CreateRequestItemDto): Observable<APIOperationResponse<number>> {
    this.config.log(`Adding item to order ${orderId}`, itemDto);
    return this.apiService.postRaw<number>(`${this.endpoint}/${orderId}/items`, itemDto);
  }

  updateOrderItemQuantity(orderId: number, itemId: number, newQuantity: number): Observable<APIOperationResponse<boolean>> {
    this.config.log(`Updating item ${itemId} quantity in order ${orderId}`, { newQuantity });
    return this.apiService.putRaw<boolean>(`${this.endpoint}/${orderId}/items/${itemId}/quantity`, newQuantity);
  }

  deleteOrderItem(orderId: number, itemId: number): Observable<APIOperationResponse<boolean>> {
    this.config.log(`Deleting item ${itemId} from order ${orderId}`);
    return this.apiService.deleteRaw<boolean>(`${this.endpoint}/${orderId}/items/${itemId}`);
  }
}


