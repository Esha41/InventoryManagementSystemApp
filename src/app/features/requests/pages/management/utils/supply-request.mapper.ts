/**
 * Supply Request Mapper Utilities
 * Functions for mapping OrderDto to SupplyRequestDetail and related operations
 */

import { OrderDto } from '@models/order.model';
import { SupplyRequestDetail, OrderItem } from '@models/supply-request.model';
import { OrderSupplySuggestionDto } from '@requests/services/supply.service';
import { formatDate } from '@utils/format.utils';
import { mapSuggestedLotsToLotItems } from './lot-mapper.utils';
import { mapRequestType } from '@utils/request-mapper.utils';

/**
 * Map request type to supply request type (only Order or Return, no Discard)
 */
function mapToSupplyRequestType(type: number): 'Order' | 'Return' {
  const mapped = mapRequestType(type);
  // Supply requests only support Order and Return, default to Order for Discard
  return mapped === 'Discard' ? 'Order' : mapped;
}

/**
 * Map OrderDto to SupplyRequestDetail
 */
export function mapOrderToRequestDetail(order: OrderDto): SupplyRequestDetail {
  // Backend RequestPriority enum: Normal = 1, Urgent = 2, VeryUrgent = 3, Critical = 4
  // Map to SupplyRequestDetail priority format (keeping as string for display)
  const priorityMap: { [key: number]: SupplyRequestDetail['priority'] } = {
    1: 'Normal',
    2: 'Urgent',
    3: 'VeryUrgent',
    4: 'Critical'
  };

  const statusMap: { [key: number]: SupplyRequestDetail['status'] } = {
    1: 'Pending',
    2: 'Processing',
    3: 'Completed',
    4: 'Delivered',
    5: 'Cancelled'
  };

  const priorityNum = order.priority;
  const statusNum = order.status;

  const items: OrderItem[] = (order.requestItems || []).map(item => ({
    requestItemId: item.id,
    itemId: item.itemId,
    itemName: item.itemName || 'N/A',
    itemType: getItemTypeName(item.itemType),
    requestedQuantity: item.quantity,
    approvedQuantity: item.quantity,
    availableLots: [],
    totalSelectedForDischarge: 0,
    canFulfillCompletely: false
  }));

  return {
    issueNo: order.requestNo || order.orderNo || `#${order.id}`,
    requestType: mapToSupplyRequestType(order.requestType),
    priority: priorityMap[priorityNum] || 'Urgent',
    requestDate: formatDate(order.usageDateFrom),
    requesterName: order.requesterName || 'N/A',
    requesterId: order.requesterId || 'N/A',
    requesterRank: 'N/A',
    status: statusMap[statusNum] || 'Pending',
    approvalWorkflow: [],
    items: items
  };
}

function getItemTypeName(itemType?: number): string {
  const typeMap: Record<number, string> = {
    1: 'Ammunition',
    2: 'Weapon',
    3: 'Explosive',
    4: 'Accessory'
  };
  if (itemType === undefined || itemType === null) {
    return 'Other';
  }
  return typeMap[itemType] || 'Other';
}

/**
 * Apply suggestion results to all items in the request
 * Preserves existing lots and selections for items not in suggestions
 */
export function applySuggestionToItems(
  requestDetail: SupplyRequestDetail,
  suggestion: OrderSupplySuggestionDto,
  currentLang: string = 'en'
): void {
  // Track which items have suggestions
  const itemsWithSuggestions = new Set<number>();
  
  suggestion.itemSuggestions.forEach(itemSuggestion => {
    const item = requestDetail.items.find(i => i.requestItemId === itemSuggestion.requestItemId);
    if (item) {
      itemsWithSuggestions.add(item.requestItemId);
      
      // Preserve existing selections before applying new suggestions
      const existingSelections = new Map<string, number>();
      if (item.availableLots && item.availableLots.length > 0) {
        item.availableLots.forEach(lot => {
          if (lot.selectedQuantity > 0) {
            existingSelections.set(String(lot.lotNumber), lot.selectedQuantity);
          }
        });
      }
      
      item.canFulfillCompletely = itemSuggestion.canFulfillCompletely;
      item.availableLots = mapSuggestedLotsToLotItems(itemSuggestion.lotSuggestions, existingSelections, currentLang);
      item.totalSelectedForDischarge = item.availableLots.reduce(
        (sum, lot) => sum + lot.selectedQuantity,
        0
      );
    }
  });
  
  // Items not in suggestions keep their existing lots (if any)
  // This handles cases where a new item was just added and isn't in suggestions yet
  requestDetail.items.forEach(item => {
    if (!itemsWithSuggestions.has(item.requestItemId)) {
      // If item has no lots at all, keep it empty (will be populated when suggestions include it)
      // If item already has lots, preserve them
      if (!item.availableLots || item.availableLots.length === 0) {
        // New item - will get suggestions on next load or when backend includes it
        item.availableLots = [];
      }
      // Otherwise, keep existing lots as-is
    }
  });

  requestDetail.items.forEach(item => capOrderItemDischargeToApprovedQuantity(item));
}

/**
 * When order item quantity is reduced, draft discharge selections may still sum above the new approved amount.
 * Trim lot selections (FIFO over lots) so totals match approved quantity and UI/discharge stay consistent.
 */
export function capOrderItemDischargeToApprovedQuantity(item: OrderItem): void {
  if (!item.availableLots?.length) {
    return;
  }

  const sum = item.availableLots.reduce((s, lot) => s + (lot.selectedQuantity || 0), 0);
  const cap = item.approvedQuantity ?? 0;

  if (sum <= cap) {
    item.totalSelectedForDischarge = sum;
    return;
  }

  let toRemove = sum - cap;
  for (const lot of item.availableLots) {
    if (toRemove <= 0) {
      break;
    }
    const q = lot.selectedQuantity || 0;
    const take = Math.min(q, toRemove);
    lot.selectedQuantity = q - take;
    toRemove -= take;
  }

  item.totalSelectedForDischarge = item.availableLots.reduce(
    (s, lot) => s + (lot.selectedQuantity || 0),
    0
  );
}

/**
 * Calculate discharge summary totals
 */
export function calculateDischargeTotals(items: OrderItem[]): {
  totalApproved: number;
  totalSelected: number;
  totalRemaining: number;
} {
  const totalApproved = items.reduce((sum, item) => sum + item.approvedQuantity, 0);
  const totalSelected = items.reduce((sum, item) => sum + item.totalSelectedForDischarge, 0);
  const totalRemaining = totalApproved - totalSelected;

  return { totalApproved, totalSelected, totalRemaining };
}

/**
 * Check if discharge can be processed
 */
export function canProcessDischarge(items: OrderItem[]): boolean {
  const { totalSelected, totalApproved } = calculateDischargeTotals(items);
  return totalSelected > 0 && totalSelected <= totalApproved;
}

