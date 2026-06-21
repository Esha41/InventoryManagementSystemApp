import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, interval, of, Subscription, forkJoin } from 'rxjs';
import { map, shareReplay, switchMap, tap, catchError } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { DASHBOARD_CONSTANTS } from '@constants/app.constants';
import { MonitoringService } from '@services/monitoring.service';
import type {
  CategoryDistribution,
  InventoryMetrics,
  RequestMetrics,
  RequestMetricsDto,
  RequestTrend,
  RequestTrendsDto,
  SystemHealthMetrics,
  SystemHealthMetricsDto,
  TopRequestedItems,
  TopRequestedItemsDto,
  UserActivityMetrics,
  UserActivityMetricsDto,
  WorkflowPerformance,
  WorkflowPerformanceDto
} from '@admin/models/admin-analytics.model';

export type {
  CategoryDistribution,
  InventoryDistribution,
  InventoryMetrics,
  PerformanceMetricsDto,
  RequestMetrics,
  RequestTrend,
  RequestedItem,
  SystemHealthMetrics,
  TopRequestedItems,
  UserActivityMetrics,
  SystemHealthMetricsDto,
  RequestTrendsDto,
  DepartmentStatDto,
  WorkflowPerformance
} from '@admin/models/admin-analytics.model';

function parseApiDate(value: string | undefined | null): Date {
  if (value == null || value === '') {
    return new Date();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Admin Analytics Service
 * Provides comprehensive metrics and analytics for the admin dashboard
 */
@Injectable({
  providedIn: 'root'
})
export class AdminAnalyticsService implements OnDestroy {
  private refreshInterval = DASHBOARD_CONSTANTS.AUTO_REFRESH_INTERVAL_MS;
  public readonly refresh$ = new BehaviorSubject<number>(Date.now());
  private autoRefreshSubscription?: Subscription;

  private systemHealthCache$?: Observable<SystemHealthMetrics>;
  private inventoryMetricsCache$?: Observable<InventoryMetrics>;
  private requestMetricsCache$?: Observable<RequestMetrics>;
  private userActivityCache$?: Observable<UserActivityMetrics>;
  private trendsCache = new Map<string, Observable<RequestTrend>>();
  private topItemsCache$?: Observable<TopRequestedItems>;
  private workflowPerformanceCache = new Map<number, Observable<WorkflowPerformance>>();

  constructor(
    private apiService: ApiService,
    private monitoringService: MonitoringService
  ) { }

  ngOnDestroy(): void {
    this.autoRefreshSubscription?.unsubscribe();
  }

  getSystemHealthMetrics(): Observable<SystemHealthMetrics> {
    if (!this.systemHealthCache$) {
      this.systemHealthCache$ = this.refresh$.pipe(
        switchMap(() => this.fetchSystemHealthMetrics()),
        shareReplay(1)
      );
    }
    return this.systemHealthCache$;
  }

  getInventoryMetrics(): Observable<InventoryMetrics> {
    if (!this.inventoryMetricsCache$) {
      this.inventoryMetricsCache$ = this.refresh$.pipe(
        switchMap(() => this.fetchInventoryMetrics()),
        shareReplay(1)
      );
    }
    return this.inventoryMetricsCache$;
  }

  getRequestMetrics(): Observable<RequestMetrics> {
    if (!this.requestMetricsCache$) {
      this.requestMetricsCache$ = this.refresh$.pipe(
        switchMap(() => this.fetchRequestMetrics()),
        shareReplay(1)
      );
    }
    return this.requestMetricsCache$;
  }

  getUserActivityMetrics(): Observable<UserActivityMetrics> {
    if (!this.userActivityCache$) {
      this.userActivityCache$ = this.refresh$.pipe(
        switchMap(() => this.fetchUserActivityMetrics()),
        shareReplay(1)
      );
    }
    return this.userActivityCache$;
  }

  getRequestTrends(period: string = 'daily'): Observable<RequestTrend> {
    if (!this.trendsCache.has(period)) {
      const cache$ = this.refresh$.pipe(
        switchMap(() => this.fetchRequestTrends(period)),
        shareReplay(1)
      );
      this.trendsCache.set(period, cache$);
    }
    return this.trendsCache.get(period)!;
  }

  refresh(): void {
    this.refresh$.next(Date.now());
  }

  startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.autoRefreshSubscription = interval(this.refreshInterval).pipe(
      tap(() => this.refresh())
    ).subscribe();
  }

  stopAutoRefresh(): void {
    this.autoRefreshSubscription?.unsubscribe();
    this.autoRefreshSubscription = undefined;
  }

  private fetchSystemHealthMetrics(): Observable<SystemHealthMetrics> {
    return this.apiService.get<SystemHealthMetricsDto>('/admin/analytics/system-health').pipe(
      map(dto => ({
        ...dto,
        lastUpdated: parseApiDate(dto.lastUpdated)
      }))
    );
  }

  private fetchInventoryMetrics(): Observable<InventoryMetrics> {
    return forkJoin({
      headline: this.monitoringService.getInventoryHeadlineMetrics().pipe(catchError(() => of(null))),
      pipeline: this.monitoringService.getInventoryDashboardSummary().pipe(catchError(() => of(null)))
    }).pipe(
      map(({ headline, pipeline }) => {
        const categoryEntries: { name: string; value: number }[] = [
          { name: 'Ammunition', value: headline?.ammunitionItemCount ?? 0 },
          { name: 'Weapon', value: headline?.weaponItemGroupsCount ?? 0 },
          { name: 'Explosive', value: headline?.explosiveItemCount ?? 0 },
          { name: 'Accessory', value: headline?.accessoryItemCount ?? 0 }
        ];

        const activeEntries = categoryEntries.filter(entry => entry.value > 0);
        const totalItems = headline?.totalDistinctItems
          ?? activeEntries.reduce((sum, entry) => sum + entry.value, 0);

        const categories: CategoryDistribution[] = activeEntries
          .map(entry => ({
            name: entry.name,
            value: entry.value,
            percentage: totalItems > 0 ? (entry.value / totalItems) * 100 : 0
          }))
          .sort((a, b) => b.value - a.value);

        return {
          totalItems,
          lowStockItems: headline?.lowStockCount ?? 0,
          criticalStockItems: headline?.criticalStockCount ?? 0,
          expiringItems: headline?.expiringSoonCount ?? 0,
          pendingIssuanceRequests: pipeline?.pipeline?.draftSupplyCount ?? 0,
          ordersNotFullyFulfilled: pipeline?.pipeline?.ordersAwaitingFulfillmentCount ?? 0,
          inventoryDistribution: { categories },
          lastUpdated: new Date()
        };
      })
    );
  }

  private fetchRequestMetrics(): Observable<RequestMetrics> {
    return this.apiService.get<RequestMetricsDto>('/admin/analytics/request-metrics').pipe(
      map(dto => ({
        ...dto,
        lastUpdated: parseApiDate(dto.lastUpdated)
      }))
    );
  }

  private fetchUserActivityMetrics(): Observable<UserActivityMetrics> {
    return this.apiService.get<UserActivityMetricsDto>('/admin/analytics/user-activity').pipe(
      map(dto => ({
        ...dto,
        lastUpdated: parseApiDate(dto.lastUpdated)
      }))
    );
  }

  private fetchRequestTrends(period: string): Observable<RequestTrend> {
    return this.apiService.get<RequestTrendsDto>(`/admin/analytics/request-trends?period=${encodeURIComponent(period)}`);
  }

  private fetchTopRequestedItems(limit: number): Observable<TopRequestedItems> {
    return this.apiService.get<TopRequestedItemsDto>(`/admin/analytics/top-requested-items?limit=${limit}`);
  }

  getTopRequestedItems(limit: number = DASHBOARD_CONSTANTS.TOP_ITEMS_LIMIT): Observable<TopRequestedItems> {
    if (!this.topItemsCache$) {
      this.topItemsCache$ = this.refresh$.pipe(
        switchMap(() => this.fetchTopRequestedItems(limit)),
        shareReplay(1)
      );
    }
    return this.topItemsCache$;
  }

  getWorkflowPerformance(days: number = 90): Observable<WorkflowPerformance> {
    if (!this.workflowPerformanceCache.has(days)) {
      const cache$ = this.refresh$.pipe(
        switchMap(() => this.fetchWorkflowPerformance(days)),
        shareReplay(1)
      );
      this.workflowPerformanceCache.set(days, cache$);
    }
    return this.workflowPerformanceCache.get(days)!;
  }

  private fetchWorkflowPerformance(days: number): Observable<WorkflowPerformance> {
    return this.apiService.get<WorkflowPerformanceDto>(`/admin/analytics/workflow-performance?days=${days}`).pipe(
      map(dto => ({
        ...dto,
        lastUpdated: parseApiDate(dto.lastUpdated)
      }))
    );
  }
}
