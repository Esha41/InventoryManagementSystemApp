/**
 * Asset models for individual item tracking (primarily weapons)
 * Matches backend DTOs from Ettad.Inventory.Services.Assets
 */


import { WeaponDto } from './weapon.model';
import { DepotDto } from './depot.model';
import { FileUploadDto } from './file-upload.model';
import { DepartmentDto } from './lookup.model';

/**
 * Asset Status Enum
 */
export enum AssetStatus {
    ReadyToIssue = 1,
    InMaintenance = 2,
    UnserviceableRepairable = 3,
    UnserviceableUnrepairable = 4,
    AwaitingDisposal = 5,
    Disposed = 6
}



/**
 * Employee DTO (Custodian)
 */
export interface EmployeeDto {
    id: number;
    nameAr?: string;
    nameEn?: string;
    name?: string;
    employeeNumber?: string;
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
    assetTag?: string;
    purchaseDate?: Date | string;
    warrantyExpiryDate?: Date | string;
    condition?: string;
    purchasePrice?: number;
    notes?: string;
    isDeleted: boolean;

    // Navigation properties
    item?: WeaponDto;
    depot?: DepotDto;
    department?: DepartmentDto;
    custodian?: EmployeeDto;
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
    assetTag?: string;
    purchaseDate?: Date | string;
    warrantyExpiryDate?: Date | string;
    condition?: string;
    purchasePrice?: number;
    notes?: string;
}

/**
 * Update Asset DTO
 */
export interface UpdateAssetDto {
    itemId: number;
    serialNumber?: string;
    rfid?: string;
    assetTag?: string;
    purchaseDate?: Date | string;
    warrantyExpiryDate?: Date | string;
    condition?: string;
    purchasePrice?: number;
    notes?: string;
}

/**
 * Asset Status Label Helper
 */
export function getAssetStatusLabel(status?: AssetStatus | string): string {
    switch (status) {
        case AssetStatus.ReadyToIssue:
        case 'ReadyToIssue':
            return 'assetStatus.readyToIssue';
        case AssetStatus.InMaintenance:
        case 'InMaintenance':
            return 'assetStatus.inMaintenance';
        case AssetStatus.UnserviceableRepairable:
        case 'UnserviceableRepairable':
            return 'assetStatus.unserviceableRepairable';
        case AssetStatus.UnserviceableUnrepairable:
        case 'UnserviceableUnrepairable':
            return 'assetStatus.unserviceableUnrepairable';
        case AssetStatus.AwaitingDisposal:
        case 'AwaitingDisposal':
            return 'assetStatus.awaitingDisposal';
        case AssetStatus.Disposed:
        case 'Disposed':
            return 'assetStatus.disposed';
        default:
            return 'assetStatus.unknown';
    }
}

/**
 * Asset Status Color Helper (for badges)
 */
export function getAssetStatusColor(status?: AssetStatus | string): string {
    switch (status) {
        case AssetStatus.ReadyToIssue:
        case 'ReadyToIssue':
            return 'success';       // Green
        case AssetStatus.InMaintenance:
        case 'InMaintenance':
        case AssetStatus.UnserviceableRepairable:
        case 'UnserviceableRepairable':
            return 'warning';       // Orange
        case AssetStatus.UnserviceableUnrepairable:
        case 'UnserviceableUnrepairable':
        case AssetStatus.AwaitingDisposal:
        case 'AwaitingDisposal':
        case AssetStatus.Disposed:
        case 'Disposed':
            return 'error';         // Red
        default:
            return 'default';
    }
}
