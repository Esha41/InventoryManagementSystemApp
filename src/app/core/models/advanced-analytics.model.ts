/**
 * Advanced Analytics Models
 * TypeScript interfaces matching backend DTOs
 */

export interface MissionReadinessDto {
  readinessRate: number;
  totalUnits: number;
  missionReadyUnits: number;
  underMaintenanceUnits: number;
  unavailableUnits: number;
  status: 'Green' | 'Amber' | 'Red';
  trendData: MissionReadinessTrendDto[];
  byCategory: MissionReadinessByCategoryDto[];
}

export interface MissionReadinessTrendDto {
  date: string;
  readinessRate: number;
  totalUnits: number;
  missionReadyUnits: number;
}

export interface MissionReadinessByCategoryDto {
  categoryName: string;
  totalUnits: number;
  missionReadyUnits: number;
  readinessRate: number;
}

export interface StockAvailabilityDto {
  availabilityRate: number;
  totalRequiredItems: number;
  totalAvailableItems: number;
  byWarehouse: StockAvailabilityByWarehouseDto[];
  byCategory: StockAvailabilityByCategoryDto[];
  lowStockAreas: LowStockAreaDto[];
}

export interface StockAvailabilityByWarehouseDto {
  warehouseId: number;
  warehouseName: string;
  requiredItems: number;
  availableItems: number;
  availabilityRate: number;
}

export interface StockAvailabilityByCategoryDto {
  categoryName: string;
  isCritical: boolean;
  requiredItems: number;
  availableItems: number;
  availabilityRate: number;
}

export interface LowStockAreaDto {
  warehouseId: number;
  warehouseName: string;
  categoryName: string;
  lowStockItemCount: number;
  severity: number; // 0-1 scale
}

export interface OrderCycleTimeDto {
  averageCycleTimeDays: number;
  medianCycleTimeDays: number;
  minCycleTimeDays: number;
  maxCycleTimeDays: number;
  trendData: OrderCycleTimeTrendDto[];
  breakdown: OrderCycleTimeBreakdownDto;
  bySupplier: OrderCycleTimeBySupplierDto[];
  byItemType: OrderCycleTimeByItemTypeDto[];
  outliers: OrderCycleTimeOutlierDto[];
}

export interface OrderCycleTimeTrendDto {
  date: string;
  averageCycleTimeDays: number;
  orderCount: number;
}

export interface OrderCycleTimeBreakdownDto {
  averageApprovalTimeDays: number;
  averageProcurementTimeDays: number;
  averageShippingTimeDays: number;
  averageReceivingTimeDays: number;
}

export interface OrderCycleTimeBySupplierDto {
  supplierId: number;
  supplierName: string;
  averageCycleTimeDays: number;
  orderCount: number;
  delayedOrderCount: number;
}

export interface OrderCycleTimeByItemTypeDto {
  itemType: string;
  averageCycleTimeDays: number;
  orderCount: number;
}

export interface OrderCycleTimeOutlierDto {
  orderId: number;
  orderNumber: string;
  cycleTimeDays: number;
  orderDate: string;
  deliveryDate: string;
  delayReason: string;
}

export interface ConsumptionForecastDto {
  consumptionRatio: number;
  variancePercentage: number;
  trendData: ConsumptionForecastTrendDto[];
  byCategory: ConsumptionForecastByCategoryDto[];
  alerts: ConsumptionForecastAlertDto[];
}

export interface ConsumptionForecastTrendDto {
  date: string;
  actualConsumption: number;
  forecastedConsumption: number;
  variance: number;
  variancePercentage: number;
}

export interface ConsumptionForecastByCategoryDto {
  categoryName: string;
  actualConsumption: number;
  forecastedConsumption: number;
  variance: number;
  variancePercentage: number;
}

export interface ConsumptionForecastAlertDto {
  itemId: number;
  itemName: string;
  categoryName: string;
  actualConsumption: number;
  forecastedConsumption: number;
  variancePercentage: number;
  alertType: 'OverConsumption' | 'UnderUtilization';
}

export interface AdvancedAnalyticsDashboardDto {
  missionReadiness: MissionReadinessDto;
  stockAvailability: StockAvailabilityDto;
  orderCycleTime: OrderCycleTimeDto;
  consumptionForecast: ConsumptionForecastDto;
  orderStatusDistribution: OrderStatusDistributionDto;
  requestTrends: RequestTrendsDto;
  inventoryValue: InventoryValueDto;
  assetAssignmentStatus: AssetAssignmentStatusDto;
  supplyFulfillmentStatus: SupplyFulfillmentStatusDto;
  departmentRequestVolume: DepartmentRequestVolumeDto;
  notificationStatistics: NotificationStatisticsDto;
  importExportStatistics: ImportExportStatisticsDto;
  lastUpdated: string;
}

// Additional Charts DTOs
export interface OrderStatusDistributionDto {
  statusDistribution: OrderStatusDataPointDto[];
  totalOrders: number;
}

export interface OrderStatusDataPointDto {
  status: string;
  count: number;
  percentage: number;
}

