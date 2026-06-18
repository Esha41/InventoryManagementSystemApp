import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { AdminAnalyticsService } from '@admin/services/admin-analytics.service';
import type { RequestedItem, TopRequestedItems } from '@admin/models/admin-analytics.model';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, TrendingUp, RefreshCw, AlertCircle } from 'lucide-angular';
import { ThemeService } from '@services/theme.service';

@Component({
    selector: 'app-top-requested-items-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsModule, LucideAngularModule, TranslateModule],
    templateUrl: './top-requested-items-chart.component.html',
    styleUrl: './top-requested-items-chart.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopRequestedItemsChartComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();
    private latestData: TopRequestedItems | null = null;
    chartOptions: EChartsOption = {};
    loading = true;
    error = false;

    readonly TrendingUp = TrendingUp;
    readonly RefreshCw = RefreshCw;
    readonly AlertCircle = AlertCircle;

    constructor(
        private analyticsService: AdminAnalyticsService,
        private translate: TranslateService,
        private themeService: ThemeService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadData();
        // Re-render with theme-aware colors when the theme toggles (mirrors the other analytics charts).
        this.themeService.currentTheme$.pipe(takeUntil(this.destroy$)).subscribe(() => {
            if (this.latestData) {
                this.initChart(this.latestData);
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadData(): void {
        this.loading = true;
        this.cdr.markForCheck();

        this.analyticsService.getTopRequestedItems()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data: TopRequestedItems) => {
                    this.latestData = data;
                    this.initChart(data);
                    this.loading = false;
                    this.error = false;
                    this.cdr.markForCheck();
                },
                error: (err: unknown) => {
                    console.error('Error loading top requested items:', err);
                    this.loading = false;
                    this.error = true;
                    this.cdr.markForCheck();
                }
            });
    }

    private initChart(data: TopRequestedItems): void {
        const isDarkMode = this.themeService.isDarkMode();
        const mutedTextColor = isDarkMode ? '#9CA3AF' : '#6b7280';
        const axisLineColor = isDarkMode ? '#4B5563' : '#e5e7eb';
        const splitLineColor = isDarkMode ? '#4B5563' : '#f3f4f6';
        const labelColor = isDarkMode ? '#E5E7EB' : '#6b7280';
        const tooltipBg = isDarkMode ? 'rgba(26, 29, 36, 0.95)' : 'rgba(255, 255, 255, 0.9)';
        const tooltipTextColor = isDarkMode ? '#E5E7EB' : '#1f2937';

        // Prefer the Arabic catalog name when the UI is in Arabic and the API supplied one.
        const lang = (this.translate.currentLang || this.translate.defaultLang || '').toLowerCase();
        const useArabic = lang.startsWith('ar');
        const itemNames = data.items.map((item: RequestedItem) =>
            useArabic && item.itemNameAr ? item.itemNameAr : item.itemName);
        const requestCounts = data.items.map((item: RequestedItem) => item.requestCount);

        this.chartOptions = {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                },
                backgroundColor: tooltipBg,
                textStyle: {
                    color: tooltipTextColor
                },
                borderRadius: 8,
                padding: 12,
                shadowBlur: 10,
                shadowColor: isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                axisLabel: {
                    color: mutedTextColor,
                    fontSize: 11
                },
                splitLine: {
                    lineStyle: {
                        color: splitLineColor,
                        type: 'dashed'
                    }
                }
            },
            yAxis: {
                type: 'category',
                data: itemNames,
                axisLabel: {
                    color: mutedTextColor,
                    fontSize: 11
                },
                axisLine: {
                    lineStyle: {
                        color: axisLineColor
                    }
                }
            },
            series: [{
                type: 'bar',
                data: requestCounts,
                itemStyle: {
                    color: '#3b82f6',
                    borderRadius: [0, 4, 4, 0]
                },
                label: {
                    show: true,
                    position: 'right',
                    color: labelColor,
                    fontSize: 11,
                    fontWeight: 600
                },
                barMaxWidth: 30
            }]
        };
        this.cdr.markForCheck();
    }
}
