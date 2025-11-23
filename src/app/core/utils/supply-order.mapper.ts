/**
 * Supply Order Mapper Utilities
 * Maps between API DTOs and UI display models
 */

import { SupplyDto } from '@services/supply.service';
import { SupplyItemDisplay } from '@models/supply-order.model';

/**
 * Maps supply details from API DTO to display model for UI
 */
export function mapSupplyDetailsToDisplay(supply: SupplyDto): SupplyItemDisplay[] {
  return supply.supplyDetails.map(detail => {
    const itemId = detail.itemId;
    const itemName = detail.item?.name || `Item #${itemId}`;
    
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

