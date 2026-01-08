import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, interval, of } from 'rxjs';
import { map, shareReplay, switchMap, filter, take, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { InventoryService } from './inventory.service';

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
    totalQuantity: number;
    lowStockItems: number;
    expiringSoon: number;
    overstockItems: number;
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
export class AdminAnalyticsService {
    private refreshInterval = 30000; // 30 seconds
    public readonly refresh$ = new BehaviorSubject<number>(Date.now());

    // Caches to prevent redundant calls
    private systemHealthCache$?: Observable<SystemHealthMetrics>;
    private inventoryMetricsCache$?: Observable<InventoryMetrics>;
    private requestMetricsCache$?: Observable<RequestMetrics>;
    private userActivityCache$?: Observable<UserActivityMetrics>;
    private trendsCache = new Map<string, Observable<RequestTrend>>();
    private distributionCache$?: Observable<InventoryDistribution>;

    constructor(
        private apiService: ApiService,
        private inventoryService: InventoryService
    ) { }

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
        interval(this.refreshInterval).pipe(
            tap(() => this.refresh())
        ).subscribe();
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
        return this.inventoryService.getAllItemsSummary().pipe(
            map(items => {
                const totalItems = items.filter(x => (x.remainingQuantity || 0) > 0).length;
                const totalQuantity = items.reduce((sum, item) => sum + (item.remainingQuantity || 0), 0);
                const lowStockThreshold = 100;
                const lowStockItems = items.filter(item => (item.remainingQuantity || 0) < lowStockThreshold && (item.remainingQuantity || 0) > 0).length;
                const overstockThreshold = 10000;
                const overstockItems = items.filter(item => (item.remainingQuantity || 0) > overstockThreshold).length;

                return {
                    totalItems,
                    totalQuantity,
                    lowStockItems,
                    expiringSoon: 0,
                    overstockItems,
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
}
