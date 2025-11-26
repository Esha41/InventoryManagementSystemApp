import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { OrderService, CreateOrderRequest, OrderDto } from './order.service';
import { ErrorHandlingService } from './error-handling.service';
import { APIOperationResponse } from '@models/api-response.model';
import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';
import { parseOptionalInteger } from '@utils/number.utils';

export interface OrderSubmissionData {
  selectedEntries: Array<{ id: number; quantity: number }>;
  selectedRequestPurposeId: number | null;
  usePurpose: string;
  usageDate: string;
  usageTime: string;
  usageLocation: string;
  orderPriority: string;
  annualDiscardSpecialOps: string;
  numberOfOfficers: number | null;
  numberOfOtherRanks: number | null;
  requesterComments: string;
  fromReserve: string;
  departmentId: number;
  defaultRequestPurposeId: number;
  defaultRequestTypeId: number;
  orderType: string;
}

export interface OrderValidationResult {
  isValid: boolean;
  error?: string;
}

export interface OrderSubmissionResult {
  success: boolean;
  orderId?: number | null;
  orderNumber?: string;
  error?: string;
}

/**
 * Order Submission Service
 * Handles order validation, payload building, and submission
 */
@Injectable({
  providedIn: 'root'
})
export class OrderSubmissionService {
  constructor(
    private orderService: OrderService,
    private errorHandlingService: ErrorHandlingService
  ) {}

  /**
   * Validates order data before submission
   */
  validateOrder(data: OrderSubmissionData): OrderValidationResult {
    if (data.selectedEntries.length === 0) {
      return {
        isValid: false,
        error: 'Please select at least one cartridge before submitting the order.'
      };
    }

    const invalidItem = data.selectedEntries.find(
      entry => !entry.id || entry.id <= 0 || entry.quantity <= 0
    );
    if (invalidItem) {
      return {
        isValid: false,
        error: 'Selected cartridge is missing required information.'
      };
    }

    if (data.selectedRequestPurposeId === null) {
      return {
        isValid: false,
        error: 'Usage purpose is required.'
      };
    }

    if (!data.usageLocation) {
      return {
        isValid: false,
        error: 'Usage location is required.'
      };
    }

    if (!data.usageDate) {
      return {
        isValid: false,
        error: 'Usage date is required.'
      };
    }

    if (!data.usageTime) {
      return {
        isValid: false,
        error: 'Usage time is required.'
      };
    }

    if (!data.orderPriority) {
      return {
        isValid: false,
        error: 'Order priority is required.'
      };
    }

    return { isValid: true };
  }

  /**
   * Builds the order payload from submission data
   */
  buildOrderPayload(data: OrderSubmissionData): CreateOrderRequest {
    const usageDateTime = this.combineDateAndTime(data.usageDate, data.usageTime);
    const requestItems = data.selectedEntries.map(entry => ({
      itemId: entry.id,
      quantity: entry.quantity,
      notes: ''
    }));

    const orderNumber = this.generateOrderNumber();

    return {
      orderNo: orderNumber,
      requestNo: orderNumber,
      reason: data.usePurpose || data.orderType || 'New Order Issue',
      notes: data.requesterComments || '',
      departmentId: data.departmentId,
      requestTypeId: data.defaultRequestTypeId,
      requesterId: null,
      recieverId: null,
      depotId: null,
      requestPurposeId: data.selectedRequestPurposeId ?? data.defaultRequestPurposeId,
      isFromAllowance: data.fromReserve === 'Yes',
      usageDate: usageDateTime.toISOString(),
      usageTime: this.formatUsageTime(usageDateTime),
      usagePurpose: data.usePurpose || 'General usage',
      annualDiscard: parseOptionalInteger(data.annualDiscardSpecialOps),
      usageLocation: data.usageLocation || 'N/A',
      numberOfOfficer: data.numberOfOfficers ?? null,
      numberOfOtherRank: data.numberOfOtherRanks ?? null,
      priority: this.mapPriorityToEnum(data.orderPriority),
      requestItems
    };
  }

  /**
   * Submits an order
   * Uses RxJS operators to chain observables properly (no nested subscribes)
   */
  submitOrder(payload: CreateOrderRequest): Observable<OrderSubmissionResult> {
    return this.orderService.createOrder(payload).pipe(
      switchMap((response: APIOperationResponse<number>) => {
        if (!response?.succeeded) {
          const errorMessage = this.errorHandlingService.resolveOrderSubmissionError(
            response,
            undefined
          );
          return of({
            success: false,
            error: errorMessage
          } as OrderSubmissionResult);
        }

        const createdOrderId = response.data;
        if (!createdOrderId) {
          return of({
            success: false,
            error: 'Order created but no ID returned'
          } as OrderSubmissionResult);
        }

        // Fetch the full order to get the correct ID and order number
        return this.orderService.getOrderById(createdOrderId).pipe(
          map((order: OrderDto): OrderSubmissionResult => ({
            success: true,
            orderId: order.id,
            orderNumber: order.requestNo || order.orderNo || payload.orderNo
          })),
          catchError(() => {
            // Fallback to response data if fetching order fails
            return of({
              success: true,
              orderId: createdOrderId,
              orderNumber: payload.orderNo
            } as OrderSubmissionResult);
          })
        );
      }),
      catchError((error: unknown) => {
        const errorMessage = this.errorHandlingService.resolveOrderSubmissionError(
          undefined,
          error
        );
        return of({
          success: false,
          error: errorMessage
        } as OrderSubmissionResult);
      })
    );
  }

  /**
   * Generates a unique order number
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now();
    return `ORD-${timestamp}`;
  }

  /**
   * Combines date and time strings into a Date object
   */
  private combineDateAndTime(dateStr: string, timeStr: string): Date {
    const datePart = dateStr || new Date().toISOString().substring(0, 10);
    const timePart = (timeStr && timeStr.length >= 5) ? timeStr : '00:00';
    const isoString = `${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`;
    return new Date(isoString);
  }

  /**
   * Formats a Date object to HH:mm:ss format
   */
  private formatUsageTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }


  /**
   * Maps priority label to enum value
   * Backend RequestPriority enum: High = 1, Medium = 2, Low = 3
   */
  private mapPriorityToEnum(priorityLabel: string): number {
    const normalized = (priorityLabel || '').toLowerCase();
    if (normalized.includes('high')) return 1; 
    if (normalized.includes('medium')) return 2; 
    if (normalized.includes('low')) return 3; 
    return 3; // default to Low
  }
}

