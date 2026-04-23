/**
 * Supply Order Mapper Utilities
 * Maps between API DTOs and UI display models
 */

import { SupplyDto, SupplyDetailDto } from '@requests/services/supply.service';
import { SupplyItemDisplay } from '@models/supply-order.model';
import { getLocalizedName } from '@utils/localization.utils';

/**
 * Maps supply details from API DTO to display model for UI
 * @param supply Supply DTO from API
 * @param currentLang Current language for depot name localization ('en' | 'ar')
 */
export function mapSupplyDetailsToDisplay(supply: SupplyDto, currentLang: string = 'en'): SupplyItemDisplay[] {
  return supply.supplyDetails.map((detail: SupplyDetailDto) => {
    const itemId = detail.itemId;
    const itemName = detail.item?.name || `Item #${itemId}`;
    const depot = detail.depot || (detail as any).Depot;
    const expiryDateRaw = detail.expiryDate ?? (detail as any).ExpiryDate;
    const depotName = depot ? getLocalizedName(depot, currentLang) : undefined;
    const depotNameAr = depot ? getLocalizedName(depot, 'ar') : undefined;
    const depotNameEn = depot ? getLocalizedName(depot, 'en') : undefined;
    const expiryDate = expiryDateRaw ? (typeof expiryDateRaw === 'string' ? expiryDateRaw : new Date(expiryDateRaw).toISOString()) : undefined;

    return {
      supplyDetailId: detail.id,
      itemId: itemId,
      itemName: itemName,
      itemType: getItemTypeName(detail.item?.itemNo),
      lot: detail.lot,
      quantity: detail.quantity,
      requestedQuantity: detail.requestedQuantity,
      totalSuppliedQuantity: detail.totalSuppliedQuantity,
      isFullyFulfilled: detail.isFullyFulfilled,
      notes: detail.notes,
      depotName,
      depotNameAr,
      depotNameEn,
      expiryDate,
      isEditing: false
    };
  });
}

/**
 * Gets item type name from item number or returns default
 * TODO: Implement logic to determine type from item number
 */
function getItemTypeName(itemNo?: string): string {
  // TODO: Implement logic to determine type from item number
  return 'Supply Item';
}