export interface RequestTrendsDto {
  trendData: RequestTrendDataPointDto[];
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
}

export interface RequestTrendDataPointDto {
  date: string;
  orderCount: number;
  returnCount: number;
  discardCount: number;
  totalCount: number;
}

export interface InventoryValueDto {
  byWarehouse: WarehouseValueDto[];
  totalValue: number;
  totalItems: number;
}

export interface WarehouseValueDto {
  warehouseId: number;
  warehouseName: string;
  totalValue: number;
  itemCount: number;
  lowStockItems: number;
}

export interface AssetAssignmentStatusDto {
  statusDistribution: AssetStatusDataPointDto[];
  totalAssets: number;
  assignedAssets: number;
  unassignedAssets: number;
}

export interface AssetStatusDataPointDto {
  status: string;
  count: number;
  percentage: number;
}

export interface SupplyFulfillmentStatusDto {
  statusDistribution: SupplyStatusDataPointDto[];
  totalSupplies: number;
  averageFulfillmentRate: number;
}

export interface SupplyStatusDataPointDto {
  status: string;
  count: number;
  percentage: number;
}

export interface DepartmentRequestVolumeDto {
  byDepartment: DepartmentVolumeDto[];
  totalRequests: number;
}

export interface DepartmentVolumeDto {
  departmentId: number;
  departmentName: string;
  requestCount: number;
  orderCount: number;
  returnCount: number;
  discardCount: number;
}

export interface NotificationStatisticsDto {
  trendData: NotificationTrendDataPointDto[];
  byType: NotificationByTypeDto[];
  byEntity: NotificationByEntityDto[];
  readStatus: NotificationReadStatusDto;
  totalNotifications: number;
  unreadNotifications: number;
  readNotifications: number;
  averageReadTimeHours: number;
}

export interface NotificationTrendDataPointDto {
  date: string;
  sentCount: number;
  readCount: number;
  unreadCount: number;
}

export interface NotificationByTypeDto {
  entityType: string;
  count: number;
  percentage: number;
}

export interface NotificationByEntityDto {
  entityType: string;
  notificationCount: number;
  readCount: number;
  unreadCount: number;
  readRate: number;
}

export interface NotificationReadStatusDto {
  totalSent: number;
  totalRead: number;
  totalUnread: number;
  readRate: number;
  averageReadTimeHours: number;
}

export interface ImportExportStatisticsDto {
  trendData: ImportExportTrendDataPointDto[];
  byType: ImportExportByTypeDto[];
  byEntity: ImportExportByEntityDto[];
  summary: ImportExportSummaryDto;
  totalImports: number;
  totalExports: number;
}

export interface ImportExportTrendDataPointDto {
  date: string;
  importCount: number;
  exportCount: number;
  totalOperations: number;
}

export interface ImportExportByTypeDto {
  type: string;
  importCount: number;
  exportCount: number;
  totalCount: number;
  percentage: number;
}

export interface ImportExportByEntityDto {
  entityType: string;
  importCount: number;
  exportCount: number;
  totalCount: number;
  importPercentage: number;
  exportPercentage: number;
}

export interface ImportExportSummaryDto {
  totalImports: number;
  totalExports: number;
  totalOperations: number;
  importPercentage: number;
  exportPercentage: number;
  lastImportDate?: string;
  lastExportDate?: string;
}

export interface DrillDownRequestDto {
  kpiType: 'MissionReadiness' | 'StockAvailability' | 'OrderCycleTime' | 'ConsumptionForecast';
  level: 'Category' | 'Item' | 'Transaction';
  warehouseId?: number;
  categoryId?: number;
  itemId?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Dashboard customization models
 */
export interface DashboardPreset {
  id: string;
  name: string;
  role?: string;
  kpiIds: string[];
  layout: DashboardLayout;
}

export interface DashboardLayout {
  kpiCards: KpiCardLayout[];
  charts: ChartLayout[];
}

export interface KpiCardLayout {
  id: string;
  kpiType: string;
  position: { x: number; y: number; w: number; h: number };
  visible: boolean;
}

export interface ChartLayout {
  id: string;
  chartType: string;
  kpiType: string;
  position: { x: number; y: number; w: number; h: number };
  visible: boolean;
}

/**
 * Alert threshold models
 */
export interface AlertThreshold {
  kpiType: string;
  thresholdValue: number;
  alertType: 'Low' | 'High';
  enabled: boolean;
}

/**
 * User Login Analytics
 */
export interface UserLoginAnalyticsDto {
  userLogins: UserLoginDataPointDto[];
  trendData: LoginTrendDataPointDto[];
  totalLogins: number;
  uniqueUsers: number;
  averageLoginDurationHours: number;
  activeUsersToday: number;
}

export interface UserLoginDataPointDto {
  userId: string;
  username: string;
  fullName?: string;
  loginCount: number;
  totalLoginDurationHours: number;
  averageLoginDurationHours: number;
  lastLoginDate?: string;
}

export interface LoginTrendDataPointDto {
  date: string;
  loginCount: number;
  uniqueUsers: number;
  averageDurationHours: number;
}