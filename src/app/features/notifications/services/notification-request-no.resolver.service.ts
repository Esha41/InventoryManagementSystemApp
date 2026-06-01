import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { Notification } from '@notifications/models/notification.model';
import {
  extractRequestNoFromMessage,
  getNotificationEntityId,
  notificationNeedsRequestNoLookup
} from '@notifications/utils/notification-message.utils';
import { getWorkflowApprovalNavigation } from '@notifications/utils/notification-workflow-navigation.utils';
import { SupplyService } from '@requests/services/supply.service';
import { OrderItemTrackingService } from '@requests/services/order-item-tracking.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationRequestNoResolverService {
  private readonly cache = new Map<number, string>();
  private readonly inflight = new Map<number, Observable<string | null>>();
  private readonly orderIdByRequestNoCache = new Map<string, number>();
  private readonly orderIdByRequestNoInflight = new Map<string, Observable<number | null>>();

  constructor(
    private readonly apiService: ApiService,
    private readonly supplyService: SupplyService,
    private readonly orderItemTrackingService: OrderItemTrackingService
  ) {}

  getCached(entityId: number): string | null {
    return this.cache.get(entityId) ?? null;
  }

  resolve(entityId: number): Observable<string | null> {
    const cached = this.cache.get(entityId);
    if (cached) {
      return of(cached);
    }

    let request$ = this.inflight.get(entityId);
    if (!request$) {
      request$ = this.apiService
        .get<Record<string, unknown>>(API_ENDPOINTS.WORKFLOW_APPROVAL.BASE_REQUEST_BY_ID(entityId))
        .pipe(
          map(dto => {
            const raw = dto?.['requestNo'] ?? dto?.['RequestNo'];
            return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
          }),
          tap(requestNo => {
            if (requestNo) {
              this.cache.set(entityId, requestNo);
            }
          }),
          catchError(() => of(null)),
          finalize(() => this.inflight.delete(entityId)),
          shareReplay({ bufferSize: 1, refCount: true })
        );
      this.inflight.set(entityId, request$);
    }

    return request$;
  }

  /** Load request numbers for approval notifications whose stored message has no request number yet. */
  prefetch(notifications: Notification[]): Observable<void> {
    const entityIds = new Set<number>();
    for (const notification of notifications) {
      if (!notificationNeedsRequestNoLookup(notification)) {
        continue;
      }
      const entityId = getNotificationEntityId(notification);
      if (entityId != null && !this.cache.has(entityId)) {
        entityIds.add(entityId);
      }
    }

    if (entityIds.size === 0) {
      return of(undefined);
    }

    return forkJoin([...entityIds].map(id => this.resolve(id))).pipe(map(() => undefined));
  }

  /**
   * Resolves the workflow route order/base-request id for notification deep-links.
   * Supply notifications store supply.Id as entityId — never use that value as order id.
   */
  resolveWorkflowOrderId(notification: Notification): Observable<number | null> {
    const entityId = getNotificationEntityId(notification);
    const entityType = (notification.entityType ?? notification.type ?? '').toLowerCase().trim();

    if (entityType === 'order' && entityId != null) {
      return of(entityId);
    }

    if (entityType === 'supply' && entityId != null) {
      return this.supplyService.getById(entityId).pipe(
        map(supply => supply?.orderId ?? null),
        switchMap(orderId => {
          if (orderId != null) {
            return of(orderId);
          }
          return this.resolveOrderIdByRequestNo(extractRequestNoFromMessage(notification.message));
        }),
        catchError(() =>
          this.resolveOrderIdByRequestNo(extractRequestNoFromMessage(notification.message))
        )
      );
    }

    if (getWorkflowApprovalNavigation(notification) != null && entityId != null) {
      return of(entityId);
    }

    return this.resolveOrderIdByRequestNo(extractRequestNoFromMessage(notification.message));
  }

  private resolveOrderIdByRequestNo(requestNo: string): Observable<number | null> {
    const normalized = requestNo.trim();
    if (!normalized) {
      return of(null);
    }

    const cached = this.orderIdByRequestNoCache.get(normalized);
    if (cached != null) {
      return of(cached);
    }

    let request$ = this.orderIdByRequestNoInflight.get(normalized);
    if (!request$) {
      request$ = this.orderItemTrackingService.getOrderItemHistory(undefined, normalized).pipe(
        map(history => history?.[0]?.orderId ?? null),
        tap(orderId => {
          if (orderId != null) {
            this.orderIdByRequestNoCache.set(normalized, orderId);
          }
        }),
        catchError(() => of(null)),
        finalize(() => this.orderIdByRequestNoInflight.delete(normalized)),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this.orderIdByRequestNoInflight.set(normalized, request$);
    }

    return request$;
  }
}
