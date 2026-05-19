import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { AdminAnalyticsService } from '@admin/services/admin-analytics.service';
import type { RequestTrend } from '@admin/models/admin-analytics.model';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, RefreshCw, AlertCircle } from 'lucide-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ThemeService } from '@services/theme.service';

@Component({
    selector: 'app-request-trends-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsModule, LucideAngularModule, TranslateModule],
    templateUrl: './request-trends-chart.component.html',
    styleUrl: './request-trends-chart.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestTrendsChartComponent implements OnInit, OnDestroy {
    @Input() period: string = 'weekly';

    // Icons
    readonly RefreshCw = RefreshCw;
    readonly AlertCircle = AlertCircle;

    private destroy$ = new Subject<void>();
    chartOptions: EChartsOption = {};
    loading = true;
    error = false;

    constructor(
        private analyticsService: AdminAnalyticsService,
        private translate: TranslateService,
        private cdr: ChangeDetectorRef,
        private themeService: ThemeService
    ) { }

    ngOnInit(): void {
        this.loadData();
        // Subscribe to theme changes and reload chart when theme changes
        this.themeService.currentTheme$.pipe(takeUntil(this.destroy$)).subscribe(() => {
            if (this.chartOptions && Object.keys(this.chartOptions).length > 0) {
                // Reload data to reinitialize chart with new theme colors
                this.loadData();
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    setPeriod(period: string): void {
        if (this.period === period) return;
        this.period = period;
        this.loadData();
        this.cdr.markForCheck();
    }

    loadData(): void {
        this.loading = true;
        this.cdr.markForCheck();

        this.analyticsService.getRequestTrends(this.period)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data: RequestTrend) => {
                    this.initChart(data);
                    this.loading = false;
                    this.error = false;
                    this.cdr.markForCheck();
                },
                error: (err: unknown) => {
                    console.error(`Error loading request trends for ${this.period}:`, err);
                    this.loading = false;
                    this.error = true;
                    this.cdr.markForCheck();
                }
            });
    }

    private initChart(data: RequestTrend): void {
        const isDarkMode = this.themeService.isDarkMode();
        const textColor = isDarkMode ? '#E5E7EB' : '#1f2937';
        const mutedTextColor = isDarkMode ? '#9CA3AF' : '#6b7280';
        const axisLineColor = isDarkMode ? '#4B5563' : '#e5e7eb';
        const splitLineColor = isDarkMode ? '#4B5563' : '#f3f4f6';
        const tooltipBg = isDarkMode ? 'rgba(26, 29, 36, 0.95)' : 'rgba(255, 255, 255, 0.9)';
        const backgroundColor = isDarkMode ? '#1A1D24' : '#FFFFFF';

        // Discard series omitted while discard request flow is disabled in the app.
        forkJoin({
            orders: this.translate.get('adminDashboard.charts.orders'),
            returns: this.translate.get('adminDashboard.charts.returns')
        }).subscribe(translations => {
            this.chartOptions = {
                backgroundColor: backgroundColor,
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross',
                        label: {
                            backgroundColor: isDarkMode ? '#4B5563' : '#6a7985'
                        }
                    },
                    backgroundColor: tooltipBg,
                    textStyle: {
                        color: textColor
                    },
                    borderRadius: 8,
                    padding: 12,
                    shadowBlur: 10,
                    shadowColor: isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)'
                },
                legend: {
                    data: [translations.orders, translations.returns],
                    bottom: 0,
                    icon: 'circle',
                    textStyle: {
                        color: mutedTextColor,
                        fontSize: 12
                    }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '10%',
                    top: '10%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    boundaryGap: false,
                    data: data.dates,
                    axisLine: {
                        lineStyle: {
                            color: axisLineColor
                        }
                    },
                    axisLabel: {
                        color: mutedTextColor,
                        fontSize: 11
                    }
                },
                yAxis: {
                    type: 'value',
                    splitLine: {
                        lineStyle: {
                            color: splitLineColor,
                            type: 'dashed'
                        }
                    },
                    axisLabel: {
                        color: mutedTextColor,
                        fontSize: 11
                    }
                },
                series: [
                    {
                        name: translations.orders,
                        type: 'line',
                        smooth: true,
                        data: data.orders,
                        symbolSize: 8,
                        lineStyle: {
                            width: 4,
                            color: '#3b82f6'
                        },
                        itemStyle: {
                            color: '#3b82f6',
                            borderWidth: 2,
                            borderColor: backgroundColor
                        },
                        areaStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                x2: 0,
                                y: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
                                    { offset: 1, color: 'rgba(59, 130, 246, 0.01)' }
                                ]
                            }
                        }
                    },
                    {
                        name: translations.returns,
                        type: 'line',
                        smooth: true,
                        data: data.returns,
                        symbolSize: 8,
                        lineStyle: {
                            width: 4,
                            color: '#10b981'
                        },
                        itemStyle: {
                            color: '#10b981',
                            borderWidth: 2,
                            borderColor: '#fff'
                        },
                        areaStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                x2: 0,
                                y: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
                                    { offset: 1, color: 'rgba(16, 185, 129, 0.01)' }
                                ]
                            }
                        }
                    }
                ]
            };
            this.cdr.markForCheck();
        });
    }
}
