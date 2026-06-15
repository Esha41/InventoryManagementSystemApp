import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { OrderDto } from '@models/order.model';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';
import { formatDate as formatDateUtil } from '@utils/format.utils';

@Injectable()
export class WeaponSupplyDisplayService {

    constructor(private translate: TranslateService) {}

    formatDate(date: Date | string | undefined): string {
        return formatDateUtil(date);
    }

    getCurrentLang(): string {
        return getCurrentLang(this.translate);
    }

    getDepartmentName(orderData: OrderDto | null): string {
        if (!orderData) return 'N/A';
        const currentLang = getCurrentLang(this.translate);

        if (orderData.department) {
            return getLocalizedName(orderData.department, currentLang) || 'N/A';
        }

        if (orderData.departmentNameEn || orderData.departmentNameAr) {
            return getLocalizedName(
                { nameEn: orderData.departmentNameEn, nameAr: orderData.departmentNameAr },
                currentLang
            ) || 'N/A';
        }

        return 'N/A';
    }

    getRequesterName(orderData: OrderDto | null): string {
        if (!orderData) return 'N/A';
        const currentLang = getCurrentLang(this.translate);

        if (orderData.requester) {
            const localized = getLocalizedName(
                { nameEn: orderData.requester.fullNameEN, nameAr: orderData.requester.fullNameAR },
                currentLang
            );
            if (localized) return localized;
            if (orderData.requester.userName) return orderData.requester.userName;
        }

        if (orderData.requesterNameEn || orderData.requesterNameAr) {
            return getLocalizedName(
                { nameEn: orderData.requesterNameEn, nameAr: orderData.requesterNameAr },
                currentLang
            ) || 'N/A';
        }

        if (orderData.requesterName) return orderData.requesterName;

        return 'N/A';
    }
}
