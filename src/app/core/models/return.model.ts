import type { RequestManagementBaseRequestDto, RequestManagementDepotDto } from './request-management-base.model';
import { FileUploadDto } from './file-upload.model';

// Re-export for backward compatibility
export { ReturnItemDto } from './request-item.model';

/**
 * Return Request DTOs
 * Extracted from return.service.ts for better separation of concerns
 */

/**
 * DTO for creating a new return request
 */
export interface CreateReturnDto {
    reason?: string;
    priority: number;
    notes?: string;
    requestPurposeNotes?: string;
    departmentId: number;
    requesterId?: string;
    requestPurposeId: number;
    returnItems: Array<{
        itemId: number;
        quantity: number;
        notes?: string;
    }>;
}

/**
 * Return-specific fields on read DTO.
 * Intersection: `RequestManagementBaseRequestDto` & `ReturnSpecificDto`.
 * @see `ettadbackend/Ettad.RequestManagement.Service/Returns/Dtos/ReturnDto.cs`
 */
export interface ReturnSpecificDto {
    returnToDepotId?: number | null;
    deliveryDate?: string | Date | null;
    returnToDepot?: RequestManagementDepotDto | null;
}

/**
 * Return DTO for read operations.
 * Intersection type:
 * - `RequestManagementBaseRequestDto` — `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/BaseRequestDto.cs`
 * - `ReturnSpecificDto` — `ettadbackend/Ettad.RequestManagement.Service/Returns/Dtos/ReturnDto.cs`
 */
export type ReturnDto = RequestManagementBaseRequestDto & ReturnSpecificDto;

/** Return tracking row after items are processed (backend GET /Return/{id}/tracking-lines). */
export interface ReturnTrackingLineDto {
    id: number;
    returnId: number;
    requestId: number;
    depotId: number;
    requestItemId?: number | null;
    itemName?: string | null;
    itemNo?: string | null;
    returnedQuantity?: number | null;
    receivedQuantity?: number | null;
    lot?: string | null;
    batchNumber?: string | null;
    serialNumber?: string | null;
    notes?: string | null;
    assetId?: number | null;
    inventoryDetailId?: number | null;
    depot?: {
        id: number;
        code: string;
        nameAr: string;
        nameEn: string;
    } | null;
    files: FileUploadDto[];
}
