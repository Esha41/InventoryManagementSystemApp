import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { AdminAnalyticsService, InventoryDistribution } from '@services/admin-analytics.service';
import { Subject, takeUntil, forkJoin, map } from 'rxjs';
import { LucideAngularModule, RefreshCw, AlertCircle } from 'lucide-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ThemeService } from '@services/theme.service';

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
        private translate: TranslateService,
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

    loadData(): void {
        this.loading = true;
        this.analyticsService.getInventoryDistribution()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data: InventoryDistribution) => {
                    this.totalItems = data.categories.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0);
                    this.initChart(data);
                    this.loading = false;
                    this.error = false;
                },
                error: (err: any) => {
                    console.error('Error loading inventory distribution:', err);
                    this.loading = false;
                    this.error = true;
                }
            });
    }

    private initChart(data: InventoryDistribution): void {
        const isDarkMode = this.themeService.isDarkMode();
        const textColor = isDarkMode ? '#E5E7EB' : '#1f2937';
        const mutedTextColor = isDarkMode ? '#9CA3AF' : '#6b7280';
        const tooltipBg = isDarkMode ? 'rgba(26, 29, 36, 0.95)' : 'rgba(255, 255, 255, 0.9)';
        const backgroundColor = isDarkMode ? '#1A1D24' : '#FFFFFF';
        const borderColor = backgroundColor;

        forkJoin(
            data.categories.map((cat: any) => {
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
                backgroundColor: backgroundColor,
                tooltip: {
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)',
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
                    orient: 'vertical',
                    left: 'left',
                    top: 'center',
                    icon: 'circle',
                    itemGap: 20,
                    textStyle: {
                        color: mutedTextColor,
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
                            borderColor: borderColor,
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
