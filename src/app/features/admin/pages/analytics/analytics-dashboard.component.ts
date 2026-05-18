import { Component, OnInit, ChangeDetectionStrategy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, catchError, of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, LayoutDashboard, TrendingUp } from 'lucide-angular';
import { AdminAnalyticsService, InventoryMetrics, RequestMetrics } from '@admin/services/admin-analytics.service';
import { LoggingService } from '@services/logging.service';
import { InventoryOverviewCardComponent } from './components/kpi-cards/inventory-overview-card/inventory-overview-card.component';
import { RequestMetricsCardComponent } from './components/kpi-cards/request-metrics-card/request-metrics-card.component';
import { RequestTrendsChartComponent } from './components/request-trends-chart/request-trends-chart.component';
import { InventoryDistributionChartComponent } from './components/inventory-distribution-chart/inventory-distribution-chart.component';
import { TopRequestedItemsChartComponent } from './components/top-requested-items-chart/top-requested-items-chart.component';
import { NgxEchartsModule, provideEchartsCore } from 'ngx-echarts';
import { createEcharts } from '@core/echarts.factory';

/**
 * Analytics Dashboard Component
 * Metrics and analytics for system administrators
 */
@Component({
    selector: 'app-analytics-dashboard',
    standalone: true,
    imports: [
        CommonModule,
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
        // Use shared factory so we can configure ECharts (e.g. log level) once.
        provideEchartsCore({ echarts: () => Promise.resolve(createEcharts()) })
    ],
    templateUrl: './analytics-dashboard.component.html',
    styleUrls: ['./analytics-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsDashboardComponent implements OnInit {
    // Icons
    readonly TrendingUp = TrendingUp;
    readonly LayoutDashboard = LayoutDashboard;

    // Loading states - using Signals
    isLoading = signal(true);

    // Convert Observables to Signals using toSignal() with error handling
    private inventoryMetrics$ = this.adminAnalyticsService.getInventoryMetrics().pipe(
        catchError((error) => {
            this.loggingService.error('Error loading inventory metrics', error);
            return of(null as InventoryMetrics | null);
        })
    );
    
    private requestMetrics$ = this.adminAnalyticsService.getRequestMetrics().pipe(
        catchError((error) => {
            this.loggingService.error('Error loading request metrics', error);
            return of(null as RequestMetrics | null);
        })
    );

    // Combined metrics as Signal
    private metricsSignal = toSignal(
        combineLatest({
            inventory: this.inventoryMetrics$,
            requests: this.requestMetrics$
        }),
        { 
            initialValue: { inventory: null as InventoryMetrics | null, requests: null as RequestMetrics | null } as { inventory: InventoryMetrics | null, requests: RequestMetrics | null }
        }
    );

    // Computed Signals for individual metrics
    inventoryMetrics = computed(() => {
        const metrics = this.metricsSignal();
        return metrics.inventory;
    });
    requestMetrics = computed(() => {
        const metrics = this.metricsSignal();
        return metrics.requests;
    });

    constructor(
        private adminAnalyticsService: AdminAnalyticsService,
        private loggingService: LoggingService
    ) {
        // Effect to handle loading state
        // Note: allowSignalWrites is deprecated - writes are always allowed in effects
        effect(() => {
            const metrics = this.metricsSignal();
            // Check if we have data (not initial null values)
            if (metrics && (metrics.inventory !== null || metrics.requests !== null)) {
                this.isLoading.set(false);
            }
        }, { allowSignalWrites: true });
    }

    ngOnInit(): void {
        // Start auto-refresh timer (30 seconds)
        this.adminAnalyticsService.startAutoRefresh();
        
        // Metrics are automatically loaded via toSignal() - no manual subscription needed!
    }
}
