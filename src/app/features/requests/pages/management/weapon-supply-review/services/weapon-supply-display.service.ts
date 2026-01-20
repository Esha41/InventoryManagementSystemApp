import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { OrderDto } from '@models/order.model';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';
import { formatNumber as formatNumberUtil, formatDate as formatDateUtil } from '@utils/format.utils';
import { ItemWithAssets } from './weapon-supply-review.service';

/**
 * Service to handle display formatting and calculations
 */
@Injectable()
export class WeaponSupplyDisplayService {

    constructor(private translate: TranslateService) { }

    /**
     * Format number for display
     */
    formatNumber(num: number): string {
        return formatNumberUtil(num);
    }

    /**
     * Format date for display
     */
    formatDate(date: Date | string | undefined): string {
        return formatDateUtil(date);
    }

    /**
     * Get current language
     */
    getCurrentLang(): string {
        return getCurrentLang(this.translate);
    }

    /**
     * Get department name from order data
     */
    getDepartmentName(orderData: OrderDto | null): string {
        if (!orderData) return 'N/A';
        const currentLang = getCurrentLang(this.translate);

        if (orderData.department) {
            return getLocalizedName(orderData.department, currentLang) || 'N/A';
        }

        if (orderData.departmentNameEn || orderData.departmentNameAr) {
            return getLocalizedName(
                {
                    nameEn: orderData.departmentNameEn,
                    nameAr: orderData.departmentNameAr
                },
                currentLang
            ) || 'N/A';
        }

        return 'N/A';
    }

    /**
     * Get requester name from order data
     */
    getRequesterName(orderData: OrderDto | null): string {
        if (!orderData) return 'N/A';
        const currentLang = getCurrentLang(this.translate);

        if (orderData.requester) {
            const localized = getLocalizedName(
                {
                    nameEn: orderData.requester.fullNameEN,
                    nameAr: orderData.requester.fullNameAR
                },
                currentLang
            );
            if (localized) return localized;
            if (orderData.requester.userName) return orderData.requester.userName;
        }

        if (orderData.requesterNameEn || orderData.requesterNameAr) {
            return getLocalizedName(
                {
                    nameEn: orderData.requesterNameEn,
                    nameAr: orderData.requesterNameAr
                },
                currentLang
            ) || 'N/A';
        }

        if (orderData.requesterName) return orderData.requesterName;

        return 'N/A';
    }

    /**
     * Calculate total selected count
     */
    getTotalSelectedCount(items: ItemWithAssets[]): number {
        return items.reduce((sum, item) => sum + item.selectedCount, 0);
    }

    /**
     * Calculate total requested count
     */
    getTotalRequestedCount(items: ItemWithAssets[]): number {
        return items.reduce((sum, item) => sum + item.requestedQuantity, 0);
    }

    /**
     * Check if all items are fully fulfilled
     */
    isFullyFulfilled(items: ItemWithAssets[]): boolean {
        return items.every(item => item.selectedCount >= item.requestedQuantity);
    }

    /**
     * Check if any items are partially fulfilled
     */
    isPartiallyFulfilled(items: ItemWithAssets[]): boolean {
        return items.some(item =>
            item.selectedCount > 0 && item.selectedCount < item.requestedQuantity
        );
    }
}
