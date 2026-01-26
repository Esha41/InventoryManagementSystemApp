import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { AdvancedAnalyticsService } from '@services/advanced-analytics.service';
import { UserLoginAnalyticsDto } from '@models/advanced-analytics.model';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, RefreshCw, AlertCircle, Users } from 'lucide-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ThemeService } from '@services/theme.service';

@Component({
    selector: 'app-user-login-analytics-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsModule, LucideAngularModule, TranslateModule],
    templateUrl: './user-login-analytics-chart.component.html',
    styleUrl: './user-login-analytics-chart.component.css'
})
export class UserLoginAnalyticsChartComponent implements OnInit, OnDestroy {
    // Icons
    readonly RefreshCw = RefreshCw;
    readonly AlertCircle = AlertCircle;
    readonly Users = Users;

    private destroy$ = new Subject<void>();
    private isInitializing = false;
    private trendChartInstance: any = null;
    private userChartInstance: any = null;
    chartOptions: EChartsOption | null = null;
    userChartOptions: EChartsOption | null = null;
    loading = true;
    error = false;
    analyticsData: UserLoginAnalyticsDto | null = null;
    
    // Chart initialization options
    chartInitOpts: any = {
        renderer: 'canvas',
        width: 'auto',
        height: 'auto'
    };

    constructor(
        private analyticsService: AdvancedAnalyticsService,
        private translate: TranslateService,
        private cdr: ChangeDetectorRef,
        private themeService: ThemeService
    ) { }

    ngOnInit(): void {
        this.loadData();
        // Subscribe to theme changes and update chart options when theme changes
        this.themeService.currentTheme$.pipe(takeUntil(this.destroy$)).subscribe(() => {
            if (this.analyticsData && this.chartOptions && this.userChartOptions) {
                // Reinitialize charts with new theme colors without reloading data
                this.initCharts(this.analyticsData);
            }
        });
    }

    ngOnDestroy(): void {
        // Dispose chart instances
        if (this.trendChartInstance) {
            this.trendChartInstance.dispose();
            this.trendChartInstance = null;
        }
        if (this.userChartInstance) {
            this.userChartInstance.dispose();
            this.userChartInstance = null;
        }
        this.destroy$.next();
        this.destroy$.complete();
    }

    onTrendChartInit(chartInstance: any): void {
        if (!chartInstance) {
            return;
        }
        
        // Only store if it's a new instance
        if (this.trendChartInstance !== chartInstance) {
            // If we have a different instance that's not disposed, dispose it
            if (this.trendChartInstance) {
                try {
                    const isDisposed = typeof this.trendChartInstance.isDisposed === 'function' 
                        ? this.trendChartInstance.isDisposed() 
                        : false;
                    if (typeof this.trendChartInstance.dispose === 'function' && 
                        !isDisposed &&
                        this.trendChartInstance !== chartInstance) {
                        this.trendChartInstance.dispose();
                    }
                } catch (error) {
                    // Error disposing old instance
                }
            }
            this.trendChartInstance = chartInstance;
        }
        
        // Resize chart after initialization to ensure proper rendering
        setTimeout(() => {
            if (chartInstance && typeof chartInstance.isDisposed === 'function' && !chartInstance.isDisposed()) {
                chartInstance.resize();
            } else if (chartInstance && typeof chartInstance.isDisposed !== 'function') {
                // Fallback if isDisposed method doesn't exist
                chartInstance.resize();
            }
        }, 50);
    }

