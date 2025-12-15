/**
 * Supply Request Management Models
 */

import { LotItem, ApprovalStep } from './supply-order.model';
import { WorkflowApprovalStep } from '@models/workflow-approval.model';

/**
 * Supply request for the management list view
 */
export interface SupplyRequest {
  id: number;
  issueNo: string;
  requestType: 'Order' | 'Return';
  quantity: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  requestDate: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Delivered' | 'Returned' | 'Cancelled';
}

/**
 * Order item in supply request detail
 */
export interface OrderItem {
  requestItemId: number;
  itemId: number;
  itemName: string;
  itemType: string;
  requestedQuantity: number;
  approvedQuantity: number;
  availableLots: LotItem[];
  totalSelectedForDischarge: number;
  canFulfillCompletely: boolean;
}

/**
 * Supply request detail view model
 */
export interface SupplyRequestDetail {
  issueNo: string;
  requestType: 'Order' | 'Return';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  requestDate: string;
  requesterName: string;
  requesterId: string;
  requesterRank: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Delivered' | 'Returned' | 'Cancelled';
  approvalWorkflow: WorkflowApprovalStep[];
  items: OrderItem[];
}

// Re-export LotItem and ApprovalStep from supply-order.model for convenience
export { LotItem, ApprovalStep };

