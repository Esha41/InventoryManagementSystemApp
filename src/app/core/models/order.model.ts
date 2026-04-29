import type { RequestManagementBaseRequestDto } from './request-management-base.model';

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
    requestPurposeNotes?: string;
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
 * Order-specific fields on read DTO (beyond `BaseRequestDto`).
 * @see `ettadbackend/Ettad.RequestManagement.Service/Orders/Dto/OrderDto.cs`
 */
export interface OrderSpecificDto {
    isFromAllowance?: boolean;
    usageDateFrom?: string | Date;
    usageTimeFrom?: string;
    usageDateTo?: string | Date;
    usageTimeTo?: string;
    usagePurpose?: string;
    annualDiscard?: number | null;
    usageLocation?: string;
    numberOfOfficer?: number | null;
    numberOfOtherRank?: number | null;
    supplyDate?: string | Date | null;
}

/**
 * Flat display names hydrated client-side or from older list payloads — not on RequestManagement `BaseRequestDto`.
 * @see `ettadbackend/Ettad.Workflow.Service/Dtos/BaseRequestDto.cs` for optional workflow-only flat names
 */
export interface OrderDtoHydratedDisplayFields {
    departmentNameAr?: string;
    departmentNameEn?: string;
    requesterName?: string;
    requesterNameEn?: string;
    requesterNameAr?: string;
    requestPurposeNameAr?: string;
    requestPurposeNameEn?: string;
    /** Optional enrichment from supply/list payloads (not on core `OrderDto` in Request Management). */
    depotNameAr?: string;
    depotNameEn?: string;
}

/**
 * Order read DTO.
 * Intersection type:
 * - `RequestManagementBaseRequestDto` — `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/BaseRequestDto.cs`
 * - `OrderSpecificDto` — `ettadbackend/Ettad.RequestManagement.Service/Orders/Dto/OrderDto.cs`
 * - `OrderDtoHydratedDisplayFields` — client / workflow list enrichments
 */
export type OrderDto = RequestManagementBaseRequestDto &
    OrderSpecificDto &
    OrderDtoHydratedDisplayFields & {
        /** Same as `requestNo` in API; kept for UI that labels this as order number. */
        orderNo?: string;
    };

/**
 * Order status summary item for dashboard/analytics
 */
export interface OrderStatusSummaryItem {
    status: number;
    count?: number;
}
