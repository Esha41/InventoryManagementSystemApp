/**
 * Supply Request Mapper Utilities
 * Functions for mapping OrderDto to SupplyRequest
 */

import { OrderDto } from '@services/order.service';
import { SupplyRequest } from '@models/supply-request.model';
import { formatDate } from '@utils/format.utils';
import { mapRequestType } from '@utils/request-mapper.utils';

/**
 * Map request type to supply request type (only Order or Return, no Discard)
 */
function mapToSupplyRequestType(type: number | string): 'Order' | 'Return' {
  const mapped = mapRequestType(type);
  // Supply requests only support Order and Return, default to Order for Discard
  return mapped === 'Discard' ? 'Order' : mapped;
}

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

  // Normalize priority to number for map lookup
  let priorityNum: number;
  if (typeof order.priority === 'string') {
    const priorityLower = order.priority.toLowerCase().trim();
    if (priorityLower === 'high' || priorityLower === '1') {
      priorityNum = 1;
    } else if (priorityLower === 'medium' || priorityLower === '2') {
      priorityNum = 2;
    } else if (priorityLower === 'low' || priorityLower === '3') {
      priorityNum = 3;
    } else if (priorityLower === 'critical' || priorityLower === '4') {
      priorityNum = 4;
    } else {
      const parsed = parseInt(order.priority, 10);
      priorityNum = isNaN(parsed) ? 1 : parsed;
    }
  } else {
    priorityNum = order.priority;
  }

  // Normalize status to number for map lookup
  let statusNum: number;
  if (typeof order.status === 'string') {
    const statusLower = order.status.toLowerCase().trim();
    if (statusLower === 'new' || statusLower === 'pending' || statusLower === '1') {
      statusNum = 1;
    } else if (statusLower === 'underprocess' || statusLower === 'under process' || statusLower === 'inprogress' || statusLower === 'in progress' || statusLower === '2') {
      statusNum = 2;
    } else if (statusLower === 'approved' || statusLower === 'completed' || statusLower === 'confirmed' || statusLower === '3') {
      statusNum = 3;
    } else if (statusLower === 'rejected' || statusLower === 'declined' || statusLower === '4') {
      statusNum = 4;
    } else if (statusLower === 'cancelled' || statusLower === '5') {
      statusNum = 5;
    } else {
      const parsed = parseInt(order.status, 10);
      statusNum = isNaN(parsed) ? 1 : parsed;
    }
  } else {
    statusNum = order.status;
  }

  // Calculate total quantity from request items
  const totalQuantity = order.requestItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return {
    id: order.id,
    issueNo: order.requestNo || order.orderNo || `#${order.id}`,
    requestType: mapToSupplyRequestType(order.requestType),
    quantity: totalQuantity,
    priority: priorityMap[priorityNum] || 'Low',
    requestDate: formatDate(order.usageDateFrom),
    status: statusMap[statusNum] || 'Pending'
  };
}

