import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, LayoutDashboard, Users, Package, AlertCircle, TrendingUp, Activity, RefreshCw } from 'lucide-angular';
import { AdminAnalyticsService, SystemHealthMetrics, InventoryMetrics, RequestMetrics, UserActivityMetrics } from '@services/admin-analytics.service';
import { SystemHealthCardComponent } from './components/kpi-cards/system-health-card/system-health-card.component';
import { InventoryOverviewCardComponent } from './components/kpi-cards/inventory-overview-card/inventory-overview-card.component';
import { RequestMetricsCardComponent } from './components/kpi-cards/request-metrics-card/request-metrics-card.component';
import { UserActivityCardComponent } from './components/kpi-cards/user-activity-card/user-activity-card.component';
import { RequestTrendsChartComponent } from './components/charts/request-trends-chart/request-trends-chart.component';
import { InventoryDistributionChartComponent } from './components/charts/inventory-distribution-chart/inventory-distribution-chart.component';
import { NgxEchartsModule, provideEcharts } from 'ngx-echarts';

/**
 * Admin Dashboard Component
 * Main dashboard for system administrators with comprehensive metrics and analytics
 */
@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        LucideAngularModule,
        SystemHealthCardComponent,
        InventoryOverviewCardComponent,
        RequestMetricsCardComponent,
        UserActivityCardComponent,
        RequestTrendsChartComponent,
        InventoryDistributionChartComponent,
        NgxEchartsModule
    ],
    providers: [
        provideEcharts()
    ],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject<void>();

    // Icons
    readonly LayoutDashboard = LayoutDashboard;
    readonly Users = Users;
    readonly Package = Package;
    readonly AlertCircle = AlertCircle;
    readonly TrendingUp = TrendingUp;
    readonly Activity = Activity;
    readonly RefreshCw = RefreshCw;

    // Metrics
    systemHealth: SystemHealthMetrics | null = null;
    inventoryMetrics: InventoryMetrics | null = null;
    requestMetrics: RequestMetrics | null = null;
    userActivityMetrics: UserActivityMetrics | null = null;

    // Loading states
    isLoading = true;
    isRefreshing = false;

    constructor(
        private adminAnalyticsService: AdminAnalyticsService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        // Load metrics initially
        this.loadAllMetrics();

        // Start auto-refresh timer (30 seconds)
        this.adminAnalyticsService.startAutoRefresh();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Load all dashboard metrics
     */
    private loadAllMetrics(): void {
        this.isLoading = true;

        combineLatest({
            systemHealth: this.adminAnalyticsService.getSystemHealthMetrics(),
            inventory: this.adminAnalyticsService.getInventoryMetrics(),
            requests: this.adminAnalyticsService.getRequestMetrics(),
            userActivity: this.adminAnalyticsService.getUserActivityMetrics()
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (metrics) => {
                    this.systemHealth = metrics.systemHealth;
                    this.inventoryMetrics = metrics.inventory;
                    this.requestMetrics = metrics.requests;
                    this.userActivityMetrics = metrics.userActivity;
                    this.isLoading = false;
                    this.isRefreshing = false;
                    this.cdr.markForCheck();
                },
                error: (error) => {
                    console.error('Error loading dashboard metrics:', error);
                    this.isLoading = false;
                    this.isRefreshing = false;
                    this.cdr.markForCheck();
                }
            });
    }

    /**
     * Manually refresh all metrics
     */
    onRefresh(): void {
        this.isRefreshing = true;
        this.adminAnalyticsService.refresh();
        this.cdr.markForCheck();
    }

    /**
     * Get status color class based on system health
     */
    getStatusColorClass(): string {
        if (!this.systemHealth) return 'text-gray-500';

        switch (this.systemHealth.status) {
            case 'healthy':
                return 'text-green-600';
            case 'degraded':
                return 'text-yellow-600';
            case 'critical':
                return 'text-red-600';
            default:
                return 'text-gray-500';
        }
    }

    /**
     * Get status text
     */
    getStatusText(): string {
        if (!this.systemHealth) return 'adminDashboard.status.unknown';

        switch (this.systemHealth.status) {
            case 'healthy':
                return 'adminDashboard.status.healthy';
            case 'degraded':
                return 'adminDashboard.status.degraded';
            case 'critical':
                return 'adminDashboard.status.critical';
            default:
                return 'adminDashboard.status.unknown';
        }
    }
}
