import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, combineLatest, interval } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, RefreshCw, TrendingUp, BarChart3, Gauge, AlertTriangle, ChevronRight, Home, Settings, Eye, EyeOff, Clock, Power } from 'lucide-angular';
import { AdvancedAnalyticsService } from '@services/advanced-analytics.service';
import { LoggingService } from '@services/logging.service';
import { StorageService } from '@services/storage.service';
import {
  AdvancedAnalyticsDashboardDto,
  MissionReadinessDto,
  StockAvailabilityDto,
  OrderCycleTimeDto,
  ConsumptionForecastDto,
  DrillDownRequestDto,
  DashboardPreset,
  KpiCardLayout,
  ChartLayout,
  OrderStatusDistributionDto,
  RequestTrendsDto,
  InventoryValueDto,
  AssetAssignmentStatusDto,
  SupplyFulfillmentStatusDto,
  DepartmentRequestVolumeDto,
  NotificationStatisticsDto,
  ImportExportStatisticsDto
} from '@models/advanced-analytics.model';
import { NgxEchartsModule, provideEchartsCore } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import { UserLoginAnalyticsChartComponent } from '../analytics/components/user-login-analytics-chart/user-login-analytics-chart.component';

/**
 * Advanced Analytics Dashboard Component
 * Comprehensive KPIs and analytics for command staff decision-making
 */
