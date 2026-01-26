import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  AdvancedAnalyticsDashboardDto,
  MissionReadinessDto,
  StockAvailabilityDto,
  OrderCycleTimeDto,
  ConsumptionForecastDto,
  DrillDownRequestDto,
  OrderStatusDistributionDto,
  RequestTrendsDto,
  InventoryValueDto,
  AssetAssignmentStatusDto,
  SupplyFulfillmentStatusDto,
  DepartmentRequestVolumeDto,
  NotificationStatisticsDto,
  ImportExportStatisticsDto,
  UserLoginAnalyticsDto
} from '@models/advanced-analytics.model';
import { ConfigService } from './config.service';

/**
 * Advanced Analytics Service
 * Provides comprehensive KPIs and analytics for command staff
 */
@Injectable({
  providedIn: 'root'
})
export class AdvancedAnalyticsService {
  private readonly endpoint = '/AdvancedAnalytics';

  constructor(
    private apiService: ApiService,
    private config: ConfigService
  ) { }

  /**
   * Get complete Advanced Analytics Dashboard data
   */
  getDashboard(
    startDate?: Date,
    endDate?: Date,
    warehouseId?: number
  ): Observable<AdvancedAnalyticsDashboardDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());
    if (warehouseId) params = params.set('warehouseId', warehouseId.toString());

    this.config.log('Fetching Advanced Analytics Dashboard', { startDate, endDate, warehouseId });
    return this.apiService.get<AdvancedAnalyticsDashboardDto>(
      `${this.endpoint}/dashboard`,
      params
    );
  }

  /**
   * Get Mission Readiness Rate KPI
   */
  getMissionReadiness(
    startDate?: Date,
    endDate?: Date
  ): Observable<MissionReadinessDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    this.config.log('Fetching Mission Readiness', { startDate, endDate });
    return this.apiService.get<MissionReadinessDto>(
      `${this.endpoint}/mission-readiness`,
      params
    );
  }

  /**
   * Get Stock Availability KPI
   */
  getStockAvailability(warehouseId?: number): Observable<StockAvailabilityDto> {
    let params = new HttpParams();
    if (warehouseId) params = params.set('warehouseId', warehouseId.toString());

    this.config.log('Fetching Stock Availability', { warehouseId });
    return this.apiService.get<StockAvailabilityDto>(
      `${this.endpoint}/stock-availability`,
      params
    );
  }

  /**
   * Get Order Cycle Time KPI
   */
  getOrderCycleTime(
    startDate?: Date,
    endDate?: Date
  ): Observable<OrderCycleTimeDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    this.config.log('Fetching Order Cycle Time', { startDate, endDate });
    return this.apiService.get<OrderCycleTimeDto>(
      `${this.endpoint}/order-cycle-time`,
      params
    );
  }

  /**
   * Get Consumption Rate vs Forecast KPI
   */
  getConsumptionForecast(
    startDate?: Date,
    endDate?: Date
  ): Observable<ConsumptionForecastDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    this.config.log('Fetching Consumption Forecast', { startDate, endDate });
    return this.apiService.get<ConsumptionForecastDto>(
      `${this.endpoint}/consumption-forecast`,
      params
    );
  }

  /**
   * Drill down into specific KPI data
   */
  drillDown(request: DrillDownRequestDto): Observable<any> {
    this.config.log('Drilling down into KPI', request);
    return this.apiService.post<any>(`${this.endpoint}/drill-down`, request);
  }

  /**
   * Get Order Status Distribution
   */
  getOrderStatusDistribution(
    startDate?: Date,
    endDate?: Date
  ): Observable<OrderStatusDistributionDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    return this.apiService.get<OrderStatusDistributionDto>(
      `${this.endpoint}/order-status-distribution`,
      params
    );
  }

  /**
   * Get Request Trends Over Time
   */
  getRequestTrends(
    startDate?: Date,
    endDate?: Date
  ): Observable<RequestTrendsDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    return this.apiService.get<RequestTrendsDto>(
      `${this.endpoint}/request-trends`,
      params
    );
  }

  /**
   * Get Inventory Value by Warehouse
   */
  getInventoryValue(warehouseId?: number): Observable<InventoryValueDto> {
    let params = new HttpParams();
    if (warehouseId) params = params.set('warehouseId', warehouseId.toString());

    return this.apiService.get<InventoryValueDto>(
      `${this.endpoint}/inventory-value`,
      params
    );
  }

  /**
   * Get Asset Assignment Status
   */
  getAssetAssignmentStatus(): Observable<AssetAssignmentStatusDto> {
    return this.apiService.get<AssetAssignmentStatusDto>(
      `${this.endpoint}/asset-assignment-status`
    );
  }

  /**
   * Get Supply Fulfillment Status
   */
  getSupplyFulfillmentStatus(
    startDate?: Date,
    endDate?: Date
  ): Observable<SupplyFulfillmentStatusDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    return this.apiService.get<SupplyFulfillmentStatusDto>(
      `${this.endpoint}/supply-fulfillment-status`,
      params
    );
  }

  /**
   * Get Department Request Volume
   */
  getDepartmentRequestVolume(
    startDate?: Date,
    endDate?: Date
  ): Observable<DepartmentRequestVolumeDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    return this.apiService.get<DepartmentRequestVolumeDto>(
      `${this.endpoint}/department-request-volume`,
      params
    );
  }

  /**
   * Get Notification Statistics
   */
  getNotificationStatistics(
    startDate?: Date,
    endDate?: Date
  ): Observable<NotificationStatisticsDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    return this.apiService.get<NotificationStatisticsDto>(
      `${this.endpoint}/notification-statistics`,
      params
    );
  }

  /**
   * Get Import/Export Statistics
   */
  getImportExportStatistics(
    startDate?: Date,
    endDate?: Date
  ): Observable<ImportExportStatisticsDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    this.config.log('Fetching Import/Export Statistics', { startDate, endDate });
    return this.apiService.get<ImportExportStatisticsDto>(
      `${this.endpoint}/import-export-statistics`,
      params
    );
  }

  /**
   * Get User Login Analytics
   */
  getUserLoginAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Observable<UserLoginAnalyticsDto> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate.toISOString());
    if (endDate) params = params.set('endDate', endDate.toISOString());

    this.config.log('Fetching User Login Analytics', { startDate, endDate });
    return this.apiService.get<UserLoginAnalyticsDto>(
      `${this.endpoint}/user-login-analytics`,
      params
    );
  }
}
