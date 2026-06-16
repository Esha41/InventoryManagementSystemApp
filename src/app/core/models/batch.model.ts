import { AssetDto, AssetStatus } from './asset.model';
import { DepotDto } from './depot.model';

/** Lightweight batch for list view - id, batch number, quantity only */
export interface BatchSummaryDto {
    id: number;
    batchNumber: string;
    quantity: number;
}

export interface BatchAssetItemCountDto {
    itemId: number;
    itemName: string;
    itemNameAr?: string | null;
    itemNo?: string | null;
    nsn?: string | null;
    count: number;
}

export interface BatchDto {
    id: number;
    batchNumber: string;
    depotId: number;
    /** Total assets matching filters (not the current page length). */
    assetCount: number;
    /** 1-based page index for the assets slice. */
    assetsPageIndex?: number;
    assetsPageSize?: number;
    assetsTotalPages?: number;
    /** Totals per catalog item for the whole batch (same filters as the assets list). */
    assetItemCounts?: BatchAssetItemCountDto[];
    depot?: DepotDto;
    assets: AssetDto[];
}

export interface BatchAssetUpdateItem {
    assetId: number;
    itemId: number;
    serialNumber?: string;
    rfid?: string;
    status?: AssetStatus;
    purchaseDate?: Date | string;
    warrantyExpiryDate?: Date | string;
    purchasePrice?: number;
    deliveryReceipt?: string;
    notes?: string;
    /** When true, apply assignee fields (or clear assignment if both IDs are empty). */
    updateAssignment?: boolean;
    assignToDepartmentId?: number | null;
    assignToEmployeeId?: number | null;
    assignmentNotes?: string;
    supplierId?: number | null;
    manufacturerId?: number | null;
    primaryPurposId?: number | null;
}

export interface BulkUpdateBatchAssetsDto {
    items: BatchAssetUpdateItem[];
    /** Existing uploaded file ids removed in UI; backend deletes them during bulk update. */
    removedFileIds?: number[];
}

export interface UpdateBatchDto {
    batchNumber: string;
}

export interface BatchAssetFilter {
    itemIds?: number[];
    supplierIds?: number[];
    manufacturerIds?: number[];
    primaryPurposeIds?: number[];
    caliberIds?: number[];
}
