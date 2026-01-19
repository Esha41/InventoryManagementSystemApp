import { RankDto } from './rank.model';
import { DepartmentDto } from './asset.model';
import { OrderRequestItemDto } from './request-item.model';

// Re-export for backward compatibility
export { OrderRequestItemDto } from './request-item.model';
export { CreateRequestItemDto } from './request-item.model';

/**
 * Order Request DTOs
 * Extracted from order.service.ts for better separation of concerns
 */

/**
 * DTO for creating a new order request
 */
export interface CreateOrderDto {
    orderNo: string;
    requestNo: string;
    reason: string;
    priority: number;
    notes?: string;
    departmentId: number;
    requestTypeId?: number | null;
    requesterId?: string | null;
    recieverId?: string | null;
    depotId?: number | null;
    requestPurposeId: number;
    isFromAllowance: boolean;
    usageDateFrom: string;
    usageTimeFrom: string;
    usageDateTo: string;
    usageTimeTo: string;
    usagePurpose: string;
    annualDiscard?: number | null;
    usageLocation: string;
    numberOfOfficer?: number | null;
    numberOfOtherRank?: number | null;
    requestItems: Array<{
        itemId: number;
        quantity: number;
        notes?: string;
    }>;
}

/**
 * Order DTO for read operations
 */
export interface OrderDto {
    id: number;
    requestNo?: string;
    orderNo: string;
    requestType: number | string; // Can be number (1, 2, 3) or string ('Order', 'Return', 'Discard')
    reason?: string;
    priority: number | string; // Can be number (1, 2, 3) or string ('High', 'Medium', 'Low')
    status: number | string; // Can be number (1, 2, 3, 4) or string ('New', 'UnderProcess', 'Approved', 'Rejected')
    notes?: string;
    departmentId: number;
    requesterId?: string | null;
    recieverId?: string | null;
    depotId?: number | null;
    requestPurposeId: number;
    isFromAllowance: boolean;
    usageDateFrom?: string;
    usageTimeFrom?: string;
    usageDateTo?: string;
    usageTimeTo?: string;
    usagePurpose?: string;
    annualDiscard?: number | null;
    usageLocation?: string;
    numberOfOfficer?: number | null;
    numberOfOtherRank?: number | null;
    supplyDate?: string | Date | null; // Date when the order should be supplied
    departmentNameAr?: string;
    departmentNameEn?: string;
    requesterName?: string;
    requesterNameEn?: string;
    requesterNameAr?: string;
    recieverName?: string;
    depotNameAr?: string;
    depotNameEn?: string;
    requestPurposeNameAr?: string;
    requestPurposeNameEn?: string;
    requestItems?: OrderRequestItemDto[];
    creationDate?: string | Date;
    isMyTurn?: boolean;
    // Nested objects for localization
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
}

/**
 * Order status summary item for dashboard/analytics
 */
export interface OrderStatusSummaryItem {
    status: number;
    count?: number;
}
