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
    assetCount: number;
    depot?: DepotDto;
    assets: AssetDto[];
}

export interface BatchAssetUpdateItem {
    assetId: number;
    itemId: number;
    serialNumber?: string;
    rfid?: string;
    status?: AssetStatus;
    assetTag?: string;
    purchaseDate?: Date | string;
    warrantyExpiryDate?: Date | string;
    condition?: string;
    purchasePrice?: number;
    notes?: string;
    /** When true, apply assignee fields (or clear assignment if both IDs are empty). */
    updateAssignment?: boolean;
    assignToDepartmentId?: number | null;
    assignToEmployeeId?: number | null;
    assignmentNotes?: string;
}

export interface BulkUpdateBatchAssetsDto {
    items: BatchAssetUpdateItem[];
}

export interface UpdateBatchDto {
    batchNumber: string;
}
