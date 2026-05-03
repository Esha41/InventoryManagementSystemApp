import { OrderDto } from '@models/order.model';
import { getLocalizedName } from '@utils/localization.utils';


export function resolveUsagePurposeDisplay(orderData: OrderDto | null | undefined, lang: string): string {
  if (!orderData) {
    return 'N/A';
  }
  if (orderData.requestPurpose) {
    return (
      getLocalizedName(
        {
          nameEn: orderData.requestPurpose.nameEn,
          nameAr: orderData.requestPurpose.nameAr
        },
        lang
      ) ||
      orderData.usagePurpose ||
      'N/A'
    );
  }
  return (
    getLocalizedName(
      {
        nameEn: orderData.requestPurposeNameEn,
        nameAr: orderData.requestPurposeNameAr
      },
      lang
    ) ||
    orderData.usagePurpose ||
    'N/A'
  );
}

export function resolveDepartmentNameDisplay(orderData: OrderDto | null | undefined, lang: string): string {
  if (!orderData) {
    return 'N/A';
  }
  if (orderData.department) {
    const localized = getLocalizedName(orderData.department, lang);
    if (localized) {
      return localized;
    }
  }
  if (orderData.departmentNameEn || orderData.departmentNameAr) {
    const localized = getLocalizedName(
      {
        nameEn: orderData.departmentNameEn,
        nameAr: orderData.departmentNameAr
      },
      lang
    );
    if (localized) {
      return localized;
    }
  }
  return 'N/A';
}

export function resolveRequesterNameDisplay(orderData: OrderDto | null | undefined, lang: string): string {
  if (!orderData) {
    return 'N/A';
  }
  if (orderData.requester) {
    const localized = getLocalizedName(orderData.requester, lang);
    if (localized) {
      return localized;
    }
    if (orderData.requester.userName) {
      return orderData.requester.userName;
    }
  }
  if (orderData.requesterName) {
    return orderData.requesterName;
  }
  return 'N/A';
}
