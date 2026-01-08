import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { AdminAnalyticsService, InventoryDistribution } from '../../../../../core/services/admin-analytics.service';
import { Subject, takeUntil, forkJoin, map } from 'rxjs';
import { LucideAngularModule, RefreshCw, AlertCircle } from 'lucide-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-inventory-distribution-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsModule, LucideAngularModule, TranslateModule],
    templateUrl: './inventory-distribution-chart.component.html',
    styleUrl: './inventory-distribution-chart.component.css'
})
export class InventoryDistributionChartComponent implements OnInit, OnDestroy {
    // Icons
    readonly RefreshCw = RefreshCw;
    readonly AlertCircle = AlertCircle;

    private destroy$ = new Subject<void>();
    chartOptions: EChartsOption = {};
    loading = true;
    error = false;
    totalItems = 0;

    constructor(
        private analyticsService: AdminAnalyticsService,
        private translate: TranslateService
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
        this.analyticsService.getInventoryDistribution()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data) => {
                    this.totalItems = data.categories.reduce((acc, curr) => acc + curr.value, 0);
                    this.initChart(data);
                    this.loading = false;
                    this.error = false;
                },
                error: (err) => {
                    console.error('Error loading inventory distribution:', err);
                    this.loading = false;
                    this.error = true;
                }
            });
    }

    private initChart(data: InventoryDistribution): void {
        forkJoin(
            data.categories.map(cat => {
                const translationKey = `adminDashboard.charts.${cat.name.toLowerCase()}`;
                return this.translate.get(translationKey).pipe(
                    map((translatedName: string) => ({
                        name: translatedName === translationKey ? cat.name : translatedName,
                        value: cat.value
                    }))
                );
            })
        ).subscribe((chartData: any[]) => {
            this.chartOptions = {
                tooltip: {
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)',
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
                    orient: 'vertical',
                    left: 'left',
                    top: 'center',
                    icon: 'circle',
                    itemGap: 20,
                    textStyle: {
                        color: '#6b7280',
                        fontSize: 12
                    }
                },
                color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                series: [
                    {
                        name: 'Inventory Composition',
                        type: 'pie',
                        radius: ['50%', '80%'],
                        center: ['65%', '50%'],
                        avoidLabelOverlap: false,
                        itemStyle: {
                            borderRadius: 10,
                            borderColor: '#fff',
                            borderWidth: 2
                        },
                        label: {
                            show: false,
                            position: 'center'
                        },
                        emphasis: {
                            label: {
                                show: false
                            }
                        },
                        labelLine: {
                            show: false
                        },
                        data: chartData
                    }
                ]
            };
        });
    }
}
