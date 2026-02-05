/**
 * Common DTOs used across multiple services and components
 */

// Re-export RequestItemDto from centralized location for backward compatibility
export { RequestItemDto } from './request-item.model';

/**
 * Reserve detail for inventory management
 */
export interface ReserveDetailDto {
    itemId: number;
    lot: number;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    depotId?: number;
    expiryDate?: string;
}
