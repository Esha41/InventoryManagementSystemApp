import { DiscardItemDto } from './request-item.model';

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
 * Discard DTO for read operations
 */
export interface DiscardDto {
    id: number;
    requestNo: string;
    requestType: number;
    reason?: string;
    priority: number;
    status: number;
    notes?: string;
    requestPurposeNotes?: string;
    departmentId: number;
    requesterId?: string;
    recieverId?: number;
    depotId?: number;
    requestPurposeId: number;
    // Nested objects from backend BaseRequestDto
    department?: {
        id: number;
        code: string;
        nameAr: string;
        nameEn: string;
        isDeleted: boolean;
    };
    requester?: {
        id: string;
        userName: string;
        fullNameEN: string;
        fullNameAR: string;
        militoryId?: string | null;
        email?: string;
        rank?: unknown;
        department?: unknown;
    };
    requestPurpose?: {
        id: number;
        nameAr: string;
        nameEn: string;
        requestType: number;
    };
    requestItems?: DiscardItemDto[];
    creationDate?: string | Date; // From BaseRequestDto
    isMyTurn?: boolean;
}
