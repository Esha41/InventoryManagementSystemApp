/**
 * Supply Request Mapper Utilities
 * Functions for mapping OrderDto to SupplyRequest
 */

import { OrderDto } from '@services/order.service';
import { SupplyRequest } from '@models/supply-request.model';
import { formatDate } from '@utils/format.utils';

/**
 * Map OrderDto to SupplyRequest
 */
export function mapOrderToSupplyRequest(order: OrderDto): SupplyRequest {
  // Map order status to supply request status
  const statusMap: { [key: number]: SupplyRequest['status'] } = {
    1: 'Pending',      // New
    2: 'Processing',   // InProgress
    3: 'Completed',    // Completed
    4: 'Delivered',    // Delivered
    5: 'Cancelled'     // Cancelled
  };

  // Map priority (assuming priority field is 1-4)
  const priorityMap: { [key: number]: SupplyRequest['priority'] } = {
    1: 'Low',
    2: 'Medium',
    3: 'High',
    4: 'Critical'
  };

  // Calculate total quantity from request items
  const totalQuantity = order.requestItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return {
    id: order.id,
    issueNo: order.requestNo || order.orderNo || `#${order.id}`,
    requestType: order.requestType === 1 ? 'Order' : 'Return',
    quantity: totalQuantity,
    priority: priorityMap[order.priority] || 'Low',
    requestDate: formatDate(order.usageDateFrom),
    status: statusMap[order.status] || 'Pending'
  };
}

