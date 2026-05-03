import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { CreateRequestItemDto } from '@models/request-item.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ConfigService } from '@services/config.service';
import { OrderItemManagementService } from './order-item-management.service';

export type SupplyRequestItemMutationOutcome = 'success' | 'failure';

/**
 * Order-line CRUD orchestration — toasts + error mapping parity with SupplyRequestDetailComponent.
 */
@Injectable({ providedIn: 'root' })
export class SupplyRequestCatalogItemFacade {
  constructor(
    private readonly orderItemManagementService: OrderItemManagementService,
    private readonly translate: TranslateService,
    private readonly config: ConfigService
  ) {}

  addCatalogItem(orderId: number, dto: CreateRequestItemDto): Observable<SupplyRequestItemMutationOutcome> {
    return this.orderItemManagementService.addItem(orderId, dto).pipe(
      map((response) => {
        if (response.succeeded) {
          this.orderItemManagementService.showSuccessMessage('supplyRequestDetail.itemAddedSuccessfully');
          return 'success' as const;
        }
        const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(
          response,
          'Failed to add item',
          this.translate
        );
        this.orderItemManagementService.showErrorMessage(
          'supplyRequestDetail.failedToAddItem',
          errorMessage
        );
        return 'failure' as const;
      }),
      catchError((error) => {
        this.config.logError('Failed to add item', error);
        const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(error, 'Failed to add item', this.translate);
        this.orderItemManagementService.showErrorMessage('supplyRequestDetail.failedToAddItem', errorMessage);
        return of('failure' as const);
      })
    );
  }

  updateItemQuantity(orderId: number, requestItemId: number, quantity: number): Observable<SupplyRequestItemMutationOutcome> {
    return this.orderItemManagementService.updateItemQuantity(orderId, requestItemId, quantity).pipe(
      map((response) => {
        if (response.succeeded) {
          this.orderItemManagementService.showSuccessMessage(
            'supplyRequestDetail.itemQuantityUpdatedSuccessfully'
          );
          return 'success' as const;
        }
        this.orderItemManagementService.showErrorMessage(
          'supplyRequestDetail.failedToUpdateItemQuantity',
          response.message
        );
        return 'failure' as const;
      }),
      catchError((error) => {
        this.config.logError('Failed to update item quantity', error);
        const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(
          error,
          'Failed to update item quantity',
          this.translate
        );
        this.orderItemManagementService.showErrorMessage(
          'supplyRequestDetail.failedToUpdateItemQuantity',
          errorMessage
        );
        return of('failure' as const);
      })
    );
  }

  removeItem(orderId: number, requestItemId: number): Observable<SupplyRequestItemMutationOutcome> {
    return this.orderItemManagementService.removeItem(orderId, requestItemId).pipe(
      map((response) => {
        if (response.succeeded) {
          this.orderItemManagementService.showSuccessMessage('supplyRequestDetail.itemRemovedSuccessfully');
          return 'success' as const;
        }
        this.orderItemManagementService.showErrorMessage('supplyRequestDetail.failedToRemoveItem', response.message);
        return 'failure' as const;
      }),
      catchError((error) => {
        this.config.logError('Failed to remove item', error);
        this.orderItemManagementService.showErrorMessage('supplyRequestDetail.failedToRemoveItem');
        return of('failure' as const);
      })
    );
  }
}
