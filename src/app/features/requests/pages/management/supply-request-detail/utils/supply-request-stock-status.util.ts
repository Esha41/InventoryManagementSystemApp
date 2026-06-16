import type { OrderItem } from '@models/supply-request.model';

export type ItemStockAlertLevel = 'critical' | 'low';

/** Remaining stock after applying current discharge selections for this order. */
export function getProjectedRemainingQuantity(item: OrderItem): number | null {
  if (item.remainingQuantity == null) {
    return null;
  }
  const draftHold = item.draftHoldQuantity ?? 0;
  const selected = item.totalSelectedForDischarge ?? 0;
  return item.remainingQuantity + draftHold - selected;
}

export function getItemStockAlertLevel(item: OrderItem): ItemStockAlertLevel | null {
  const projected = getProjectedRemainingQuantity(item);
  if (projected == null) {
    return null;
  }

  const critical = item.criticalQuantity;
  if (critical != null && critical > 0 && projected <= critical) {
    return 'critical';
  }

  const minimum = item.minimumQuantity;
  if (minimum != null && minimum > 0 && projected <= minimum) {
    return 'low';
  }

  return null;
}

export function hasStockThresholdConfigured(item: OrderItem): boolean {
  const minimum = item.minimumQuantity;
  const critical = item.criticalQuantity;
  return (minimum != null && minimum > 0) || (critical != null && critical > 0);
}
