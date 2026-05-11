import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { RequestAutoRejectCountdownDto } from '@models/workflow.model';

export type { RequestAutoRejectCountdownDto };

/**
 * Dashboard auto-reject summary buckets — **orders only** (matches backend `dashboard-summary` endpoint).
 */
export interface OrderAutoRejectDashboardSummaryDto {
  expiringWithinOneDay: number;
  expiringWithinThreeDays: number;
  expiringWithinSevenDays: number;
  overdue: number;
}

@Injectable({ providedIn: 'root' })
export class AutoRejectCountdownService {
  private readonly minuteBucketMs = 60_000;

  private bulkCache = new Map<string, Observable<RequestAutoRejectCountdownDto[]>>();

  constructor(private api: ApiService) {}

  getOne(requestId: number): Observable<RequestAutoRejectCountdownDto | null> {
    const url = `${API_ENDPOINTS.ORDER_AUTO_REJECT.COUNTDOWN}/${requestId}`;
    return this.api.get<RequestAutoRejectCountdownDto>(url).pipe(
      catchError(() => of(null))
    );
  }

  getBulk(
    requestIds: number[],
    requestType: 'order' | 'return' | 'discard' = 'order'
  ): Observable<RequestAutoRejectCountdownDto[]> {
    const sorted = [...new Set(requestIds)].filter(id => id > 0).sort((a, b) => a - b);
    if (sorted.length === 0) {
      return of([]);
    }
    const key = `${Math.floor(Date.now() / this.minuteBucketMs)}:${requestType}:${sorted.join(',')}`;
    let cached = this.bulkCache.get(key);
    if (!cached) {
      const url = `${API_ENDPOINTS.ORDER_AUTO_REJECT.COUNTDOWN}?ids=${encodeURIComponent(sorted.join(','))}&type=${encodeURIComponent(requestType)}`;
      cached = this.api.get<RequestAutoRejectCountdownDto[]>(url).pipe(
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this.bulkCache.set(key, cached);
      if (this.bulkCache.size > 50) {
        this.bulkCache.clear();
      }
    }
    return cached;
  }

  mapByRequestId(rows: RequestAutoRejectCountdownDto[]): Record<number, RequestAutoRejectCountdownDto> {
    const m: Record<number, RequestAutoRejectCountdownDto> = {};
    for (const r of rows) {
      m[r.requestId] = r;
    }
    return m;
  }

  getDashboardSummary(): Observable<OrderAutoRejectDashboardSummaryDto | null> {
    const url = `${API_ENDPOINTS.ORDER_AUTO_REJECT.COUNTDOWN}/dashboard-summary`;
    return this.api.get<OrderAutoRejectDashboardSummaryDto>(url).pipe(
      catchError(() => of(null))
    );
  }
}

/** @deprecated Use {@link RequestAutoRejectCountdownDto} instead */
export type OrderAutoRejectCountdownDto = RequestAutoRejectCountdownDto;
