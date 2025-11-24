/**
 * Supply Request Mapper Utilities
 * Functions for mapping OrderDto to SupplyRequestDetail and related operations
 */

import { OrderDto, OrderRequestItemDto } from '@services/order.service';
import { SupplyRequestDetail, OrderItem } from '@models/supply-request.model';
import { OrderSupplySuggestionDto } from '@services/supply.service';
import { formatDate } from '@utils/format.utils';
import { mapSuggestedLotsToLotItems } from './lot-mapper.utils';

/**
 * Map OrderDto to SupplyRequestDetail
 */
export function mapOrderToRequestDetail(order: OrderDto): SupplyRequestDetail {
  const priorityMap: { [key: number]: SupplyRequestDetail['priority'] } = {
    1: 'Low',
    2: 'Medium',
    3: 'High',
    4: 'Critical'
  };

  const statusMap: { [key: number]: SupplyRequestDetail['status'] } = {
    1: 'Pending',
    2: 'Processing',
    3: 'Completed',
    4: 'Delivered',
    5: 'Cancelled'
  };

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
    requestType: order.requestType === 1 ? 'Order' : 'Return',
    priority: priorityMap[order.priority] || 'Low',
    requestDate: formatDate(order.usageDate),
    requesterName: order.requesterName || 'N/A',
    requesterId: order.requesterId || 'N/A',
    requesterRank: 'N/A',
    status: statusMap[order.status] || 'Pending',
    approvalWorkflow: [],
    items: items
  };
}

/**
 * Get item type name from numeric ID
 */
function getItemTypeName(itemType?: number): string {
  const typeMap: { [key: number]: string } = {
    1: 'Ammunition',
    2: 'Weapon',
    3: 'Explosive'
  };
  return itemType ? typeMap[itemType] || 'Other' : 'Other';
}

/**
 * Apply suggestion results to all items in the request
 */
export function applySuggestionToItems(
  requestDetail: SupplyRequestDetail,
  suggestion: OrderSupplySuggestionDto
): void {
  suggestion.itemSuggestions.forEach(itemSuggestion => {
    const item = requestDetail.items.find(i => i.requestItemId === itemSuggestion.requestItemId);
    if (item) {
      item.canFulfillCompletely = itemSuggestion.canFulfillCompletely;
      item.availableLots = mapSuggestedLotsToLotItems(itemSuggestion.lotSuggestions);
      item.totalSelectedForDischarge = item.availableLots.reduce(
        (sum, lot) => sum + lot.selectedQuantity,
        0
      );
    }
  });
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

