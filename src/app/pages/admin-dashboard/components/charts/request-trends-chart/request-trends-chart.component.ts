import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { AdminAnalyticsService, RequestTrend } from '../../../../../core/services/admin-analytics.service';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, RefreshCw, AlertCircle } from 'lucide-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-request-trends-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsModule, LucideAngularModule, TranslateModule],
    templateUrl: './request-trends-chart.component.html',
    styleUrl: './request-trends-chart.component.css'
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
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadData();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    setPeriod(period: string): void {
        if (this.period === period) return;
        this.period = period;
        this.loadData();
        this.cdr.detectChanges();
    }

    loadData(): void {
        this.loading = true;
        this.cdr.detectChanges();

        this.analyticsService.getRequestTrends(this.period)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data) => {
                    this.initChart(data);
                    this.loading = false;
                    this.error = false;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error(`Error loading request trends for ${this.period}:`, err);
                    this.loading = false;
                    this.error = true;
                    this.cdr.detectChanges();
                }
            });
    }

    private initChart(data: RequestTrend): void {
        forkJoin({
            orders: this.translate.get('adminDashboard.charts.orders'),
            returns: this.translate.get('adminDashboard.charts.returns'),
            discards: this.translate.get('adminDashboard.charts.discards')
        }).subscribe(translations => {
            this.chartOptions = {
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross',
                        label: {
                            backgroundColor: '#6a7985'
                        }
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    textStyle: {
                        color: '#1f2937'
                    },
                    borderRadius: 8,
                    padding: 12,
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.1)'
                },
                legend: {
                    data: [translations.orders, translations.returns, translations.discards],
                    bottom: 0,
                    icon: 'circle',
                    textStyle: {
                        color: '#6b7280',
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
                            color: '#e5e7eb'
                        }
                    },
                    axisLabel: {
                        color: '#9ca3af',
                        fontSize: 11
                    }
                },
                yAxis: {
                    type: 'value',
                    splitLine: {
                        lineStyle: {
                            color: '#f3f4f6',
                            type: 'dashed'
                        }
                    },
                    axisLabel: {
                        color: '#9ca3af',
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
                    },
                    {
                        name: translations.discards,
                        type: 'line',
                        smooth: true,
                        data: data.discards,
                        symbolSize: 8,
                        lineStyle: {
                            width: 4,
                            color: '#f59e0b'
                        },
                        itemStyle: {
                            color: '#f59e0b',
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
                                    { offset: 0, color: 'rgba(245, 158, 11, 0.2)' },
                                    { offset: 1, color: 'rgba(245, 158, 11, 0.01)' }
                                ]
                            }
                        }
                    }
                ]
            };
            this.cdr.detectChanges();
        });
    }
}
