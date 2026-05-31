import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { Notification } from '@notifications/models/notification.model';
import {
  getNotificationEntityId,
  notificationNeedsRequestNoLookup
} from '@notifications/utils/notification-message.utils';

@Injectable({
  providedIn: 'root'
})
export class NotificationRequestNoResolverService {
  private readonly cache = new Map<number, string>();
  private readonly inflight = new Map<number, Observable<string | null>>();

  constructor(private readonly apiService: ApiService) {}

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
}
