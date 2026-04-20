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
