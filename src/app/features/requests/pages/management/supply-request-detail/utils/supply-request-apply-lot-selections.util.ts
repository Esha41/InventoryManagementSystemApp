import type { OrderItem } from '@models/supply-request.model';
import { normalizeSupplyLotKey } from './supply-request-draft-lot.util';

export function applyTempLotSelectionsToOrderItem(item: OrderItem, selections: Map<string, number>): void {
  item.availableLots.forEach((lot) => {
    lot.selectedQuantity = selections.get(normalizeSupplyLotKey(lot.lotNumber)) || 0;
  });
  item.totalSelectedForDischarge = item.availableLots.reduce((sum, lot) => sum + lot.selectedQuantity, 0);
}