    onUserChartInit(chartInstance: any): void {
        if (!chartInstance) {
            return;
        }
        
        // Only store if it's a new instance
        if (this.userChartInstance !== chartInstance) {
            // If we have a different instance that's not disposed, dispose it
            if (this.userChartInstance) {
                try {
                    const isDisposed = typeof this.userChartInstance.isDisposed === 'function' 
                        ? this.userChartInstance.isDisposed() 
                        : false;
                    if (typeof this.userChartInstance.dispose === 'function' && 
                        !isDisposed &&
                        this.userChartInstance !== chartInstance) {
                        this.userChartInstance.dispose();
                    }
                } catch (error) {
                    // Error disposing old instance
                }
            }
            this.userChartInstance = chartInstance;
        }
        
        // Resize chart after initialization to ensure proper rendering
        setTimeout(() => {
            if (chartInstance && typeof chartInstance.isDisposed === 'function' && !chartInstance.isDisposed()) {
                chartInstance.resize();
            } else if (chartInstance && typeof chartInstance.isDisposed !== 'function') {
                // Fallback if isDisposed method doesn't exist
                chartInstance.resize();
            }
        }, 50);
    }

    loadData(): void {
        if (this.isInitializing) {
            return; // Prevent multiple simultaneous loads
        }

        this.loading = true;
        this.error = false;
        this.isInitializing = true;
        this.cdr.detectChanges();

        // Don't dispose instances here - let ngx-echarts handle updates
        // Instances will be updated via setOption when new data arrives

        // Get data for last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        this.analyticsService.getUserLoginAnalytics(startDate, endDate)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data: any) => {
                    // Handle both camelCase and PascalCase property names
                    const normalizedData: UserLoginAnalyticsDto = {
                        userLogins: data.userLogins || data.UserLogins || [],
                        trendData: data.trendData || data.TrendData || [],
                        totalLogins: data.totalLogins || data.TotalLogins || 0,
                        uniqueUsers: data.uniqueUsers || data.UniqueUsers || 0,
                        averageLoginDurationHours: data.averageLoginDurationHours || data.AverageLoginDurationHours || 0,
                        activeUsersToday: data.activeUsersToday || data.ActiveUsersToday || 0
                    };
                    
                    // Normalize nested objects
                    if (normalizedData.userLogins.length > 0) {
                        normalizedData.userLogins = normalizedData.userLogins.map((u: any) => ({
                            userId: u.userId || u.UserId || '',
                            username: u.username || u.Username || '',
                            fullName: u.fullName || u.FullName,
                            loginCount: u.loginCount || u.LoginCount || 0,
                            totalLoginDurationHours: u.totalLoginDurationHours || u.TotalLoginDurationHours || 0,
                            averageLoginDurationHours: u.averageLoginDurationHours || u.AverageLoginDurationHours || 0,
                            lastLoginDate: u.lastLoginDate || u.LastLoginDate
                        }));
                    }
                    
                    if (normalizedData.trendData.length > 0) {
                        normalizedData.trendData = normalizedData.trendData.map((t: any) => ({
                            date: t.date || t.Date || '',
                            loginCount: t.loginCount || t.LoginCount || 0,
                            uniqueUsers: t.uniqueUsers || t.UniqueUsers || 0,
                            averageDurationHours: t.averageDurationHours || t.AverageDurationHours || 0
                        }));
                    }
                    
                    this.analyticsData = normalizedData;
                    // Initialize charts - this will set chartOptions and userChartOptions
                    this.initCharts(normalizedData);
                    // Note: chartOptions are set asynchronously inside initCharts (forkJoin)
                    // The template will show charts once chartOptions and userChartOptions are set
                    this.loading = false;
                    this.error = false;
                    this.isInitializing = false;
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    console.error('Error loading user login analytics:', err);
                    this.loading = false;
                    this.error = true;
                    this.isInitializing = false;
                    this.cdr.detectChanges();
                }
            });
    }

    private initCharts(data: UserLoginAnalyticsDto): void {
        // Don't dispose instances here - let ngx-echarts handle updates via setOption
        // Only dispose if we're completely reloading data (handled in loadData)

        const isDarkMode = this.themeService.isDarkMode();
        const textColor = isDarkMode ? '#E5E7EB' : '#1f2937';
        const mutedTextColor = isDarkMode ? '#9CA3AF' : '#6b7280';
        const axisLineColor = isDarkMode ? '#4B5563' : '#e5e7eb';
        const splitLineColor = isDarkMode ? '#4B5563' : '#f3f4f6';
        const tooltipBg = isDarkMode ? 'rgba(26, 29, 36, 0.95)' : 'rgba(255, 255, 255, 0.9)';
        const backgroundColor = isDarkMode ? '#1A1D24' : '#FFFFFF';

        forkJoin({
            loginTrend: this.translate.get('adminDashboard.charts.loginTrend'),
            uniqueUsers: this.translate.get('adminDashboard.charts.uniqueUsers'),
            loginCount: this.translate.get('adminDashboard.charts.loginCount'),
            date: this.translate.get('adminDashboard.charts.date'),
            topUsers: this.translate.get('adminDashboard.charts.topUsers'),
            loginDuration: this.translate.get('adminDashboard.charts.loginDuration'),
            hours: this.translate.get('adminDashboard.charts.hours'),
            totalLogins: this.translate.get('adminDashboard.charts.totalLogins'),
            averageDuration: this.translate.get('adminDashboard.charts.averageDuration')
        }).pipe(takeUntil(this.destroy$)).subscribe({
            next: (translations) => {
                this.initChartsWithTranslations(data, translations, isDarkMode, textColor, mutedTextColor, axisLineColor, splitLineColor, tooltipBg, backgroundColor);
            },
            error: (err) => {
                console.error('Error loading translations for charts:', err);
                // Fallback to English defaults if translations fail
                const fallbackTranslations = {
                    loginTrend: 'Login Trend',
                    uniqueUsers: 'Unique Users',
                    loginCount: 'Login Count',
                    date: 'Date',
                    topUsers: 'Top Users',
                    loginDuration: 'Login Duration',
                    hours: 'hours',
                    totalLogins: 'Total Logins',
                    averageDuration: 'Average Duration'
                };
                this.initChartsWithTranslations(data, fallbackTranslations, isDarkMode, textColor, mutedTextColor, axisLineColor, splitLineColor, tooltipBg, backgroundColor);
            }
        });
    }

    private initChartsWithTranslations(
        data: UserLoginAnalyticsDto,
        translations: any,
        isDarkMode: boolean,
        textColor: string,
        mutedTextColor: string,
        axisLineColor: string,
        splitLineColor: string,
        tooltipBg: string,
        backgroundColor: string
    ): void {
        // Trend Chart (Login count over time)
        const trendDates = (data.trendData || []).map(t => {
            try {
                const date = new Date(t.date);
                return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } catch {
                return '';
            }
        }).filter(d => d !== '');
        const loginCounts = (data.trendData || []).map(t => t.loginCount || 0);
        const uniqueUsersData = (data.trendData || []).map(t => t.uniqueUsers || 0);
        
        // If no data, show empty chart with message
        if (trendDates.length === 0) {
            trendDates.push('No Data');
            loginCounts.push(0);
            uniqueUsersData.push(0);
        }

        // Define series names first to ensure they match legend exactly
        // Use consistent string conversion to avoid any type mismatches
        const loginCountSeriesName = String(translations.loginCount || 'Login Count');
        const uniqueUsersSeriesName = String(translations.uniqueUsers || 'Unique Users');

        // Create new options object to ensure ECharts recognizes it as a new configuration
        this.chartOptions = {
            backgroundColor: backgroundColor, // Use theme-aware background color
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
                data: [loginCountSeriesName, uniqueUsersSeriesName],
                bottom: 0,
                icon: 'circle',
                textStyle: {
                    color: mutedTextColor,
                    fontSize: 12
                },
                selectedMode: true
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
                data: trendDates,
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
                    name: loginCountSeriesName,
                    type: 'line',
                    smooth: true,
                    data: loginCounts,
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
                    name: uniqueUsersSeriesName,
                    type: 'line',
                    smooth: true,
                    data: uniqueUsersData,
                    symbolSize: 8,
                    lineStyle: {
                        width: 4,
                        color: '#10b981'
                    },
                    itemStyle: {
                        color: '#10b981',
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
                                { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
                                { offset: 1, color: 'rgba(16, 185, 129, 0.01)' }
                            ]
                        }
                    }
                }
            ]
        };

        // User Login Duration Chart (Top users by login duration)
        const topUsers = (data.userLogins || []).slice(0, 10); // Top 10 users
        const userNames = topUsers.length > 0 
            ? topUsers.map(u => u.fullName || u.username || 'Unknown')
            : ['No Data'];
        const loginDurations = topUsers.length > 0
            ? topUsers.map(u => parseFloat((u.totalLoginDurationHours || 0).toFixed(2)))
            : [0];

        const loginDurationSeriesName = String(translations.loginDuration || 'Login Duration');

        // Create new options object to ensure ECharts recognizes it as a new configuration
        this.userChartOptions = {
            backgroundColor: backgroundColor, // Use theme-aware background color
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                },
                backgroundColor: tooltipBg,
                textStyle: {
                    color: textColor
                },
                formatter: (params: any) => {
                    if (!params || !params.length || !topUsers.length) return '';
                    const param = params[0];
                    const user = topUsers[param.dataIndex];
                    if (!user) return '';
                    return `${param.name}<br/>${translations.totalLogins || 'Total Logins'}: ${user.loginCount || 0}<br/>${translations.loginDuration || 'Login Duration'}: ${param.value} ${translations.hours || 'hours'}<br/>${translations.averageDuration || 'Average Duration'}: ${(user.averageLoginDurationHours || 0).toFixed(2)} ${translations.hours || 'hours'}`;
                },
                borderRadius: 8,
                padding: 12
            },
            grid: {
                left: '15%',
                right: '4%',
                bottom: '10%',
                top: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                axisLine: {
                    lineStyle: {
                        color: axisLineColor
                    }
                },
                axisLabel: {
                    color: mutedTextColor,
                    fontSize: 11,
                    formatter: (value: number) => `${value} ${translations.hours || 'hours'}`
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
                data: userNames,
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
            series: [
                {
                    name: loginDurationSeriesName,
                    type: 'bar',
                    data: loginDurations,
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 1,
                            y2: 0,
                            colorStops: [
                                { offset: 0, color: '#3b82f6' },
                                { offset: 1, color: '#8b5cf6' }
                            ]
                        }
                    },
                    barWidth: '60%',
                    label: {
                        show: true,
                        position: 'right',
                        color: mutedTextColor,
                        fontSize: 11,
                        formatter: (params: any) => `${params.value} ${translations.hours || 'hours'}`
                    }
                }
            ]
        };
        
        // Update existing chart instances if they exist using setOption
        // This prevents re-initialization and uses ECharts' built-in update mechanism
        setTimeout(() => {
            try {
                if (this.trendChartInstance && this.chartOptions) {
                    // Check if instance is valid before updating
                    if (typeof this.trendChartInstance.setOption === 'function') {
                        if (typeof this.trendChartInstance.isDisposed === 'function') {
                            if (!this.trendChartInstance.isDisposed()) {
                                this.trendChartInstance.setOption(this.chartOptions as any, { notMerge: false });
                                this.trendChartInstance.resize();
                            }
                        } else {
                            // Fallback if isDisposed doesn't exist
                            this.trendChartInstance.setOption(this.chartOptions as any, { notMerge: false });
                            this.trendChartInstance.resize();
                        }
                    }
                }
                if (this.userChartInstance && this.userChartOptions) {
                    // Check if instance is valid before updating
                    if (typeof this.userChartInstance.setOption === 'function') {
                        if (typeof this.userChartInstance.isDisposed === 'function') {
                            if (!this.userChartInstance.isDisposed()) {
                                this.userChartInstance.setOption(this.userChartOptions as any, { notMerge: false });
                                this.userChartInstance.resize();
                            }
                        } else {
                            // Fallback if isDisposed doesn't exist
                            this.userChartInstance.setOption(this.userChartOptions as any, { notMerge: false });
                            this.userChartInstance.resize();
                        }
                    }
                }
            } catch (error) {
                // Ignore errors during update - charts will be recreated if needed
            }
        }, 100);
        
        this.cdr.detectChanges();
    }
}
