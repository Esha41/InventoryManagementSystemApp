/**
 * Asset models for individual item tracking (primarily weapons)
 * Matches backend DTOs from Ettad.Inventory.Services.Assets
 */


import { WeaponDto } from './weapon.model';
import { DepotDto } from './depot.model';
import { FileUploadDto } from './file-upload.model';
import { DepartmentDto, LookupItem } from './lookup.model';

export { AssetStatus } from '@models/backend-enums';

import { AssetStatus } from '@models/backend-enums';

/** Status dropdown order: Ready, Not ready, then remainder (matches backend batch Excel labels). */
export const ASSET_STATUS_FORM_OPTIONS_ORDER: readonly AssetStatus[] = [
    AssetStatus.ReadyToIssue,
    AssetStatus.NotReadyToIssue,
    AssetStatus.InMaintenance,
    AssetStatus.UnserviceableRepairable,
    AssetStatus.UnserviceableUnrepairable,
    AssetStatus.AwaitingDisposal,
    AssetStatus.Disposed
] as const;



/**
 * Employee DTO (Custodian)
 */
export interface EmployeeDto {
    id: number;
    userId?: string;
    nameAr?: string;
    nameEn?: string;
    militaryId?: string;
    departmentId?: number;
    phone?: string;
    email?: string;
    notes?: string;
    rankId?: number;
    isDeleted?: boolean;
    department?: { id?: number; nameEn?: string; nameAr?: string; code?: string };
    rank?: { id?: number; nameEn?: string; nameAr?: string };
}


/**
 * Asset DTO (Read)
 */
export interface AssetDto {
    id: number;
    itemId: number;
    serialNumber?: string;
    rfid?: string;
    depotId: number;
    batchId: number;
    batchNumber: string;
    departmentId?: number;
    custodianId?: number;
    location?: string;
    status?: AssetStatus;
    purchaseDate?: Date | string;
    warrantyExpiryDate?: Date | string;
    purchasePrice?: number;
    deliveryReceipt?: string;
    notes?: string;
    isDeleted: boolean;
    /** Asset audit: when the record was created */
    creationDate: Date | string;
    /** Current assignment: expected return (checkout). */
    expectedReturnDate?: Date | string;
    /** Current assignment: actual return when completed. */
    actualReturnDate?: Date | string;
    supplierId?: number;
    manufacturerId?: number;
    primaryPurposId?: number;

    // Navigation properties
    item?: WeaponDto;
    depot?: DepotDto;
    /** Same as `depot` when provided by the API (legacy field). */
    createdDepot?: DepotDto;
    department?: DepartmentDto;
    custodian?: EmployeeDto;
    supplier?: LookupItem;
    manufacturer?: LookupItem;
    primaryPurpos?: LookupItem;
    images?: FileUploadDto[];
}

/**
 * Create Asset DTO
 */
export interface CreateAssetDto {
    itemId: number;
    batchNumber: string;
    serialNumber?: string;
    rfid?: string;
    depotId: number;
    purchaseDate?: Date | string;
    warrantyExpiryDate?: Date | string;
    purchasePrice?: number;
    deliveryReceipt?: string;
    notes?: string;
    supplierId?: number;
    manufacturerId?: number;
    primaryPurposId?: number;
    /** Optional: assign to this employee on intake (maps to backend AssignToEmployeeId). */
    assignToEmployeeId?: number;
    /** Optional: assign to this department on intake (maps to backend AssignToDepartmentId). */
    assignToDepartmentId?: number;
    /** Optional notes on the assignment when intake assignment is created. */
    assignmentNotes?: string;
}

/**
 * Bulk create assets from a template (common info + quantity)
 */
export interface CreateBulkAssetsFromTemplateDto extends CreateAssetDto {
    quantity: number;
}

export interface BulkCreateFromTemplateResultDto {
    createdCount: number;
    firstAssetId?: number;
}

/** Matches backend `AssetBulkDeletionScopeDto`. */
export enum AssetBulkDeletionScope {
    Batch = 0,
    Depot = 1,
    ExplicitIds = 2
}

export interface StartBulkDeleteAssetsDto {
    scope: AssetBulkDeletionScope;
    batchId?: number | null;
    depotId?: number | null;
    assetIds?: number[] | null;
}

export interface BulkDeleteAssetsEnqueueResultDto {
    jobId: string;
    hangfireJobId?: string | null;
    totalCandidates: number;
}

export interface BulkDeleteAssetsStatusDto {
    jobId: string;
    status: string;
    totalCandidates: number;
    processedCount: number;
    deletedCount: number;
    progressPercent: number;
    message?: string | null;
    startedUtc?: string | null;
    completedUtc?: string | null;
}

/**
 * Update Asset DTO
 */
export interface UpdateAssetDto {
    itemId: number;
    serialNumber?: string;
    rfid?: string;
    purchaseDate?: Date | string;
    warrantyExpiryDate?: Date | string;
    purchasePrice?: number;
    deliveryReceipt?: string;
    notes?: string;
    supplierId?: number | null;
    manufacturerId?: number | null;
    primaryPurposId?: number | null;
}

/**
 * Asset Status Label Helper
 */
export function getAssetStatusLabel(status?: AssetStatus): string {
    switch (status) {
        case AssetStatus.ReadyToIssue:
            return 'assetStatus.readyToIssue';
        case AssetStatus.NotReadyToIssue:
            return 'assetStatus.notReadyToIssue';
        case AssetStatus.InMaintenance:
            return 'assetStatus.inMaintenance';
        case AssetStatus.UnserviceableRepairable:
            return 'assetStatus.unserviceableRepairable';
        case AssetStatus.UnserviceableUnrepairable:
            return 'assetStatus.unserviceableUnrepairable';
        case AssetStatus.AwaitingDisposal:
            return 'assetStatus.awaitingDisposal';
        case AssetStatus.Disposed:
            return 'assetStatus.disposed';
        case AssetStatus.Assigned:
            return 'assetStatus.assigned';
        default:
            return 'assetStatus.unknown';
    }
}

/**
 * Asset Status Color Helper (for badges)
 */
export function getAssetStatusColor(status?: AssetStatus): string {
    switch (status) {
        case AssetStatus.ReadyToIssue:
            return 'success';
        case AssetStatus.NotReadyToIssue:
            return 'warning';
        case AssetStatus.Assigned:
            return 'info';
        case AssetStatus.InMaintenance:
        case AssetStatus.UnserviceableRepairable:
            return 'warning';
        case AssetStatus.UnserviceableUnrepairable:
        case AssetStatus.AwaitingDisposal:
        case AssetStatus.Disposed:
            return 'error';
        default:
            return 'default';
    }
}
