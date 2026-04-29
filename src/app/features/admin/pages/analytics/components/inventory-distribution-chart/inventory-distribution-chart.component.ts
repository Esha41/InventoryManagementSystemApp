import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import type { CategoryDistribution, InventoryDistribution, InventoryPieSlice } from '@admin/models/admin-analytics.model';
import { Subject, takeUntil, forkJoin, map } from 'rxjs';
import { LucideAngularModule, RefreshCw, AlertCircle } from 'lucide-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ThemeService } from '@services/theme.service';

@Component({
    selector: 'app-inventory-distribution-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsModule, LucideAngularModule, TranslateModule],
    templateUrl: './inventory-distribution-chart.component.html',
    styleUrl: './inventory-distribution-chart.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryDistributionChartComponent implements OnInit, OnDestroy, OnChanges {
    @Input() distribution: InventoryDistribution | undefined;

    // Icons
    readonly RefreshCw = RefreshCw;
    readonly AlertCircle = AlertCircle;

    private destroy$ = new Subject<void>();
    chartOptions: EChartsOption = {};
    totalItems = 0;

    constructor(
        private translate: TranslateService,
        private themeService: ThemeService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        // Subscribe to theme changes and reload chart when theme changes
        this.themeService.currentTheme$.pipe(takeUntil(this.destroy$)).subscribe(() => {
            if (this.distribution) {
                this.initChart();
            }
            this.cdr.markForCheck();
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['distribution'] && this.distribution) {
            this.totalItems = this.distribution.categories.reduce((acc, curr) => acc + curr.value, 0);
            this.initChart();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initChart(): void {
        if (!this.distribution) return;

        const isDarkMode = this.themeService.isDarkMode();
        const textColor = isDarkMode ? '#E5E7EB' : '#1f2937';
        const mutedTextColor = isDarkMode ? '#9CA3AF' : '#6b7280';
        const tooltipBg = isDarkMode ? 'rgba(26, 29, 36, 0.95)' : 'rgba(255, 255, 255, 0.9)';
        const backgroundColor = 'transparent'; // Let container bg handle it
        const borderColor = isDarkMode ? '#1e293b' : '#ffffff';

        forkJoin(
            this.distribution.categories.map((cat: CategoryDistribution) => {
                const translationKey = `adminDashboard.charts.${cat.name.toLowerCase()}`;
                return this.translate.get(translationKey).pipe(
                    map((translatedName: string): InventoryPieSlice => ({
                        name: translatedName === translationKey ? cat.name : translatedName,
                        value: cat.value
                    }))
                );
            })
        ).subscribe((chartData: InventoryPieSlice[]) => {
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
                    orient: 'horizontal',
                    left: 'center',
                    bottom: '0',
                    top: 'auto',
                    icon: 'circle',
                    itemGap: 15,
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
                        radius: ['45%', '70%'],
                        center: ['50%', '45%'],
                        avoidLabelOverlap: true,
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
                            scale: true,
                            scaleSize: 10,
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
            this.cdr.markForCheck();
        });
    }
}
