/** Matches API camelCase + string enum for AssetStatus */
export interface WeaponAssetStatusCountDto {
  status: string;
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
  /** Combined headline figure (non-weapon lots + weapon line count); use {@link lotCount} for ammo/explosive lot totals. */
  totalLots: number;
  /** Total inventory lots (non-weapon); API `lotCount`. */
  lotCount: number;
  /** Tracked weapon assets; API `weaponCount`. */
  weaponCount: number;
  /** Weapon registry batches in scope; API `totalBatches`. */
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
  submissionStatus: string;
}

export interface OrderAwaitingFulfillmentListItemDto {
  orderId: number;
  orderNumber?: string;
  status: string;
}
