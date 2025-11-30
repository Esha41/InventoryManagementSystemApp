import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Notification, RequestDetail, NotificationDetailType, NotificationDetailResult } from '@models/notification.model';
import { OrderService } from './order.service';
import { ReturnService } from './return.service';
import { DiscardService } from './discard.service';
import { extractEntityIdFromMetadata, determineDetailType, handleDetailError } from '@utils/notification.utils';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationDetailService {
  constructor(
    private readonly orderService: OrderService,
    private readonly returnService: ReturnService,
    private readonly discardService: DiscardService,
    private readonly translateService: TranslateService
  ) {}

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
        detail: detail as RequestDetail,
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
        detail: detail as RequestDetail,
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
        detail: detail as RequestDetail,
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
        detail: detail as RequestDetail,
        error: null
      })),
      catchError(() => {
        return this.returnService.getReturnById(id).pipe(
          map(detail => ({
            type: determineDetailType(detail),
            detail: detail as RequestDetail,
            error: null
          })),
          catchError(() => {
            return this.discardService.getDiscardById(id).pipe(
              map(detail => ({
                type: determineDetailType(detail),
                detail: detail as RequestDetail,
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

