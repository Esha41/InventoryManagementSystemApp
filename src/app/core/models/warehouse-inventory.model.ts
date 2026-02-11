/**
 * Warehouse Inventory models and interfaces
 */

export interface WarehouseInventoryItem {
  id: string;
  warehouseId: string;
  caliber: string;
  nature: string;
  supplier: string;
  lot: string;
  quantity: number;
  expiryDate: Date;
  netExplosiveQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarehouseInventorySummary {
  warehouseId: string;
  warehouseName: string;
  totalItems: number;
  totalQuantity: number;
  netExplosiveQuantity: number;
  neqStatus: 'Low' | 'Medium' | 'High' | 'Critical';
  neqPercentage: number;
  warningMessage?: string;
}

export interface WarehouseInventoryRequest {
  warehouseId: string;
  page: number;
  pageSize: number;
  searchTerm?: string;
  caliberFilter?: string;
  natureFilter?: string;
  supplierFilter?: string;
}

export interface WarehouseInventoryResponse {
  items: WarehouseInventoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: WarehouseInventorySummary;
}
