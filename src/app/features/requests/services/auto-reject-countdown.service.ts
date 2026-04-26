import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';

export interface OrderAutoRejectCountdownDto {
  requestId: number;
  triggerApprovedAt: string | null;
  thresholdDays: number;
  daysRemaining: number;
  dueDate: string | null;
  /** none | running | warning | expired */
  state: string;
}

export interface OrderAutoRejectDashboardSummaryDto {
  expiringWithinOneDay: number;
  expiringWithinThreeDays: number;
  expiringWithinSevenDays: number;
  overdue: number;
}

@Injectable({ providedIn: 'root' })
export class AutoRejectCountdownService {
  private readonly minuteBucketMs = 60_000;

  private bulkCache = new Map<string, Observable<OrderAutoRejectCountdownDto[]>>();

  constructor(private api: ApiService) {}

  getOne(requestId: number): Observable<OrderAutoRejectCountdownDto | null> {
    const url = `${API_ENDPOINTS.ORDER_AUTO_REJECT.COUNTDOWN}/${requestId}`;
    return this.api.get<OrderAutoRejectCountdownDto>(url).pipe(
      catchError(() => of(null))
    );
  }

  getBulk(requestIds: number[]): Observable<OrderAutoRejectCountdownDto[]> {
    const sorted = [...new Set(requestIds)].filter(id => id > 0).sort((a, b) => a - b);
    if (sorted.length === 0) {
      return of([]);
    }
    const key = `${Math.floor(Date.now() / this.minuteBucketMs)}:${sorted.join(',')}`;
    let cached = this.bulkCache.get(key);
    if (!cached) {
      const url = `${API_ENDPOINTS.ORDER_AUTO_REJECT.COUNTDOWN}?ids=${encodeURIComponent(sorted.join(','))}`;
      cached = this.api.get<OrderAutoRejectCountdownDto[]>(url).pipe(
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

  mapByRequestId(rows: OrderAutoRejectCountdownDto[]): Record<number, OrderAutoRejectCountdownDto> {
    const m: Record<number, OrderAutoRejectCountdownDto> = {};
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
