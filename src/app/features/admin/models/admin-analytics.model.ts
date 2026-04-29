/**
 * Admin analytics API shapes (ASP.NET Core default camelCase JSON).
 *
 * Backend:
 * - `ettadbackend/Project.User.Services/DTO/AdminAnalyticsDto.cs`
 * - `ettadbackend/Project.Module.User/Controllers/AdminAnalyticsController.cs` (`api/admin/analytics/*`)
 */

/** @see `SystemHealthMetricsDto` in AdminAnalyticsDto.cs */
export interface SystemHealthMetricsDto {
  activeUsers: number;
  systemUptime: number;
  avgResponseTime: number;
  activeRequests: number;
  errorRate: number;
  status: string;
  lastUpdated: string;
}

export type SystemHealthMetrics = Omit<SystemHealthMetricsDto, 'lastUpdated'> & { lastUpdated: Date };

/** @see `PerformanceMetricsDto` in AdminAnalyticsDto.cs */
export interface PerformanceMetricsDto {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  databaseConnections: number;
  avgQueryTime: number;
  lastUpdated: string;
}

/** @see `DepartmentStatDto` in AdminAnalyticsDto.cs */
export interface DepartmentStatDto {
  name: string;
  userCount: number;
}

/** @see `UserActivityMetricsDto` in AdminAnalyticsDto.cs */
export interface UserActivityMetricsDto {
  dailyActiveUsers: number;
  newUsersToday: number;
  totalUsers: number;
  topDepartments: DepartmentStatDto[];
  lastUpdated: string;
}

export type UserActivityMetrics = Omit<UserActivityMetricsDto, 'lastUpdated'> & { lastUpdated: Date };

/** @see `RequestMetricsDto` in AdminAnalyticsDto.cs */
export interface RequestMetricsDto {
  pendingOrders: number;
  pendingReturns: number;
  pendingDiscards: number;
  totalPending: number;
  newRequests: number;
  inProgressRequests: number;
  completedRequests: number;
  rejectedRequests: number;
  avgApprovalTime: number;
  slaCompliance: number;
  lastUpdated: string;
}

export type RequestMetrics = Omit<RequestMetricsDto, 'lastUpdated'> & { lastUpdated: Date };

/** @see `RequestTrendsDto` in AdminAnalyticsDto.cs */
export interface RequestTrendsDto {
  dates: string[];
  orders: number[];
  returns: number[];
  discards: number[];
  period: string;
}

export type RequestTrend = RequestTrendsDto;

/** @see `CategoryDistributionDto` in AdminAnalyticsDto.cs */
export interface CategoryDistributionDto {
  name: string;
  value: number;
  percentage: number;
}

/** @see `InventoryDistributionDto` in AdminAnalyticsDto.cs */
export interface InventoryDistributionDto {
  categories: CategoryDistributionDto[];
}

export type InventoryDistribution = InventoryDistributionDto;
export type CategoryDistribution = CategoryDistributionDto;

/** @see `RequestedItemDto` in AdminAnalyticsDto.cs */
export interface RequestedItemDto {
  itemName: string;
  requestCount: number;
  category: string;
}

/** @see `TopRequestedItemsDto` in AdminAnalyticsDto.cs */
export interface TopRequestedItemsDto {
  items: RequestedItemDto[];
}

export type TopRequestedItems = TopRequestedItemsDto;
export type RequestedItem = RequestedItemDto;

/**
 * Client-composed inventory summary (not a single admin API entity).
 * Built from inventory summary + monitoring endpoints in `AdminAnalyticsService`.
 */
export interface InventoryMetrics {
  totalItems: number;
  lowStockItems: number;
  expiringItems: number;
  inventoryDistribution?: InventoryDistribution;
  lastUpdated: Date;
}

export interface InventoryPieSlice {
  name: string;
  value: number;
}
