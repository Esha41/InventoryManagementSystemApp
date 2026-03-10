/**
 * Common file upload models used across the application
 */

/**
 * Enum to identify which domain entity a file belongs to.
 * Maps to backend FileEntityType enum.
 */
export enum FileEntityType {
    Ammunition = 1,
    Order = 2,
    Workflow = 3,
    WorkflowApproval = 4,
    Supply = 5,
    Return = 6,
    Weapon = 7,
    Explosive = 8,
    Asset = 9,
    AssetSupply = 10
}

/**
 * File upload DTO matching backend structure
 */
export interface FileUploadDto {
    id: number;
    fileUrl: string;
    fileName: string;
    originalName: string;
    isMain: boolean;
    entity: number;
    entityId: number;
}
