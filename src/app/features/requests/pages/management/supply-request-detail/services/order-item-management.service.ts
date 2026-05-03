/**
 * Order Item Management Service
 * Handles add, edit, and remove operations for order items
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { OrderService } from '@requests/services/order.service';
import { CreateRequestItemDto } from '@models/request-item.model';
import { APIOperationResponse } from '@models/api-response.model';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class OrderItemManagementService {
  constructor(
    private orderService: OrderService,
    private toastService: ToastService,
    private translate: TranslateService
  ) { }

  /**
   * Add new item to order
   */
  addItem(orderId: number, itemDto: CreateRequestItemDto): Observable<APIOperationResponse<number>> {
    return this.orderService.addOrderItem(orderId, itemDto);
  }

  /**
   * Update item quantity
   */
  updateItemQuantity(orderId: number, requestItemId: number, newQuantity: number): Observable<APIOperationResponse<boolean>> {
    return this.orderService.updateOrderItemQuantity(orderId, requestItemId, newQuantity);
  }

  /**
   * Remove item from order
   */
  removeItem(orderId: number, requestItemId: number): Observable<APIOperationResponse<boolean>> {
    return this.orderService.deleteOrderItem(orderId, requestItemId);
  }

  /**
   * Show success message for item operations
   */
  showSuccessMessage(key: string): void {
    this.translate
      .get([key, 'toast.success'])
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.success(translations[key], translations['toast.success']);
      });
  }

  /**
   * Show error message for item operations
   */
  showErrorMessage(key: string, messageOverride?: string): void {
    this.translate
      .get([key, 'toast.error'])
      .pipe(take(1))
      .subscribe(translations => {
        const message = messageOverride || translations[key] || 'Operation failed';
        this.toastService.error(message, translations['toast.error']);
      });
  }
}

