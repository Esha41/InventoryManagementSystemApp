import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, LayoutDashboard, Users, Package, AlertCircle, TrendingUp, Activity, RefreshCw, Layers } from 'lucide-angular';
import { AdminAnalyticsService, InventoryMetrics, RequestMetrics, UserActivityMetrics } from '@services/admin-analytics.service';
import { InventoryOverviewCardComponent } from './components/kpi-cards/inventory-overview-card/inventory-overview-card.component';
import { RequestMetricsCardComponent } from './components/kpi-cards/request-metrics-card/request-metrics-card.component';
import { UserActivityCardComponent } from './components/kpi-cards/user-activity-card/user-activity-card.component';
import { RequestTrendsChartComponent } from './components/charts/request-trends-chart/request-trends-chart.component';
import { InventoryDistributionChartComponent } from './components/charts/inventory-distribution-chart/inventory-distribution-chart.component';
import { TopRequestedItemsChartComponent } from './components/charts/top-requested-items-chart/top-requested-items-chart.component';
import { AdminDelegationsComponent } from './admin-delegations/admin-delegations.component';
import { NgxEchartsModule, provideEcharts } from 'ngx-echarts';
import { DASHBOARD_CONSTANTS } from '@constants/app.constants';

/**
 * Admin Dashboard Component
 * Main dashboard for system administrators with comprehensive metrics and analytics
 */
@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        TranslateModule,
        LucideAngularModule,
        InventoryOverviewCardComponent,
        RequestMetricsCardComponent,
        UserActivityCardComponent,
        RequestTrendsChartComponent,
        InventoryDistributionChartComponent,
        TopRequestedItemsChartComponent,
        AdminDelegationsComponent,
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
    readonly Users = Users;
    readonly Package = Package;
    readonly AlertCircle = AlertCircle;
    readonly TrendingUp = TrendingUp;
    readonly RefreshCw = RefreshCw;
    readonly LayoutDashboard = LayoutDashboard;
    readonly Layers = Layers;

    // View state
    activeView: 'overview' | 'delegations' = 'overview';

    // Metrics
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
            inventory: this.adminAnalyticsService.getInventoryMetrics(),
            requests: this.adminAnalyticsService.getRequestMetrics(),
            userActivity: this.adminAnalyticsService.getUserActivityMetrics()
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (metrics) => {
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
     * Switch between dashboard views
     */
    switchView(view: 'overview' | 'delegations'): void {
        this.activeView = view;
        this.cdr.markForCheck();
    }
}
