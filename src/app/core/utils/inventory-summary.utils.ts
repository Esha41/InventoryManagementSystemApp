import { BaseItemDto, ItemInventorySummaryDto } from '@models/inventory.model';

/**
 * Utility class for transforming inventory data
 */
export class InventorySummaryUtils {
    /**
     * Transform BaseItemDto to ItemInventorySummaryDto format
     * Used for weapons and explosives that don't have the summary endpoint
     */
    static transformBaseItemToSummary(item: BaseItemDto, itemType: number): ItemInventorySummaryDto {
        return {
            itemId: item.id,
            itemName: item.name || '',
            itemNo: item.itemNo || '',
            itemType: itemType,
            nsn: item.nsn || '',
            partNo: item.partNo || '',
            totalQuantity: 0,
            usedQuantity: 0,
            reservedQuantityByOrdersOnProcessing: 0,
            remainingQuantity: 0,
            totalLots: 0
        };
    }

    /**
     * Get item type number from tab name
     */
    static getItemTypeFromTab(tab: 'ammunition' | 'weapon' | 'explosive'): number {
        const itemTypeMap = {
            'ammunition': 1,
            'weapon': 2,
            'explosive': 3
        };
        return itemTypeMap[tab];
    }

    /**
     * Get item type display name
     */
    static getItemTypeName(itemType: number): string {
        switch (itemType) {
            case 1: return 'Ammunition';
            case 2: return 'Weapon';
            case 3: return 'Explosive';
            case 4: return 'Accessory';
            default: return 'Unknown';
        }
    }

    /**
     * Format number with locale
     */
    static formatNumber(num: number): string {
        return num.toLocaleString();
    }

    /**
     * Format date to display format
     */
    static formatDate(date?: string): string {
        if (!date) return '-';
        const dateObj = new Date(date);
        return dateObj.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
}
