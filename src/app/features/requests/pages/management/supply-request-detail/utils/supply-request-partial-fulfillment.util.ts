import type { OrderItem } from '@models/supply-request.model';

export function filterPartiallyFulfilledOrderItems(items: OrderItem[] | null | undefined): OrderItem[] {
  if (!items?.length) {
    return [];
  }
  return items.filter(
    (item) =>
      item.totalSelectedForDischarge > 0 && item.totalSelectedForDischarge < item.approvedQuantity
  );
}
