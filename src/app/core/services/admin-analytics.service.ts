import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, interval, of, Subscription, forkJoin } from 'rxjs';
import { map, shareReplay, switchMap, filter, take, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { InventoryService } from './inventory.service';
import { DASHBOARD_CONSTANTS } from '@constants/app.constants';
import { MonitoringService } from './monitoring.service';

/**
 * System Health Metrics Interface
 */
export interface SystemHealthMetrics {
    activeUsers: number;
    systemUptime: number;
    avgResponseTime: number;
    activeRequests: number;
    errorRate: number;
    status: 'healthy' | 'degraded' | 'critical';
    lastUpdated: Date;
}

/**
 * Inventory Metrics Interface
 */
export interface InventoryMetrics {
    totalItems: number;
    lowStockItems: number;
    expiringItems: number;
    inventoryDistribution?: InventoryDistribution;
    lastUpdated: Date;
}

/**
 * Request Metrics Interface
 */
export interface RequestMetrics {
    pendingOrders: number;
    pendingReturns: number;
    pendingDiscards: number;
    totalPending: number;
    newRequests: number;
    inProgressRequests: number;
    completedRequests: number;
    rejectedRequests: number;
    avgApprovalTime: number;
    slaCompliance: number;
    lastUpdated: Date;
}

/**
 * User Activity Metrics Interface
 */
export interface UserActivityMetrics {
    dailyActiveUsers: number;
    newUsersToday: number;
    totalUsers: number;
    topDepartments: Array<{ name: string; userCount: number }>;
    lastUpdated: Date;
}

/**
 * Request Trend Interface
 */
export interface RequestTrend {
    dates: string[];
    orders: number[];
    returns: number[];
    discards: number[];
    period: string;
}

/**
 * Category Distribution Interface
 */
export interface CategoryDistribution {
    name: string;
    value: number;
    percentage: number;
}

/**
 * Inventory Distribution Interface
 */
export interface InventoryDistribution {
    categories: CategoryDistribution[];
}

/**
 * Requested Item Interface
 */
export interface RequestedItem {
    itemName: string;
    requestCount: number;
    category: string;
}

/**
 * Top Requested Items Interface
 */
export interface TopRequestedItems {
    items: RequestedItem[];
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

    // Caches to prevent redundant calls
    private systemHealthCache$?: Observable<SystemHealthMetrics>;
    private inventoryMetricsCache$?: Observable<InventoryMetrics>;
    private requestMetricsCache$?: Observable<RequestMetrics>;
    private userActivityCache$?: Observable<UserActivityMetrics>;
    private trendsCache = new Map<string, Observable<RequestTrend>>();
    private distributionCache$?: Observable<InventoryDistribution>;
    private topItemsCache$?: Observable<TopRequestedItems>;

    constructor(
        private apiService: ApiService,
        private inventoryService: InventoryService,
        private monitoringService: MonitoringService
    ) { }

    ngOnDestroy(): void {
        this.autoRefreshSubscription?.unsubscribe();
    }

    /**
     * Get system health metrics with auto-refresh and caching
     */
    getSystemHealthMetrics(): Observable<SystemHealthMetrics> {
        if (!this.systemHealthCache$) {
            this.systemHealthCache$ = this.refresh$.pipe(
                switchMap(() => this.fetchSystemHealthMetrics()),
                shareReplay(1)
            );
        }
        return this.systemHealthCache$;
    }

    /**
     * Get inventory metrics with auto-refresh and caching
     */
    getInventoryMetrics(): Observable<InventoryMetrics> {
        if (!this.inventoryMetricsCache$) {
            this.inventoryMetricsCache$ = this.refresh$.pipe(
                switchMap(() => this.fetchInventoryMetrics()),
                shareReplay(1)
            );
        }
        return this.inventoryMetricsCache$;
    }

    /**
     * Get request metrics with auto-refresh and caching
     */
    getRequestMetrics(): Observable<RequestMetrics> {
        if (!this.requestMetricsCache$) {
            this.requestMetricsCache$ = this.refresh$.pipe(
                switchMap(() => this.fetchRequestMetrics()),
                shareReplay(1)
            );
        }
        return this.requestMetricsCache$;
    }

    /**
     * Get user activity metrics with auto-refresh and caching
     */
    getUserActivityMetrics(): Observable<UserActivityMetrics> {
        if (!this.userActivityCache$) {
            this.userActivityCache$ = this.refresh$.pipe(
                switchMap(() => this.fetchUserActivityMetrics()),
                shareReplay(1)
            );
        }
        return this.userActivityCache$;
    }

    /**
     * Get request trends with auto-refresh and caching
     */
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

    /**
     * Get inventory distribution with auto-refresh and caching
     */
    getInventoryDistribution(): Observable<InventoryDistribution> {
        if (!this.distributionCache$) {
            this.distributionCache$ = this.refresh$.pipe(
                switchMap(() => this.fetchInventoryDistribution()),
                shareReplay(1)
            );
        }
        return this.distributionCache$;
    }

    /**
     * Manually refresh all metrics
     */
    refresh(): void {
        this.refresh$.next(Date.now());
    }

    /**
     * Start auto-refresh interval
     */
    startAutoRefresh(): void {
        this.stopAutoRefresh(); // Clear existing subscription
        this.autoRefreshSubscription = interval(this.refreshInterval).pipe(
            tap(() => this.refresh())
        ).subscribe();
    }

    /**
     * Stop auto-refresh interval
     */
    stopAutoRefresh(): void {
        if (this.autoRefreshSubscription) {
            this.autoRefreshSubscription.unsubscribe();
            this.autoRefreshSubscription = undefined;
        }
    }

    /**
     * Fetch methods (Private)
     */
    private fetchSystemHealthMetrics(): Observable<SystemHealthMetrics> {
        return this.apiService.get<any>('/admin/analytics/system-health').pipe(
            map(response => {
                const data = response.data || response;
                return {
                    ...data,
                    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date()
                };
            })
        );
    }

    private fetchInventoryMetrics(): Observable<InventoryMetrics> {
        return forkJoin({
            items: this.inventoryService.getAllItemsSummary(),
            lowStock: this.monitoringService.getLowStockItemsCount().pipe(catchError(() => of(0))),
            expiring: this.monitoringService.getExpiringLotsCount().pipe(catchError(() => of(0)))
        }).pipe(
            map((data: { items: any[], lowStock: number, expiring: number }) => {
                const { items, lowStock, expiring } = data;
                const activeItems = items.filter(x => (x.remainingQuantity || 0) > 0);

                const totalItems = activeItems.length;

                // Calculate Distribution from Active Items
                const categoriesMap = new Map<string, number>();
                const itemTypeNames: { [key: number]: string } = {
                    1: 'Ammunition',
                    2: 'Weapon',
                    3: 'Explosive',
                    4: 'Accessory'
                };

                activeItems.forEach(item => {
                    const typeName = itemTypeNames[item.itemType] || 'Other';
                    categoriesMap.set(typeName, (categoriesMap.get(typeName) || 0) + 1);
                });

                const categories: CategoryDistribution[] = [];
                categoriesMap.forEach((value, name) => {
                    categories.push({
                        name: name,
                        value: value,
                        percentage: totalItems > 0 ? (value / totalItems) * 100 : 0
                    });
                });

                // Sort categories by value desc
                categories.sort((a, b) => b.value - a.value);

                return {
                    totalItems,
                    lowStockItems: lowStock,
                    expiringItems: expiring,
                    inventoryDistribution: { categories },
                    lastUpdated: new Date()
                };
            })
        );
    }

    private fetchRequestMetrics(): Observable<RequestMetrics> {
        return this.apiService.get<any>('/admin/analytics/request-metrics').pipe(
            map(response => {
                const data = response.data || response;
                return {
                    ...data,
                    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date()
                };
            })
        );
    }

    private fetchUserActivityMetrics(): Observable<UserActivityMetrics> {
        return this.apiService.get<any>('/admin/analytics/user-activity').pipe(
            map(response => {
                const data = response.data || response;
                return {
                    ...data,
                    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date()
                };
            })
        );
    }

    private fetchRequestTrends(period: string): Observable<RequestTrend> {
        return this.apiService.get<any>(`/admin/analytics/request-trends?period=${period}`).pipe(
            map(response => response.data || response)
        );
    }

    private fetchInventoryDistribution(): Observable<InventoryDistribution> {
        return this.apiService.get<any>('/admin/analytics/inventory-distribution').pipe(
            map(response => response.data || response)
        );
    }

    private fetchTopRequestedItems(limit: number): Observable<TopRequestedItems> {
        return this.apiService.get<any>(`/admin/analytics/top-requested-items?limit=${limit}`).pipe(
            map(response => response.data || response)
        );
    }

    /**
     * Get top requested items with auto-refresh and caching
     */
    getTopRequestedItems(limit: number = DASHBOARD_CONSTANTS.TOP_ITEMS_LIMIT): Observable<TopRequestedItems> {
        if (!this.topItemsCache$) {
            this.topItemsCache$ = this.refresh$.pipe(
                switchMap(() => this.fetchTopRequestedItems(limit)),
                shareReplay(1)
            );
        }
        return this.topItemsCache$;
    }
}
