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
  usageDateFrom: string;
  usageTimeFrom: string;
  usageDateTo: string;
  usageTimeTo: string;
  usageLocation: string;
  orderPriority: string;
  numberOfOfficers: number | null;
  numberOfOtherRanks: number | null;
  requesterComments: string;
  fromReserve: string;
  departmentId: number;
  defaultRequestPurposeId: number;
  defaultRequestTypeId: number;
  orderType: string;
  files?: File[];
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
  workflowStepId?: number | null;
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
  ) { }

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

    if (!data.usageDateFrom) {
      return {
        isValid: false,
        error: 'Usage date from is required.'
      };
    }


    if (data.usageTimeFrom === null || data.usageTimeFrom === undefined ||
      (typeof data.usageTimeFrom === 'string' && data.usageTimeFrom.trim().length === 0)) {
      return {
        isValid: false,
        error: 'Usage time from is required.'
      };
    }

    if (!data.usageDateTo) {
      return {
        isValid: false,
        error: 'Usage date to is required.'
      };
    }

    // Validate usageTimeTo - "0000" is a valid military time
    if (data.usageTimeTo === null || data.usageTimeTo === undefined ||
      (typeof data.usageTimeTo === 'string' && data.usageTimeTo.trim().length === 0)) {
      return {
        isValid: false,
        error: 'Usage time to is required.'
      };
    }

    if (!data.orderPriority) {
      return {
        isValid: false,
        error: 'Order priority is required.'
      };
    }

    if (!data.requesterComments || data.requesterComments.trim().length === 0) {
      return {
        isValid: false,
        error: 'Comments are required.'
      };
    }

    return { isValid: true };
  }

  /**
   * Builds the order payload from submission data
   */
  buildOrderPayload(data: OrderSubmissionData): CreateOrderRequest {
    const usageDateTimeFrom = this.combineDateAndTime(data.usageDateFrom, data.usageTimeFrom);
    const usageDateTimeTo = this.combineDateAndTime(data.usageDateTo, data.usageTimeTo);

    const requestItems = data.selectedEntries.map(entry => ({
      itemId: entry.id,
      quantity: entry.quantity,
      notes: ''
    }));

    const orderNumber = this.generateOrderNumber();

    // Helper to handle empty strings and fallback to default values
    const getValueOrDefault = (value: any, defaultValue: string): string => {
      return (value && value.trim()) ? value.trim() : defaultValue;
    };

    return {
      orderNo: orderNumber,
      requestNo: orderNumber,
      reason: getValueOrDefault(data.usePurpose, data.orderType || 'New Order Issue'),
      notes: getValueOrDefault(data.requesterComments, ''),
      departmentId: data.departmentId,
      requestTypeId: data.defaultRequestTypeId,
      requesterId: null,
      recieverId: null,
      depotId: null,
      requestPurposeId: data.selectedRequestPurposeId ?? data.defaultRequestPurposeId,
      isFromAllowance: data.fromReserve === 'Yes',
      usageDateFrom: usageDateTimeFrom.toISOString(),
      usageTimeFrom: this.formatTimeOnly(data.usageTimeFrom),
      usageDateTo: usageDateTimeTo.toISOString(),
      usageTimeTo: this.formatTimeOnly(data.usageTimeTo),
      usagePurpose: getValueOrDefault(data.usePurpose, 'General usage'),
      annualDiscard: null,
      usageLocation: getValueOrDefault(data.usageLocation, 'N/A'),
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
  submitOrder(payload: CreateOrderRequest, files?: File[]): Observable<OrderSubmissionResult> {
    return this.orderService.createOrder(payload, files).pipe(
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
   * Handles military time format (HHMM) and legacy format (HH:mm)
   */
  private combineDateAndTime(dateStr: string, timeStr: string): Date {
    const datePart = dateStr || new Date().toISOString().substring(0, 10);
    let timePart = '00:00';

    if (timeStr) {
      // Handle military format (HHMM - 4 digits)
      if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
        const hours = timeStr.substring(0, 2);
        const minutes = timeStr.substring(2, 4);
        timePart = `${hours}:${minutes}`;
      }
      // Handle legacy format (HH:mm - 5 characters)
      else if (timeStr.length >= 5 && timeStr.includes(':')) {
        timePart = timeStr.substring(0, 5);
      }
    }

    const isoString = `${datePart}T${timePart}:00`;
    return new Date(isoString);
  }

  /**
   * Formats a time string to HH:mm:ss format for .NET TimeOnly parsing
   * Handles both military format (HHMM) and legacy format (HH:mm)
   */
  private formatTimeOnly(timeStr: string): string {
    if (!timeStr) {
      return '00:00:00';
    }

    // Military format (HHMM - 4 digits) - convert to HH:mm:ss
    if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
      const hours = timeStr.substring(0, 2);
      const minutes = timeStr.substring(2, 4);
      return `${hours}:${minutes}:00`;
    }

    // Legacy format (HH:mm) - convert to HH:mm:ss
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1] ? parts[1].padStart(2, '0') : '00';
      const seconds = parts[2] ? parts[2].padStart(2, '0') : '00';
      return `${hours}:${minutes}:${seconds}`;
    }

    // Default fallback
    return '00:00:00';
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
   * Backend RequestPriority enum: Normal = 1, Urgent = 2, VeryUrgent = 3
   */
  private mapPriorityToEnum(priorityLabel: string): number {
    const normalized = (priorityLabel || '').toLowerCase().replace(/\s+/g, '');
    if (normalized.includes('normal')) return 1;
    if (normalized.includes('urgent') && normalized.includes('very')) return 3;
    if (normalized.includes('veryurgent')) return 3;
    if (normalized.includes('urgent')) return 2;
    return 2; // default to Urgent
  }
}

