import { AssetDto, AssetStatus } from './asset.model';
import { DepotDto } from './depot.model';

/** Lightweight batch for list view - id, batch number, quantity only */
export interface BatchSummaryDto {
    id: number;
    batchNumber: string;
    quantity: number;
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
}

export interface UpdateBatchDto {
    batchNumber: string;
}
