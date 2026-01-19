import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, LayoutDashboard, TrendingUp, RefreshCw } from 'lucide-angular';
import { AdminAnalyticsService, InventoryMetrics, RequestMetrics } from '@services/admin-analytics.service';
import { LoggingService } from '@services/logging.service';
import { InventoryOverviewCardComponent } from './components/kpi-cards/inventory-overview-card/inventory-overview-card.component';
import { RequestMetricsCardComponent } from './components/kpi-cards/request-metrics-card/request-metrics-card.component';
import { RequestTrendsChartComponent } from './components/request-trends-chart/request-trends-chart.component';
import { InventoryDistributionChartComponent } from './components/inventory-distribution-chart/inventory-distribution-chart.component';
import { TopRequestedItemsChartComponent } from './components/top-requested-items-chart/top-requested-items-chart.component';
import { NgxEchartsModule, provideEcharts } from 'ngx-echarts';

/**
 * Analytics Dashboard Component
 * Metrics and analytics for system administrators
 */
@Component({
    selector: 'app-analytics-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        TranslateModule,
        LucideAngularModule,
        InventoryOverviewCardComponent,
        RequestMetricsCardComponent,
        RequestTrendsChartComponent,
        InventoryDistributionChartComponent,
        TopRequestedItemsChartComponent,
        NgxEchartsModule
    ],
    providers: [
        provideEcharts()
    ],
    templateUrl: './analytics-dashboard.component.html',
    styleUrls: ['./analytics-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject<void>();

    // Icons
    readonly TrendingUp = TrendingUp;
    readonly RefreshCw = RefreshCw;
    readonly LayoutDashboard = LayoutDashboard;

    // Metrics
    inventoryMetrics: InventoryMetrics | null = null;
    requestMetrics: RequestMetrics | null = null;

    // Loading states
    isLoading = true;
    isRefreshing = false;

    constructor(
        private adminAnalyticsService: AdminAnalyticsService,
        private cdr: ChangeDetectorRef,
        private loggingService: LoggingService
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
            requests: this.adminAnalyticsService.getRequestMetrics()
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (metrics) => {
                    this.inventoryMetrics = metrics.inventory;
                    this.requestMetrics = metrics.requests;
                    this.isLoading = false;
                    this.isRefreshing = false;
                    this.cdr.markForCheck();
                },
                error: (error) => {
                    this.loggingService.error('Error loading analytics metrics', error);
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
}
