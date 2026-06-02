import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { OrderService } from './order.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { APIOperationResponse } from '@models/api-response.model';
import { CreateOrderDto, OrderDto } from '@models/order.model';
import type { WeaponAssociation } from '@models/request-item.model';
import { formatDateForInput } from '@core/utils/format.utils';
import {
  USAGE_DATE_TO_ON_OR_AFTER_FROM_KEY,
  normalizeUsageDateYmd,
  validateUsageDateTimeRange
} from '@core/utils/usage-datetime.utils';

export interface OrderSubmissionData {
  selectedEntries: Array<{ id: number; quantity: number; itemType?: string }>;
  selectedRequestPurposeId: number | null;
  usePurpose: string;
  requestPurposeNotes: string;
  usageDateFrom: string;
  usageTimeFrom: string;
  usageDateTo: string;
  usageTimeTo: string;
  usageLocation: string;
  numberOfOfficers: number | null;
  numberOfOtherRanks: number | null;
  requesterComments: string;
  fromReserve: string;
  departmentId: number;
  defaultRequestPurposeId: number;
  defaultRequestTypeId: number;
  orderType: string;
  /**
   * Files grouped per AttachmentRequirementId (the new slotted upload model).
   * Keep alongside otherFiles for the entity-only "extras" bucket.
   */
  attachmentUploads?: Map<number, File[]>;
  otherFiles?: File[];
  /**
   * Order-level files for the WEAPON_ASSOCIATION system slot. Required by the
   * backend when any ammunition line uses a non-catalog weapon.
   */
  weaponAssociationFiles?: File[];
  weaponAssociations?: Map<number, WeaponAssociation[]>;
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
  constructor(private orderService: OrderService) { }

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

    if (!this.isDateOnOrAfterToday(data.usageDateFrom)) {
      return {
        isValid: false,
        error: 'newIssueRequest.validation.usageDateFromMustBeTodayOrFuture'
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

    if (!this.isDateOnOrAfterToday(data.usageDateTo)) {
      return {
        isValid: false,
        error: 'newIssueRequest.validation.usageDateToMustBeTodayOrFuture'
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

    const usageDateRange = validateUsageDateTimeRange(
      data.usageDateFrom,
      data.usageTimeFrom,
      data.usageDateTo,
      data.usageTimeTo
    );
    if (usageDateRange === 'invalid') {
      return {
        isValid: false,
        error: USAGE_DATE_TO_ON_OR_AFTER_FROM_KEY
      };
    }

    return { isValid: true };
  }

  /**
   * Builds the order payload from submission data
   */
  buildOrderPayload(data: OrderSubmissionData): CreateOrderDto {
    // Send calendar dates as YYYY-MM-DD; times are sent separately to avoid UTC shift from toISOString().
    const usageDateFrom = normalizeUsageDateYmd(data.usageDateFrom) ?? data.usageDateFrom;
    const usageDateTo = normalizeUsageDateYmd(data.usageDateTo) ?? data.usageDateTo;

    const requestItems = data.selectedEntries.map(entry => {
      const isAmmo = entry.itemType === 'Ammunition';
      const associations =
        isAmmo && data.weaponAssociations
          ? data.weaponAssociations.get(entry.id) ?? []
          : [];

      const weaponAssociations =
        !isAmmo || associations.length === 0
          ? []
          : associations.map(row => ({
              associatedWeaponItemId:
                row.type === 'catalog' ? row.weaponItemId ?? null : null,
              associatedWeaponOtherName:
                row.type === 'other' ? (row.otherName ?? '').trim() || null : null,
              associatedWeaponCaliberId: row.caliberId ?? null
            }));

      return {
        itemId: entry.id,
        quantity: entry.quantity,
        notes: '',
        ...(weaponAssociations.length > 0 ? { weaponAssociations } : {})
      };
    });

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
      requestPurposeNotes: getValueOrDefault(data.requestPurposeNotes, ''),
      departmentId: data.departmentId,
      requestTypeId: data.defaultRequestTypeId,
      requesterId: null,
      recieverId: null,
      depotId: null,
      requestPurposeId: data.selectedRequestPurposeId ?? data.defaultRequestPurposeId,
      isFromAllowance: data.fromReserve === 'Yes',
      usageDateFrom,
      usageTimeFrom: this.formatTimeOnly(data.usageTimeFrom),
      usageDateTo,
      usageTimeTo: this.formatTimeOnly(data.usageTimeTo),
      usagePurpose: getValueOrDefault(data.usePurpose, 'General usage'),
      annualDiscard: null,
      usageLocation: getValueOrDefault(data.usageLocation, 'N/A'),
      numberOfOfficer: data.numberOfOfficers ?? null,
      numberOfOtherRank: data.numberOfOtherRanks ?? null,
      requestItems
    };
  }

  /**
   * Submits an order
   * Uses RxJS operators to chain observables properly (no nested subscribes)
   */
  submitOrder(
    payload: CreateOrderDto,
    attachmentUploads?: Map<number, File[]>,
    otherFiles?: File[],
    weaponAssociationFiles?: File[]
  ): Observable<OrderSubmissionResult> {
    return this.orderService.createOrder(payload, attachmentUploads, otherFiles, weaponAssociationFiles).pipe(
      switchMap((response: APIOperationResponse<number>) => {
        if (!response?.succeeded) {
          const errorMessage = ErrorHandler.resolveOrderSubmissionError(
            response,
            undefined,
            'Failed to submit order. Please try again.'
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
        const errorMessage = ErrorHandler.resolveOrderSubmissionError(
          undefined,
          error,
          'Failed to submit order. Please try again.'
        );
        return of({
          success: false,
          error: errorMessage
        } as OrderSubmissionResult);
      })
    );
  }

  /**
   * Checks if a date string is today or in the future (date part only, local timezone).
   * Uses YYYY-MM-DD directly when present to avoid timezone shift from new Date() parsing.
   */
  private isDateOnOrAfterToday(dateStr: string): boolean {
    if (!dateStr?.trim()) return false;
    // Date input returns YYYY-MM-DD - use directly to avoid timezone shift (new Date("YYYY-MM-DD") = UTC midnight)
    const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const normalized = ymdMatch ? ymdMatch[0] : (formatDateForInput(dateStr) || dateStr.trim());
    if (!normalized) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return normalized >= todayStr;
  }

  /**
   * Generates a unique order number
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now();
    return `ORD-${timestamp}`;
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
}
