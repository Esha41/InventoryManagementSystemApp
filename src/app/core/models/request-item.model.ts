/**
 * Centralized Request Item DTOs
 * Consolidates all request item-related interfaces from Order, Return, and Discard services
 */

import type { RequestManagementRequestItemDto } from './request-management-base.model';

/**
 * Base request item DTO (read) — matches Request Management `RequestItemDto`.
 * @see `ettadbackend/Ettad.RequestManagement.Service/Common/Dtos/RequestItemDto.cs`
 */
export type RequestItemDto = RequestManagementRequestItemDto;

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
export type OrderRequestItemDto = RequestItemDto;

/**
 * Return-specific request item DTO
 * Extends base with return-specific fields
 */
export type ReturnItemDto = RequestItemDto;

/**
 * Discard-specific request item DTO
 * Extends base with discard-specific fields
 */
export type DiscardItemDto = RequestItemDto;

/**
 * DTO for creating order items
 */
export type CreateOrderItemDto = CreateRequestItemDto;

/**
 * DTO for creating return items
 */
export type CreateReturnItemDto = CreateRequestItemDto;

/**
 * DTO for creating discard items
 */
export type CreateDiscardItemDto = CreateRequestItemDto;
