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
    Active = 1,
    Inactive = 2,
    Maintenance = 3,
    Disposed = 4,
    Lost = 5,
    Damaged = 6
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
export function getAssetStatusLabel(status?: AssetStatus): string {
    switch (status) {
        case AssetStatus.Active:
            return 'assetStatus.active';
        case AssetStatus.Inactive:
            return 'assetStatus.inactive';
        case AssetStatus.Maintenance:
            return 'assetStatus.maintenance';
        case AssetStatus.Disposed:
            return 'assetStatus.disposed';
        case AssetStatus.Lost:
            return 'assetStatus.lost';
        case AssetStatus.Damaged:
            return 'assetStatus.damaged';
        default:
            return 'assetStatus.unknown';
    }
}

/**
 * Asset Status Color Helper (for badges)
 */
export function getAssetStatusColor(status?: AssetStatus): string {
    switch (status) {
        case AssetStatus.Active:
            return 'success';       // Green
        case AssetStatus.Inactive:
            return 'secondary';     // Gray
        case AssetStatus.Maintenance:
            return 'warning';       // Orange
        case AssetStatus.Disposed:
            return 'error';         // Red
        case AssetStatus.Lost:
            return 'error';         // Red
        case AssetStatus.Damaged:
            return 'error';         // Red
        default:
            return 'default';
    }
}
