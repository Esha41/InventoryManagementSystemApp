import { RankDto } from './rank.model';
import { DepartmentDto } from './lookup.model';
import { ReturnItemDto } from './request-item.model';

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
 * Return DTO for read operations
 */
export interface ReturnDto {
    id: number;
    requestNo: string;
    requestType: number;
    reason?: string;
    priority: number;
    status: number;
    notes?: string;
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
        rank?: RankDto;
        department?: DepartmentDto;
    };
    requestPurpose?: {
        id: number;
        nameAr: string;
        nameEn: string;
        requestType: number;
    };
    requestItems?: ReturnItemDto[];
    creationDate?: string | Date; // From BaseRequestDto
    isMyTurn?: boolean;
}
