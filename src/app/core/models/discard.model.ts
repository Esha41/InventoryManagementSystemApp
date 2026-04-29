import type { RequestManagementBaseRequestDto } from './request-management-base.model';

// Re-export for backward compatibility
export { DiscardItemDto } from './request-item.model';

/**
 * Discard Request DTOs
 * Extracted from discard.service.ts for better separation of concerns
 */

/**
 * DTO for creating a new discard request
 */
export interface CreateDiscardDto {
    reason?: string;
    priority: number; // 1 = High, 2 = Medium, 3 = Low
    notes?: string;
    requestPurposeNotes?: string;
    departmentId: number;
    requesterId?: string;
    requestPurposeId: number;
    discardItems: Array<{
        itemId: number;
        quantity: number;
        notes?: string;
    }>;
}

/**
 * Discard read DTO carries no extra members beyond base in Request Management.
 * @see `ettadbackend/Ettad.RequestManagement.Service/Discards/Dtos/DiscardDto.cs`
 * @see `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/BaseRequestDto.cs`
 */
export type DiscardDto = RequestManagementBaseRequestDto;