@Component({
  selector: 'app-advanced-analytics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    NgxEchartsModule,
    UserLoginAnalyticsChartComponent,
    DragDropModule
  ],
  providers: [
    provideEchartsCore({ echarts: () => import('echarts') })
  ],
  templateUrl: './advanced-analytics-dashboard.component.html',
  styleUrls: ['./advanced-analytics-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdvancedAnalyticsDashboardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // Icons
  readonly RefreshCw = RefreshCw;
  readonly TrendingUp = TrendingUp;
  readonly BarChart3 = BarChart3;
  readonly Gauge = Gauge;
  readonly AlertTriangle = AlertTriangle;
  readonly ChevronRight = ChevronRight;
  readonly Home = Home;
  readonly Settings = Settings;
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Clock = Clock;
  readonly Power = Power;

  // Dashboard data
  dashboardData: AdvancedAnalyticsDashboardDto | null = null;
  missionReadiness: MissionReadinessDto | null = null;
  stockAvailability: StockAvailabilityDto | null = null;
  orderCycleTime: OrderCycleTimeDto | null = null;
  consumptionForecast: ConsumptionForecastDto | null = null;
  orderStatusDistribution: OrderStatusDistributionDto | null = null;
  requestTrends: RequestTrendsDto | null = null;
  inventoryValue: InventoryValueDto | null = null;
  assetAssignmentStatus: AssetAssignmentStatusDto | null = null;
  supplyFulfillmentStatus: SupplyFulfillmentStatusDto | null = null;
  departmentRequestVolume: DepartmentRequestVolumeDto | null = null;
  notificationStatistics: NotificationStatisticsDto | null = null;
  importExportStatistics: ImportExportStatisticsDto | null = null;

  // Loading states
  isLoading = true;
  isRefreshing = false;
  error: string | null = null;

  // Date filters
  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedWarehouseId: number | null = null;

  // Drill-down state
  drillDownPath: Array<{ label: string; kpiType?: string; level?: string; id?: number }> = [];
  drillDownData: any = null;
  isDrillDownMode = false;

  // Customization state
  visibleKpis: Set<string> = new Set(['importExport', 'stockAvailability', 'orderCycleTime', 'consumptionForecast']);
  visibleCharts: Set<string> = new Set([
    'importExport', 'stockAvailability', 'orderCycleTime', 'consumptionForecast',
    'orderStatusDistribution', 'requestTrends', 'inventoryValue', 
    'assetAssignmentStatus', 'supplyFulfillmentStatus', 'departmentRequestVolume',
    'notificationStatistics', 'notificationTrends', 'notificationByType', 'notificationReadStatus',
    'userLoginAnalytics'
  ]);
  showCustomizationPanel = false;
  dashboardPresets: DashboardPreset[] = [];
  currentPreset: DashboardPreset | null = null;

  // Drag and drop: Ordered arrays for KPIs and Charts
  kpiOrder: string[] = ['importExport', 'stockAvailability', 'orderCycleTime', 'consumptionForecast'];
  chartOrder: string[] = [
    'importExport', 'stockAvailability', 'orderCycleTime', 'consumptionForecast',
    'orderStatusDistribution', 'requestTrends', 'inventoryValue',
    'assetAssignmentStatus', 'supplyFulfillmentStatus', 'departmentRequestVolume',
    'notificationTrends', 'notificationByType', 'notificationReadStatus',
    'userLoginAnalytics'
  ];

  // Cached ordered visible arrays for drag-and-drop
  orderedVisibleKpis: string[] = [];
  orderedVisibleCharts: string[] = [];

  // Chart instances for event handling
  private chartInstances: Map<string, any> = new Map();
  
  // Cached chart options to prevent unnecessary re-initialization
  private cachedChartOptions: Map<string, EChartsOption> = new Map();
  private chartDataHashes: Map<string, string> = new Map();
  
  // Flag to prevent chart re-initialization during data updates
  isUpdatingCharts = false;

  // Chart initialization options - prevent re-initialization
  chartInitOpts: any = {
    renderer: 'canvas',
    width: 'auto',
    height: 'auto'
  };

  // Chart merge options - use merge mode to update instead of re-initialize
  chartMerge: any = {
    notMerge: false, // Merge updates
    lazyUpdate: false
  };

  // Expose Math for template use
  readonly Math = Math;

  // Prevent duplicate drill-down requests
  private isDrillingDown = false;

  // Auto-refresh settings
  autoRefreshEnabled = true;
  autoRefreshInterval = 300000; // 5 minutes in milliseconds
  lastRefreshTime: Date | null = null;
  private autoRefreshSubscription: any = null;

  constructor(
    private advancedAnalyticsService: AdvancedAnalyticsService,
    private cdr: ChangeDetectorRef,
    private loggingService: LoggingService,
    private storageService: StorageService
  ) {
    // Initialize date range (last 90 days)
    this.endDate = new Date();
    this.startDate = new Date();
    this.startDate.setDate(this.startDate.getDate() - 90);
    
    // Load saved dashboard preferences
    this.loadDashboardPreferences();
  }

  ngOnInit(): void {
    this.loadAutoRefreshSettings();
    this.loadDashboard();
    this.startAutoRefresh();
    this.updateOrderedArrays(); // Initialize ordered arrays
  }

  ngOnDestroy(): void {
    // Dispose all chart instances
    this.chartInstances.forEach((chartInstance, chartId) => {
      if (chartInstance && typeof chartInstance.dispose === 'function') {
        try {
          chartInstance.dispose();
        } catch (error) {
          this.loggingService.error(`Error disposing chart ${chartId}`, error);
        }
      }
    });
    this.chartInstances.clear();

    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(): void {
    // Stop existing subscription if any
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }

    if (this.autoRefreshEnabled) {
      this.autoRefreshSubscription = interval(this.autoRefreshInterval)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (!this.isLoading && !this.isRefreshing && !this.isDrillDownMode) {
            this.onRefresh();
          }
        });
    }
  }

  /**
   * Load auto-refresh settings from storage
   */
  private loadAutoRefreshSettings(): void {
    const settings = this.storageService.get<any>('advancedAnalyticsAutoRefresh');
    if (settings) {
      this.autoRefreshEnabled = settings.enabled !== false;
      this.autoRefreshInterval = settings.interval || 300000; // Default to 5 minutes
    } else {
      // First time load - set default to 5 minutes and save it
      this.autoRefreshEnabled = true;
      this.autoRefreshInterval = 300000; // 5 minutes in milliseconds
      this.saveAutoRefreshSettings();
    }
  }

  /**
   * Save auto-refresh settings to storage
   */
  private saveAutoRefreshSettings(): void {
    this.storageService.set('advancedAnalyticsAutoRefresh', {
      enabled: this.autoRefreshEnabled,
      interval: this.autoRefreshInterval
    });
  }

  /**
   * Toggle auto-refresh
   */
  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    this.saveAutoRefreshSettings();
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
    }
  }

  /**
   * Set auto-refresh interval
   */
  setAutoRefreshInterval(minutes: number): void {
    this.autoRefreshInterval = minutes * 60 * 1000;
    this.saveAutoRefreshSettings();
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
    }
  }

  /**
   * Load complete dashboard data
   */
  loadDashboard(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.advancedAnalyticsService
      .getDashboard(this.startDate || undefined, this.endDate || undefined, this.selectedWarehouseId || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (!data) {
            this.error = 'No data received from server.';
            this.isLoading = false;
            this.isRefreshing = false;
            this.cdr.markForCheck();
            return;
          }

          this.dashboardData = data;
          // Handle both camelCase and PascalCase property names
          this.missionReadiness = (data as any).missionReadiness || (data as any).MissionReadiness || null;
          this.stockAvailability = (data as any).stockAvailability || (data as any).StockAvailability || null;
          this.orderCycleTime = (data as any).orderCycleTime || (data as any).OrderCycleTime || null;
          this.consumptionForecast = (data as any).consumptionForecast || (data as any).ConsumptionForecast || null;
          this.orderStatusDistribution = (data as any).orderStatusDistribution || (data as any).OrderStatusDistribution || null;
          this.requestTrends = (data as any).requestTrends || (data as any).RequestTrends || null;
          this.inventoryValue = (data as any).inventoryValue || (data as any).InventoryValue || null;
          this.assetAssignmentStatus = (data as any).assetAssignmentStatus || (data as any).AssetAssignmentStatus || null;
          this.supplyFulfillmentStatus = (data as any).supplyFulfillmentStatus || (data as any).SupplyFulfillmentStatus || null;
          this.departmentRequestVolume = (data as any).departmentRequestVolume || (data as any).DepartmentRequestVolume || null;
          this.notificationStatistics = (data as any).notificationStatistics || (data as any).NotificationStatistics || null;
          this.importExportStatistics = (data as any).importExportStatistics || (data as any).ImportExportStatistics || null;
          
          // Clear cached chart options to force recalculation with new data
          this.cachedChartOptions.clear();
          this.chartDataHashes.clear();
          
          // Update ordered arrays after all data loads
          this.updateOrderedArrays();
          
          this.isLoading = false;
          this.isRefreshing = false;
          this.error = null;
          this.lastRefreshTime = new Date();
          this.isUpdatingCharts = false; // Allow charts to render immediately
          
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.loggingService.error('Error loading Advanced Analytics Dashboard', error);
          
          // Extract error message
          let errorMessage = 'Failed to load dashboard data. Please try again.';
          if (error?.error?.message) {
            errorMessage = error.error.message;
          } else if (error?.message) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
          
          this.error = errorMessage;
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Manually refresh dashboard
   */
  onRefresh(): void {
    this.isRefreshing = true;
    this.cdr.markForCheck();
    this.loadDashboard();
  }

  /**
   * Handle date range change
   */
  onDateRangeChange(startDate: Date | null, endDate: Date | null): void {
    this.startDate = startDate;
    this.endDate = endDate;
    this.loadDashboard();
  }

  /**
   * Handle warehouse filter change
   */
  onWarehouseChange(warehouseId: number | null): void {
    this.selectedWarehouseId = warehouseId;
    this.loadDashboard();
  }

  /**
   * Get status color for Mission Readiness
   */
  getReadinessStatusColor(status: string): string {
    switch (status) {
      case 'Green': return '#10b981'; // green-500
      case 'Amber': return '#f59e0b'; // amber-500
      case 'Red': return '#ef4444'; // red-500
      default: return '#6b7280'; // gray-500
    }
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  /**
   * Format number with commas
   */
  formatNumber(value: number): string {
    return value.toLocaleString();
  }

  /**
   * Get availability color based on rate
   */
  getAvailabilityColor(rate: number): string {
    if (rate >= 90) return '#10b981'; // green
    if (rate >= 70) return '#f59e0b'; // amber
    return '#ef4444'; // red
  }

  /**
   * Get availability status text
   */
  getAvailabilityStatus(rate: number): string {
    if (rate >= 90) return 'Good';
    if (rate >= 70) return 'Fair';
    return 'Low';
  }

  /**
   * Get availability status CSS class
   */
  getAvailabilityStatusClass(rate: number): string {
    if (rate >= 90) return 'status-good';
    if (rate >= 70) return 'status-fair';
    return 'status-low';
  }

  /**
   * Get severity color
   */
  getSeverityColor(severity: number): string {
    if (severity >= 0.8) return '#ef4444'; // red
    if (severity >= 0.5) return '#f59e0b'; // amber
    return '#10b981'; // green
  }

  /**
   * Get readiness status from rate
   */
  getReadinessStatus(rate: number): string {
    if (rate >= 95) return 'Green';
    if (rate >= 85) return 'Amber';
    return 'Red';
  }

  /**
   * Chart Options Methods - All charts are DYNAMIC and pull data from the database
   * 
   * IMPORTANT: All charts use real-time data from the database via the backend API.
   * No dummy or hardcoded data is used. Data sources:
   * - Mission Readiness: Asset status from database
   * - Stock Availability: Inventory levels from database  
   * - Order Cycle Time: Supply order completion times from database
   * - Consumption Forecast: Actual consumption vs forecasts from database
   * - Order Status Distribution: Order statuses from database
   * - Request Trends: Request history from database
   * - Inventory Value: Warehouse inventory values from database
   * - Asset Assignment Status: Asset assignments from database
   * - Supply Fulfillment Status: Supply fulfillment data from database
   * - Department Request Volume: Department request data from database
   * - Notification Statistics: Notification data from database
   * 
   * Data is automatically refreshed every 5 minutes (configurable) via auto-refresh.
   * Charts update in real-time when database data changes.
   */

  /**
   * Get Import/Export Chart Options (Multi-line Chart - same style as Notification Trends)
   * Data source: Database via /api/AdvancedAnalytics/dashboard endpoint
   */
  getImportExportChartOptions(): EChartsOption {
    if (!this.importExportStatistics || !this.importExportStatistics.trendData.length) {
      return {};
    }

    // Create a hash of the data to check if it has changed
    const dataHash = JSON.stringify(this.importExportStatistics.trendData);
    const chartId = 'importExport';
    
    // Return cached options if data hasn't changed
    if (this.chartDataHashes.get(chartId) === dataHash && this.cachedChartOptions.has(chartId)) {
      // Update existing instance if available instead of returning new options
      const instance = this.chartInstances.get(chartId);
      if (instance && typeof instance.setOption === 'function') {
        try {
          const cached = this.cachedChartOptions.get(chartId)!;
          instance.setOption(cached, { notMerge: false });
        } catch (error) {
          // Error updating instance
        }
      }
      return this.cachedChartOptions.get(chartId)!;
    }

    const dates = this.importExportStatistics.trendData.map(d => new Date(d.date).toLocaleDateString());
    const importCounts = this.importExportStatistics.trendData.map(d => d.importCount);
    const exportCounts = this.importExportStatistics.trendData.map(d => d.exportCount);

    const options: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Imports', 'Exports']
      },
      xAxis: {
        type: 'category',
        data: dates
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: 'Imports',
          data: importCounts,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#3b82f6' }
        },
        {
          name: 'Exports',
          data: exportCounts,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#10b981' }
        }
      ]
    } as EChartsOption;
    
    // Cache the options and data hash
    this.cachedChartOptions.set(chartId, options);
    this.chartDataHashes.set(chartId, dataHash);
    
    // Update existing instance if available
    const instance = this.chartInstances.get(chartId);
    if (instance && typeof instance.setOption === 'function') {
      try {
        // Check if instance is disposed before trying to update
        const isDisposed = typeof instance.isDisposed === 'function' 
          ? instance.isDisposed() 
          : false;
        
        if (!isDisposed) {
          instance.setOption(options, { notMerge: false });
        }
      } catch (error) {
        // Error updating instance
      }
    }
    
    return options;
  }

  /**
   * Get Stock Availability Chart Options
   */
  getStockAvailabilityChartOptions(): EChartsOption {
    if (!this.stockAvailability || !this.stockAvailability.byWarehouse.length) {
      return {};
    }

    const warehouses = this.stockAvailability.byWarehouse.map(w => w.warehouseName);
    const availabilityRates = this.stockAvailability.byWarehouse.map(w => w.availabilityRate);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      xAxis: {
        type: 'category',
        data: warehouses
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%'
        }
      },
      series: [{
        name: 'Availability Rate',
        data: availabilityRates,
        type: 'bar',
        itemStyle: { color: '#10b981' }
      }]
    } as EChartsOption;
  }

  /**
   * Get Order Cycle Time Chart Options
   */
  getOrderCycleTimeChartOptions(): EChartsOption {
    if (!this.orderCycleTime || !this.orderCycleTime.trendData.length) {
      return {};
    }

    const dates = this.orderCycleTime.trendData.map(d => new Date(d.date).toLocaleDateString());
    const cycleTimes = this.orderCycleTime.trendData.map(d => d.averageCycleTimeDays);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      xAxis: {
        type: 'category',
        data: dates
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value} days'
        }
      },
      series: [{
        name: 'Cycle Time',
        data: cycleTimes,
        type: 'line',
        smooth: true,
        itemStyle: { color: '#8b5cf6' }
      }]
    } as EChartsOption;
  }

  /**
   * Get Consumption Forecast Chart Options
   */
  getConsumptionForecastChartOptions(): EChartsOption {
    if (!this.consumptionForecast || !this.consumptionForecast.trendData.length) {
      return {};
    }

    const dates = this.consumptionForecast.trendData.map(d => new Date(d.date).toLocaleDateString());
    const actual = this.consumptionForecast.trendData.map(d => d.actualConsumption);
    const forecast = this.consumptionForecast.trendData.map(d => d.forecastedConsumption);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Actual', 'Forecast']
      },
      xAxis: {
        type: 'category',
        data: dates
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: 'Actual',
          data: actual,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#3b82f6' }
        },
        {
          name: 'Forecast',
          data: forecast,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#10b981' },
          lineStyle: { type: 'dashed' }
        }
      ]
    } as EChartsOption;
  }

  /**
   * Get Order Status Distribution Chart Options (Pie Chart)
   */
  getOrderStatusDistributionChartOptions(): EChartsOption {
    if (!this.orderStatusDistribution || !this.orderStatusDistribution.statusDistribution.length) {
      return {};
    }

    const data = this.orderStatusDistribution.statusDistribution.map(s => ({
      value: s.count,
      name: s.status
    }));

    // Extract legend data from series data names
    const legendData = data.map(item => item.name);

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const percent = Math.round(params.percent || 0);
          return `${params.seriesName}<br/>${params.name}: ${params.value} (${percent}%)`;
        }
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        data: legendData
      },
      series: [{
        name: 'Order Status',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: (params: any) => {
            const percent = Math.round(params.percent || 0);
            return `${params.name}: ${params.value}\n(${percent}%)`;
          }
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: data
      }]
    } as EChartsOption;
  }

  /**
   * Get Request Trends Chart Options (Multi-line Chart)
   */
  getRequestTrendsChartOptions(): EChartsOption {
    if (!this.requestTrends || !this.requestTrends.trendData.length) {
      return {};
    }

    const dates = this.requestTrends.trendData.map(d => new Date(d.date).toLocaleDateString());
    const orders = this.requestTrends.trendData.map(d => d.orderCount);
    const returns = this.requestTrends.trendData.map(d => d.returnCount);
    const discards = this.requestTrends.trendData.map(d => d.discardCount);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Orders', 'Returns', 'Discards']
      },
      xAxis: {
        type: 'category',
        data: dates
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: 'Orders',
          data: orders,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#3b82f6' }
        },
        {
          name: 'Returns',
          data: returns,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#10b981' }
        },
        {
          name: 'Discards',
          data: discards,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#ef4444' }
        }
      ]
    } as EChartsOption;
  }

  /**
   * Get Inventory Value Chart Options (Bar Chart)
   */
  getInventoryValueChartOptions(): EChartsOption {
    if (!this.inventoryValue || !this.inventoryValue.byWarehouse.length) {
      return {};
    }

    const warehouses = this.inventoryValue.byWarehouse.map(w => w.warehouseName);
    const values = this.inventoryValue.byWarehouse.map(w => w.totalValue);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const data = params[0];
          const warehouse = this.inventoryValue!.byWarehouse[data.dataIndex];
          return `${data.name}<br/>Value: ${this.formatCurrency(warehouse.totalValue)}<br/>Items: ${warehouse.itemCount}<br/>Low Stock: ${warehouse.lowStockItems}`;
        }
      },
      xAxis: {
        type: 'category',
        data: warehouses,
        axisLabel: {
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => this.formatCurrency(value)
        }
      },
      series: [{
        name: 'Inventory Value',
        data: values,
        type: 'bar',
        itemStyle: {
          color: (params: any) => {
            const warehouse = this.inventoryValue!.byWarehouse[params.dataIndex];
            return warehouse.lowStockItems > 0 ? '#ef4444' : '#10b981';
          }
        }
      }]
    } as EChartsOption;
  }

  /**
   * Get Asset Assignment Status Chart Options (Donut Chart)
   */
  getAssetAssignmentStatusChartOptions(): EChartsOption {
    if (!this.assetAssignmentStatus || !this.assetAssignmentStatus.statusDistribution.length) {
      return {};
    }

    const data = this.assetAssignmentStatus.statusDistribution.map(s => ({
      value: s.count,
      name: s.status
    }));

    // Extract legend data from series data names
    const legendData = data.map(item => item.name);

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const percent = Math.round(params.percent || 0);
          return `${params.seriesName}<br/>${params.name}: ${params.value} (${percent}%)`;
        }
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        data: legendData
      },
      series: [{
        name: 'Asset Status',
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: (params: any) => {
            const percent = Math.round(params.percent || 0);
            return `${params.name}: ${params.value}\n(${percent}%)`;
          }
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: data
      }]
    } as EChartsOption;
  }

  /**
   * Get Supply Fulfillment Status Chart Options (Using Request Trends Style)
   */
  getSupplyFulfillmentStatusChartOptions(): EChartsOption {
    if (!this.supplyFulfillmentStatus || !this.supplyFulfillmentStatus.statusDistribution.length) {
      return {};
    }

    const statuses = this.supplyFulfillmentStatus.statusDistribution.map(s => s.status);
    const counts = this.supplyFulfillmentStatus.statusDistribution.map(s => s.count);

    // Use similar color scheme as Request Trends chart
    const getStatusColor = (status: string): string => {
      switch (status.toLowerCase()) {
        case 'fully':
          return '#10b981'; // Green (same as Returns in Request Trends)
        case 'partial':
          return '#f59e0b'; // Amber
        case 'pending':
          return '#3b82f6'; // Blue (same as Orders in Request Trends)
        case 'none':
          return '#ef4444'; // Red (same as Discards in Request Trends)
        default:
          return '#6b7280'; // Gray
      }
    };

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      xAxis: {
        type: 'category',
        data: statuses
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        name: 'Supply Count',
        data: counts,
        type: 'bar',
        itemStyle: {
          color: (params: any) => {
            return getStatusColor(statuses[params.dataIndex]);
          }
        }
      }]
    } as EChartsOption;
  }

  /**
   * Get Department Request Volume Chart Options (Stacked Bar Chart)
   */
  getDepartmentRequestVolumeChartOptions(): EChartsOption {
    if (!this.departmentRequestVolume || !this.departmentRequestVolume.byDepartment.length) {
      return {};
    }

    const departments = this.departmentRequestVolume.byDepartment.map(d => d.departmentName);
    const orders = this.departmentRequestVolume.byDepartment.map(d => d.orderCount);
    const returns = this.departmentRequestVolume.byDepartment.map(d => d.returnCount);
    const discards = this.departmentRequestVolume.byDepartment.map(d => d.discardCount);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      legend: {
        data: ['Orders', 'Returns', 'Discards']
      },
      xAxis: {
        type: 'category',
        data: departments,
        axisLabel: {
          rotate: 45
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: 'Orders',
          data: orders,
          type: 'bar',
          stack: 'requests',
          itemStyle: { color: '#3b82f6' }
        },
        {
          name: 'Returns',
          data: returns,
          type: 'bar',
          stack: 'requests',
          itemStyle: { color: '#10b981' }
        },
        {
          name: 'Discards',
          data: discards,
          type: 'bar',
          stack: 'requests',
          itemStyle: { color: '#ef4444' }
        }
      ]
    } as EChartsOption;
  }

  /**
   * Format currency value
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  /**
   * Get Notification Trends Chart Options (Multi-line Chart)
   */
  getNotificationTrendsChartOptions(): EChartsOption {
    if (!this.notificationStatistics || !this.notificationStatistics.trendData.length) {
      return {};
    }

    const dates = this.notificationStatistics.trendData.map(d => new Date(d.date).toLocaleDateString());
    const sent = this.notificationStatistics.trendData.map(d => d.sentCount);
    const read = this.notificationStatistics.trendData.map(d => d.readCount);
    const unread = this.notificationStatistics.trendData.map(d => d.unreadCount);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Sent', 'Read', 'Unread']
      },
      xAxis: {
        type: 'category',
        data: dates
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: 'Sent',
          data: sent,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#3b82f6' }
        },
        {
          name: 'Read',
          data: read,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#10b981' }
        },
        {
          name: 'Unread',
          data: unread,
          type: 'line',
          smooth: true,
          itemStyle: { color: '#ef4444' }
        }
      ]
    } as EChartsOption;
  }

  /**
   * Get Notification By Type Chart Options (Pie Chart)
   */
  getNotificationByTypeChartOptions(): EChartsOption {
    if (!this.notificationStatistics || !this.notificationStatistics.byType.length) {
      return {};
    }

    // Handle both camelCase and PascalCase property names from backend
    const data = this.notificationStatistics.byType.map(t => ({
      value: t.count,
      name: (t as any).entityType || (t as any).EntityType || (t as any).type || 'Unknown'
    }));

    // Extract legend data from series data names
    const legendData = data.map(item => item.name);

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const percent = Math.round(params.percent || 0);
          return `${params.seriesName}<br/>${params.name}: ${params.value} (${percent}%)`;
        }
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        data: legendData
      },
      series: [{
        name: 'Notification Type',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: (params: any) => {
            const percent = Math.round(params.percent || 0);
            return `${params.name}: ${params.value}\n(${percent}%)`;
          }
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: data
      }]
    } as EChartsOption;
  }

  /**
   * Get Notification Read Status Chart Options (Bar Chart)
   */
  getNotificationReadStatusChartOptions(): EChartsOption {
    if (!this.notificationStatistics || !this.notificationStatistics.byEntity.length) {
      return {};
    }

    const entities = this.notificationStatistics.byEntity.map(e => e.entityType);
    const readRates = this.notificationStatistics.byEntity.map(e => e.readRate);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const data = params[0];
          const entity = this.notificationStatistics!.byEntity[data.dataIndex];
          const readRate = Math.round(entity.readRate || 0);
          return `${data.name}<br/>Read Rate: ${readRate}%<br/>Read: ${entity.readCount}<br/>Unread: ${entity.unreadCount}`;
        }
      },
      xAxis: {
        type: 'category',
        data: entities,
        axisLabel: {
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%'
        }
      },
      series: [{
        name: 'Read Rate',
        data: readRates,
        type: 'bar',
        itemStyle: {
          color: (params: any) => {
            const rate = readRates[params.dataIndex];
            if (rate >= 80) return '#10b981';
            if (rate >= 50) return '#f59e0b';
            return '#ef4444';
          }
        }
      }]
    } as EChartsOption;
  }

  /**
   * Drill down into KPI data
   */
  drillDown(kpiType: string, level: string, id?: number, label?: string): void {
    try {
      // Prevent duplicate drill-downs - check if we're already at this level
      const lastPath = this.drillDownPath.length > 0 ? this.drillDownPath[this.drillDownPath.length - 1] : null;
      if (lastPath && 
          lastPath.kpiType === kpiType && 
          lastPath.level === level && 
          lastPath.id === id) {
        // Already at this level, don't add duplicate
        return;
      }

      // Prevent multiple simultaneous drill-down requests
      if (this.isLoading || this.isDrillingDown) {
        return;
      }

      this.isDrillingDown = true;

      const request: DrillDownRequestDto = {
        kpiType: kpiType as 'MissionReadiness' | 'StockAvailability' | 'OrderCycleTime' | 'ConsumptionForecast',
        level: level as 'Category' | 'Item' | 'Transaction',
        warehouseId: this.selectedWarehouseId || undefined,
        startDate: this.startDate?.toISOString(),
        endDate: this.endDate?.toISOString()
      };

      if (id) {
        if (level === 'Category') {
          request.categoryId = id;
        } else if (level === 'Item') {
          request.itemId = id;
        } else if (level === 'Transaction') {
          request.itemId = id;
        }
      }

      this.isLoading = true;
      this.isDrillDownMode = true;
      this.drillDownPath.push({
        label: label || `${kpiType} - ${level}`,
        kpiType,
        level,
        id
      });
      this.cdr.markForCheck();

      this.advancedAnalyticsService
        .drillDown(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            this.drillDownData = data;
            this.isLoading = false;
            this.isDrillingDown = false;
            this.cdr.markForCheck();
          },
          error: (error) => {
            this.loggingService.error('Error drilling down', error);
            this.error = 'Failed to load drill-down data.';
            this.isLoading = false;
            this.isDrillingDown = false;
            this.isDrillDownMode = false;
            this.cdr.markForCheck();
          }
        });
    } catch (error) {
      this.loggingService.error('Error in drillDown method', error);
      this.error = 'Failed to initiate drill-down.';
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Navigate breadcrumb
   */
  navigateBreadcrumb(index: number): void {
    if (index === -1) {
      // Go back to dashboard
      this.isDrillDownMode = false;
      this.drillDownPath = [];
      this.drillDownData = null;
      this.loadDashboard();
    } else {
      // Navigate to specific breadcrumb level
      this.drillDownPath = this.drillDownPath.slice(0, index + 1);
      if (this.drillDownPath.length === 0) {
        this.isDrillDownMode = false;
        this.drillDownData = null;
        this.loadDashboard();
      } else {
        const lastPath = this.drillDownPath[this.drillDownPath.length - 1];
        this.drillDown(lastPath.kpiType || '', lastPath.level || '', lastPath.id, lastPath.label);
      }
    }
  }

  /**
   * Toggle KPI visibility
   */
  toggleKpiVisibility(kpiId: string): void {
    if (this.visibleKpis.has(kpiId)) {
      this.visibleKpis.delete(kpiId);
    } else {
      this.visibleKpis.add(kpiId);
    }
    this.updateOrderedArrays(); // Update ordered arrays when visibility changes
    this.saveDashboardPreferences();
    this.cdr.markForCheck();
  }

  /**
   * Toggle chart visibility
   */
  toggleChartVisibility(chartId: string): void {
    if (this.visibleCharts.has(chartId)) {
      this.visibleCharts.delete(chartId);
    } else {
      this.visibleCharts.add(chartId);
    }
    this.updateOrderedArrays(); // Update ordered arrays when visibility changes
    this.saveDashboardPreferences();
    this.cdr.markForCheck();
  }

  /**
   * Check if KPI is visible
   */
  isKpiVisible(kpiId: string): boolean {
    return this.visibleKpis.has(kpiId);
  }

  /**
   * Check if chart is visible
   */
  isChartVisible(chartId: string): boolean {
    return this.visibleCharts.has(chartId);
  }

  /**
   * Load dashboard preferences from storage
   */
  private loadDashboardPreferences(): void {
    const prefs = this.storageService.get<any>('advancedAnalyticsPreferences');
    if (prefs) {
      try {
        // Load presets first
        if (prefs.presets && prefs.presets.length > 0) {
          this.dashboardPresets = prefs.presets;
        }
        
        // Load current preset reference (but don't apply it automatically)
        if (prefs.currentPreset) {
          this.currentPreset = prefs.currentPreset;
        }
        
        // Load user's saved preferences - these take precedence over presets
        // Only use saved preferences if they exist and are not empty
        if (prefs.visibleKpis && Array.isArray(prefs.visibleKpis) && prefs.visibleKpis.length > 0) {
          this.visibleKpis = new Set(prefs.visibleKpis);
        }
        if (prefs.visibleCharts && Array.isArray(prefs.visibleCharts) && prefs.visibleCharts.length > 0) {
          this.visibleCharts = new Set(prefs.visibleCharts);
        }
        
        // Load drag-and-drop order
        if (prefs.kpiOrder && Array.isArray(prefs.kpiOrder) && prefs.kpiOrder.length > 0) {
          this.kpiOrder = prefs.kpiOrder;
        }
        if (prefs.chartOrder && Array.isArray(prefs.chartOrder) && prefs.chartOrder.length > 0) {
          this.chartOrder = prefs.chartOrder;
        }
      } catch (e) {
        this.loggingService.error('Error loading dashboard preferences', e);
      }
    }

    // Initialize default presets if none exist
    if (this.dashboardPresets.length === 0) {
      this.initializeDefaultPresets();
    }

    // Update ordered arrays after loading preferences
    this.updateOrderedArrays();
  }

  /**
   * Save dashboard preferences to storage
   */
  private saveDashboardPreferences(): void {
    const prefs = {
      visibleKpis: Array.from(this.visibleKpis),
      visibleCharts: Array.from(this.visibleCharts),
      presets: this.dashboardPresets,
      currentPreset: this.currentPreset,
      kpiOrder: this.kpiOrder,
      chartOrder: this.chartOrder
    };
    this.storageService.set('advancedAnalyticsPreferences', prefs);
  }

  /**
   * Update ordered visible arrays (call when visibility or order changes)
   */
  private updateOrderedArrays(): void {
    this.orderedVisibleKpis = this.kpiOrder.filter(kpi => this.isKpiVisible(kpi));
    this.orderedVisibleCharts = this.chartOrder.filter(chart => this.isChartVisible(chart));
  }

  /**
   * TrackBy function for KPI items
   */
  trackByKpiId(index: number, kpiId: string): string {
    return kpiId;
  }

  /**
   * TrackBy function for Chart items
   */
  trackByChartId(index: number, chartId: string): string {
    return chartId;
  }

  /**
   * Get ordered visible KPIs
   */
  getOrderedVisibleKpis(): string[] {
    return this.orderedVisibleKpis;
  }

  /**
   * Get ordered visible Charts
   */
  getOrderedVisibleCharts(): string[] {
    return this.orderedVisibleCharts;
  }

  /**
   * Handle KPI drag and drop
   */
  dropKpi(event: CdkDragDrop<string[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return; // No change
    }

    // Move item in the visible array
    moveItemInArray(this.orderedVisibleKpis, event.previousIndex, event.currentIndex);
    
    // Update the main kpiOrder array to reflect the new order
    const hiddenKpis = this.kpiOrder.filter(kpi => !this.isKpiVisible(kpi));
    this.kpiOrder = [...this.orderedVisibleKpis, ...hiddenKpis];
    
    this.saveDashboardPreferences();
    this.cdr.detectChanges(); // Force change detection
  }

  /**
   * Handle Chart drag and drop (supports both same-list moves and cross-list transfers)
   * Both "Interactive Visualizations" and "Additional Analytics Charts" use the same array,
   * so we can drag charts between sections seamlessly
   */
  dropChart(event: CdkDragDrop<string[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return; // No change
    }

    // Since both sections use the same orderedVisibleCharts array,
    // we just need to reorder it regardless of which list the item came from
    moveItemInArray(this.orderedVisibleCharts, event.previousIndex, event.currentIndex);
    
    // Update the main chartOrder array to reflect the new order
    const hiddenCharts = this.chartOrder.filter(chart => !this.isChartVisible(chart));
    this.chartOrder = [...this.orderedVisibleCharts, ...hiddenCharts];
    
    this.saveDashboardPreferences();
    this.cdr.detectChanges(); // Force change detection
  }

  /**
   * Initialize default role-based presets
   */
  private initializeDefaultPresets(): void {
    this.dashboardPresets = [
      {
        id: 'command-staff',
        name: 'Command Staff',
        role: 'Command',
        kpiIds: ['importExport', 'stockAvailability', 'orderCycleTime', 'consumptionForecast'],
        layout: {
          kpiCards: [
            { id: 'importExport', kpiType: 'importExport', position: { x: 0, y: 0, w: 1, h: 1 }, visible: true },
            { id: 'stockAvailability', kpiType: 'stockAvailability', position: { x: 1, y: 0, w: 1, h: 1 }, visible: true },
            { id: 'orderCycleTime', kpiType: 'orderCycleTime', position: { x: 2, y: 0, w: 1, h: 1 }, visible: true },
            { id: 'consumptionForecast', kpiType: 'consumptionForecast', position: { x: 3, y: 0, w: 1, h: 1 }, visible: true }
          ],
          charts: [
            { id: 'importExport', chartType: 'line', kpiType: 'importExport', position: { x: 0, y: 0, w: 2, h: 1 }, visible: true },
            { id: 'stockAvailability', chartType: 'bar', kpiType: 'stockAvailability', position: { x: 0, y: 1, w: 1, h: 1 }, visible: true },
            { id: 'orderCycleTime', chartType: 'line', kpiType: 'orderCycleTime', position: { x: 1, y: 1, w: 1, h: 1 }, visible: true },
            { id: 'consumptionForecast', chartType: 'line', kpiType: 'consumptionForecast', position: { x: 0, y: 2, w: 2, h: 1 }, visible: true }
          ]
        }
      },
      {
        id: 'logistics-manager',
        name: 'Logistics Manager',
        role: 'Logistics',
        kpiIds: ['stockAvailability', 'orderCycleTime'],
        layout: {
          kpiCards: [
            { id: 'stockAvailability', kpiType: 'stockAvailability', position: { x: 0, y: 0, w: 1, h: 1 }, visible: true },
            { id: 'orderCycleTime', kpiType: 'orderCycleTime', position: { x: 1, y: 0, w: 1, h: 1 }, visible: true }
          ],
          charts: [
            { id: 'stockAvailability', chartType: 'bar', kpiType: 'stockAvailability', position: { x: 0, y: 0, w: 1, h: 1 }, visible: true },
            { id: 'orderCycleTime', chartType: 'line', kpiType: 'orderCycleTime', position: { x: 1, y: 0, w: 1, h: 1 }, visible: true }
          ]
        }
      },
      {
        id: 'finance',
        name: 'Finance',
        role: 'Finance',
        kpiIds: ['consumptionForecast', 'orderCycleTime'],
        layout: {
          kpiCards: [
            { id: 'consumptionForecast', kpiType: 'consumptionForecast', position: { x: 0, y: 0, w: 1, h: 1 }, visible: true },
            { id: 'orderCycleTime', kpiType: 'orderCycleTime', position: { x: 1, y: 0, w: 1, h: 1 }, visible: true }
          ],
          charts: [
            { id: 'consumptionForecast', chartType: 'line', kpiType: 'consumptionForecast', position: { x: 0, y: 0, w: 2, h: 1 }, visible: true }
          ]
        }
      }
    ];
    this.saveDashboardPreferences();
  }

  /**
   * Apply dashboard preset
   */
  applyPreset(preset: DashboardPreset): void {
    this.currentPreset = preset;
    this.visibleKpis = new Set(preset.kpiIds);
    this.visibleCharts = new Set(preset.layout.charts.filter(c => c.visible).map(c => c.id));
    this.saveDashboardPreferences();
    this.cdr.markForCheck();
  }

  /**
   * Toggle customization panel
   */
  toggleCustomizationPanel(): void {
    this.showCustomizationPanel = !this.showCustomizationPanel;
    this.cdr.markForCheck();
  }

  /**
   * Handle chart initialization
   */
  onChartInit(chartInstance: any, chartId: string): void {
    if (!chartInstance) {
      return;
    }

    // Get the DOM element from the chart instance
    let domElement: HTMLElement | null = null;
    try {
      // ECharts instances have a `getDom()` method to get the DOM element
      if (chartInstance && typeof chartInstance.getDom === 'function') {
        domElement = chartInstance.getDom();
      }
    } catch (error) {
      // Error getting DOM element
    }

    // Check if there's already an instance on the DOM element using getInstanceByDom
    if (domElement) {
      try {
        const existingDomInstance = echarts.getInstanceByDom(domElement);
        if (existingDomInstance && existingDomInstance !== chartInstance) {
          try {
            if (typeof existingDomInstance.dispose === 'function') {
              const isDisposed = typeof existingDomInstance.isDisposed === 'function' 
                ? existingDomInstance.isDisposed() 
                : false;
              if (!isDisposed) {
                existingDomInstance.dispose();
              }
            }
          } catch (error) {
            // Error disposing existing DOM instance
          }
        }
      } catch (error) {
        // Error checking for existing DOM instance
      }
    }

    // Check if instance already exists in our map
    const existingInstance = this.chartInstances.get(chartId);
    
    // If we already have this exact instance, don't do anything
    if (existingInstance === chartInstance) {
      return;
    }

    // If we have a different instance, dispose it first
    if (existingInstance && existingInstance !== chartInstance) {
      try {
        // Check if the existing instance is disposed
        const isDisposed = typeof existingInstance.isDisposed === 'function' 
          ? existingInstance.isDisposed() 
          : false;
        
        if (!isDisposed) {
          // Dispose the old instance
          if (typeof existingInstance.dispose === 'function') {
            existingInstance.dispose();
          }
        }
      } catch (error) {
        // Error disposing old instance
      }
    }

    // Store the new instance
    this.chartInstances.set(chartId, chartInstance);
    
    // Attach click event listener (only for charts that need drill-down)
    if (chartId === 'stockAvailability' || chartId === 'orderCycleTime' || chartId === 'consumptionForecast') {
      chartInstance.off('click'); // Remove any existing listeners first
      chartInstance.on('click', (params: any) => {
        this.handleChartClick(params, chartId);
      });
    }
    
    // Update chart with cached options if available
    const cachedOptions = this.cachedChartOptions.get(chartId);
    if (cachedOptions) {
      setTimeout(() => {
        if (chartInstance && typeof chartInstance.setOption === 'function') {
          try {
            // Check if instance is disposed before trying to update
            const isDisposed = typeof chartInstance.isDisposed === 'function' 
              ? chartInstance.isDisposed() 
              : false;
            
            if (!isDisposed) {
              chartInstance.setOption(cachedOptions, { notMerge: false });
            }
          } catch (error) {
            // Error setting cached options
          }
        }
      }, 0);
    }
  }

  /**
   * Handle chart click for drill-down
   */
  private handleChartClick(params: any, chartId: string): void {
    if (!params || !params.data) {
      return;
    }

    try {
      // Drill down based on chart click
      if (chartId === 'stockAvailability') {
        const warehouseIndex = params.dataIndex;
        if (this.stockAvailability && this.stockAvailability.byWarehouse && 
            warehouseIndex >= 0 && warehouseIndex < this.stockAvailability.byWarehouse.length) {
          const warehouse = this.stockAvailability.byWarehouse[warehouseIndex];
          this.drillDown('StockAvailability', 'Category', warehouse.warehouseId, warehouse.warehouseName);
        }
      } else if (chartId === 'missionReadiness') {
        this.drillDown('MissionReadiness', 'Category');
      } else if (chartId === 'orderCycleTime') {
        this.drillDown('OrderCycleTime', 'Category');
      } else if (chartId === 'consumptionForecast') {
        this.drillDown('ConsumptionForecast', 'Category');
      }
    } catch (error) {
      this.loggingService.error('Error handling chart click', error);
    }
  }

  /**
   * Handle chart click event (for template binding)
   */
  onChartClick(event: any, kpiType: string): void {
    this.handleChartClick(event, kpiType);
  }

  /**
   * Check if KPI has data to display
   */
  hasKpiData(kpiId: string): boolean {
    switch (kpiId) {
      case 'importExport':
        return !!this.importExportStatistics;
      case 'stockAvailability':
        return !!this.stockAvailability;
      case 'orderCycleTime':
        return !!this.orderCycleTime;
      case 'consumptionForecast':
        return !!this.consumptionForecast;
      default:
        return false;
    }
  }

  /**
   * Check if Chart has data to display
   */
  hasChartData(chartId: string): boolean {
    switch (chartId) {
      case 'importExport':
        return !!(this.importExportStatistics && this.importExportStatistics.trendData.length > 0);
      case 'stockAvailability':
        return !!(this.stockAvailability && this.stockAvailability.byWarehouse.length > 0);
      case 'orderCycleTime':
        return !!(this.orderCycleTime && this.orderCycleTime.trendData.length > 0);
      case 'consumptionForecast':
        return !!(this.consumptionForecast && this.consumptionForecast.trendData.length > 0);
      case 'orderStatusDistribution':
        return !!(this.orderStatusDistribution && this.orderStatusDistribution.statusDistribution.length > 0);
      case 'requestTrends':
        return !!(this.requestTrends && this.requestTrends.trendData.length > 0);
      case 'inventoryValue':
        return !!(this.inventoryValue && this.inventoryValue.byWarehouse.length > 0);
      case 'assetAssignmentStatus':
        return !!(this.assetAssignmentStatus && this.assetAssignmentStatus.statusDistribution.length > 0);
      case 'supplyFulfillmentStatus':
        return !!(this.supplyFulfillmentStatus && this.supplyFulfillmentStatus.statusDistribution.length > 0);
      case 'departmentRequestVolume':
        return !!(this.departmentRequestVolume && this.departmentRequestVolume.byDepartment.length > 0);
      case 'notificationTrends':
        return !!(this.notificationStatistics && this.notificationStatistics.trendData.length > 0);
      case 'notificationByType':
        return !!(this.notificationStatistics && this.notificationStatistics.byType.length > 0);
      case 'notificationReadStatus':
        return !!(this.notificationStatistics && this.notificationStatistics.byEntity.length > 0);
      case 'userLoginAnalytics':
        return true; // Always show, component handles its own data
      default:
        return false;
    }
  }
}
