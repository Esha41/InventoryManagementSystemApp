import type { OrderItem } from '@models/supply-request.model';

export function applyTempLotSelectionsToOrderItem(item: OrderItem, selections: Map<string, number>): void {
  item.availableLots.forEach((lot) => {
    lot.selectedQuantity = selections.get(String(lot.lotNumber)) || 0;
  });
  item.totalSelectedForDischarge = item.availableLots.reduce((sum, lot) => sum + lot.selectedQuantity, 0);
}
