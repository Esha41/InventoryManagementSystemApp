import { BaseItemDto, ItemInventorySummaryDto } from '@models/inventory.model';
import { getLocalizedName } from '@utils/localization.utils';

/**
 * Utility class for transforming inventory data
 */
export class InventorySummaryUtils {
    /**
     * Transform BaseItemDto to ItemInventorySummaryDto format
     * Used for weapons and explosives that don't have the summary endpoint
     */
    static transformBaseItemToSummary(item: BaseItemDto, itemType: number, currentLang: string = 'en'): ItemInventorySummaryDto {
        return {
            itemId: item.id,
            itemName: getLocalizedName(item, currentLang) || '',
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
     * Format date to display format (DD/MM/YYYY)
     */
    static formatDate(date?: string): string {
        if (!date) return '-';
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '-';
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${day}/${month}/${year}`;
    }
}
