import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Notification, NotificationRequestDetail, NotificationDetailType, NotificationDetailResult } from '@notifications/models/notification.model';
import { OrderService } from '@requests/services/order.service';
import { ReturnService } from '@requests/services/return.service';
import { DiscardService } from '@requests/services/discard.service';
import { extractEntityIdFromMetadata, determineDetailType, handleDetailError } from '@notifications/utils/notification.utils';
import { TranslateService } from '@ngx-translate/core';
import { DiscardDto, OrderDto, ReturnDto } from '@models/index';

@Injectable({
  providedIn: 'root'
})
export class NotificationDetailService {
  constructor(
    private readonly orderService: OrderService,
    private readonly returnService: ReturnService,
    private readonly discardService: DiscardService,
    private readonly translateService: TranslateService
  ) { }

  /**
   * Resolves order / return / discard DTOs for email enrichment and other callers.
   * Single place for request-feature HTTP used from the notifications feature.
   */
  loadEntityDtoForEmail(
    entityType: string,
    entityId: number
  ): Observable<OrderDto | ReturnDto | DiscardDto | null> {
    const t = entityType.toLowerCase();
    switch (t) {
      case 'order':
        return this.orderService.getOrderById(entityId).pipe(catchError(() => of(null)));
      case 'return':
        return this.returnService.getReturnById(entityId).pipe(catchError(() => of(null)));
      case 'discard':
        return this.discardService.getDiscardById(entityId).pipe(catchError(() => of(null)));
      default:
        return of(null);
    }
  }

  /**
   * Load notification detail based on entity type
   */
  loadDetail(notification: Notification): Observable<NotificationDetailResult> {
    const entityId = notification.entityId ?? extractEntityIdFromMetadata(notification);
    const entityType = (notification.entityType ?? notification.type ?? '').toLowerCase();

    if (!entityType || entityId == null) {
      return of({
        type: null,
        detail: null,
        error: this.translateService.instant('notifications.details.unknown')
      });
    }

    const numericId = Number(entityId);
    if (Number.isNaN(numericId)) {
      return of({
        type: null,
        detail: null,
        error: this.translateService.instant('notifications.details.unknown')
      });
    }

    switch (entityType) {
      case 'order':
        return this.loadOrderDetail(numericId);
      case 'return':
        return this.loadReturnDetail(numericId);
      case 'discard':
        return this.loadDiscardDetail(numericId);
      case 'request':
      case 'workflow':
      case 'workflowapproval':
        return this.loadRequestDetail(numericId);
      default:
        return of({
          type: null,
          detail: null,
          error: this.translateService.instant('notifications.details.unknown')
        });
    }
  }

  /**
   * Load order detail
   */
  private loadOrderDetail(id: number): Observable<NotificationDetailResult> {
    return this.orderService.getOrderById(id).pipe(
      map(detail => ({
        type: 'order' as NotificationDetailType,
        detail: detail as NotificationRequestDetail,
        error: null
      })),
      catchError(error => of({
        type: null,
        detail: null,
        error: handleDetailError(error, this.translateService)
      }))
    );
  }

  /**
   * Load return detail
   */
  private loadReturnDetail(id: number): Observable<NotificationDetailResult> {
    return this.returnService.getReturnById(id).pipe(
      map(detail => ({
        type: 'return' as NotificationDetailType,
        detail: detail as NotificationRequestDetail,
        error: null
      })),
      catchError(error => of({
        type: null,
        detail: null,
        error: handleDetailError(error, this.translateService)
      }))
    );
  }

  /**
   * Load discard detail
   */
  private loadDiscardDetail(id: number): Observable<NotificationDetailResult> {
    return this.discardService.getDiscardById(id).pipe(
      map(detail => ({
        type: 'discard' as NotificationDetailType,
        detail: detail as NotificationRequestDetail,
        error: null
      })),
      catchError(error => of({
        type: null,
        detail: null,
        error: handleDetailError(error, this.translateService)
      }))
    );
  }

  /**
   * Load request detail (tries Order, Return, then Discard)
   */
  private loadRequestDetail(id: number): Observable<NotificationDetailResult> {
    return this.orderService.getOrderById(id).pipe(
      map(detail => ({
        type: determineDetailType(detail),
        detail: detail as NotificationRequestDetail,
        error: null
      })),
      catchError(() => {
        return this.returnService.getReturnById(id).pipe(
          map(detail => ({
            type: determineDetailType(detail),
            detail: detail as NotificationRequestDetail,
            error: null
          })),
          catchError(() => {
            return this.discardService.getDiscardById(id).pipe(
              map(detail => ({
                type: determineDetailType(detail),
                detail: detail as NotificationRequestDetail,
                error: null
              })),
              catchError(error => of({
                type: null,
                detail: null,
                error: handleDetailError(
                  new Error('Failed to load request details. You may not have permission to view this request.'),
                  this.translateService
                )
              }))
            );
          })
        );
      })
    );
  }
}

