/**
 * Supply Order Models
 */

/**
 * Approval step in the workflow
 */
export interface ApprovalStep {
  id: string;
  approverName: string;
  approverId: string;
  militaryRank: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedDate?: string;
  comments?: string;
}

/**
 * Supply item display model for UI
 */
export interface SupplyItemDisplay {
  supplyDetailId: number; // ID of the supply detail record
  itemId: number;
  itemName: string;
  itemType: string;
  lot: string;
  quantity: number;
  requestedQuantity: number;
  totalSuppliedQuantity: number;
  isFullyFulfilled: boolean;
  notes?: string;
  depotName?: string;
  depotNameAr?: string;
  depotNameEn?: string;
  expiryDate?: Date | string;
  isEditing: boolean; // Track if item is being edited
  originalQuantity?: number; // Track original quantity before editing for validation
  quantityError?: string; // Track validation error message
}

/**
 * Lot item for selection in add lot modal
 */
export interface LotItem {
  inventoryDetailId: number;
  lotNumber: string;
  quantity: number;
  expiryDate?: Date;
  location: string;
  condition: 'Good' | 'Fair' | 'Near Expiry';
  daysUntilExpiry: number;
  selectedQuantity: number;
  depotName?: string;
  supplierName?: string;
  manufacturerName?: string;
}

