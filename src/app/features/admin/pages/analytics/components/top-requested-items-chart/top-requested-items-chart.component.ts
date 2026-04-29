import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { AdminAnalyticsService } from '@admin/services/admin-analytics.service';
import type { RequestedItem, TopRequestedItems } from '@admin/models/admin-analytics.model';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, TrendingUp, RefreshCw, AlertCircle } from 'lucide-angular';

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
    chartOptions: EChartsOption = {};
    loading = true;
    error = false;

    readonly TrendingUp = TrendingUp;
    readonly RefreshCw = RefreshCw;
    readonly AlertCircle = AlertCircle;

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

    loadData(): void {
        this.loading = true;
        this.cdr.markForCheck();

        this.analyticsService.getTopRequestedItems()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data: TopRequestedItems) => {
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
        const itemNames = data.items.map((item: RequestedItem) => item.itemName);
        const requestCounts = data.items.map((item: RequestedItem) => item.requestCount);

        this.chartOptions = {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
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
                    color: '#9ca3af',
                    fontSize: 11
                },
                splitLine: {
                    lineStyle: {
                        color: '#f3f4f6',
                        type: 'dashed'
                    }
                }
            },
            yAxis: {
                type: 'category',
                data: itemNames,
                axisLabel: {
                    color: '#9ca3af',
                    fontSize: 11
                },
                axisLine: {
                    lineStyle: {
                        color: '#e5e7eb'
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
                    color: '#6b7280',
                    fontSize: 11,
                    fontWeight: 600
                },
                barMaxWidth: 30
            }]
        };
        this.cdr.markForCheck();
    }
}
