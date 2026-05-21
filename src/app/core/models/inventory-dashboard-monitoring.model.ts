import { RequestStatus, SupplySubmissionStatus } from '@models/backend-enums';

/** Matches API camelCase + numeric enum for AssetStatus */
export interface WeaponAssetStatusCountDto {
  status: number;
  count: number;
}

export interface WeaponAssetDashboardDto {
  totalAssets: number;
  assignedCount: number;
  inDepotCount: number;
  unknownStatusCount: number;
  byStatus: WeaponAssetStatusCountDto[];
}

export interface InventoryPipelineDashboardDto {
  draftSupplyCount: number;
  ordersAwaitingFulfillmentCount: number;
}

export interface InventoryDashboardSummaryDto {
  weaponAssets: WeaponAssetDashboardDto;
  pipeline: InventoryPipelineDashboardDto;
}

/** Matches GET Monitoring/dashboard/inventory-headline-metrics */
export interface InventoryHeadlineMetricsDto {
  lowStockCount: number;
  criticalStockCount: number;
  expiringSoonCount: number;
  totalDistinctItems: number;
  totalRemainingQuantity: number;
  totalLots: number;
  lotCount: number;
  weaponCount: number;
  totalBatches: number;
  ammunitionItemCount: number;
  explosiveItemCount: number;
  accessoryItemCount: number;
  weaponItemGroupsCount: number;
}

export interface DraftSupplyListItemDto {
  rowKind: string;
  rowId: number;
  orderId: number;
  orderNumber?: string;
  submissionStatus: SupplySubmissionStatus;
}

export interface OrderAwaitingFulfillmentListItemDto {
  orderId: number;
  orderNumber?: string;
  status: RequestStatus;
}
