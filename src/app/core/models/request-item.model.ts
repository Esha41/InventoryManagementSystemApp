/**
 * Centralized Request Item DTOs
 * Consolidates all request item-related interfaces from Order, Return, and Discard services
 */

import type { RequestManagementRequestItemDto } from './request-management-base.model';

/**
 * Base request item DTO (read) — matches Request Management `RequestItemDto`.
 * @see `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/RequestItemDto.cs`
 */
export interface RequestItemDto extends RequestManagementRequestItemDto {}

/**
 * DTO for creating or updating request items
 * Used when adding/editing items in Order, Return, or Discard requests
 */
export interface CreateRequestItemDto {
    itemId: number;
    quantity: number;
    notes?: string;
}

/**
 * Order-specific request item DTO
 * Extends base with order-specific fields
 */
export interface OrderRequestItemDto extends RequestItemDto {
    // Inherits all fields from RequestItemDto
    // Can add order-specific fields here if needed in the future
}

/**
 * Return-specific request item DTO
 * Extends base with return-specific fields
 */
export interface ReturnItemDto extends RequestItemDto {
    // Inherits all fields from RequestItemDto
    // Can add return-specific fields here if needed in the future
}

/**
 * Discard-specific request item DTO
 * Extends base with discard-specific fields
 */
export interface DiscardItemDto extends RequestItemDto {
    // Inherits all fields from RequestItemDto
    // Can add discard-specific fields here if needed in the future
}

/**
 * DTO for creating order items
 */
export interface CreateOrderItemDto extends CreateRequestItemDto {
    // Inherits from CreateRequestItemDto
}

/**
 * DTO for creating return items
 */
export interface CreateReturnItemDto extends CreateRequestItemDto {
    // Inherits from CreateRequestItemDto
}

/**
 * DTO for creating discard items
 */
export interface CreateDiscardItemDto extends CreateRequestItemDto {
    // Inherits from CreateRequestItemDto
}
