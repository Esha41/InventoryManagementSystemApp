import { FileUploadDto } from './file-upload.model';
import { OrderDto } from './order.model';
import { EmployeeDto } from './asset.model';

/**
 * Supply API DTOs (shared across features; implementation lives in requests/supply.service).
 */
export interface SupplyLotSuggestionDto {
  inventoryDetailId: number;
  itemId: number;
  itemName: string;
  lot: string;
  availableQuantity: number;
  suggestedQuantity: number;
  expiryDate?: string;
  inventoryId: number;
  depot?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
  supplier?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
  manufacturer?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
}

export interface OrderItemSupplySuggestionDto {
  requestItemId: number;
  itemId: number;
  itemName: string;
  requestedQuantity: number;
  suggestedQuantity: number;
  canFulfillCompletely: boolean;
  lotSuggestions: SupplyLotSuggestionDto[];
}

export interface OrderSupplySuggestionDto {
  orderId: number;
  orderNo: string;
  departmentId: number;
  canFulfillCompletely: boolean;
  itemSuggestions: OrderItemSupplySuggestionDto[];
  message: string;
}

export interface CreateSupplyDetailDto {
  itemId: number;
  lot: string;
  quantity: number;
  notes?: string;
}

export interface CreateSupplyDto {
  orderId: number;
  supplyDetails: CreateSupplyDetailDto[];
}

export interface UpdateSupplyDto {
  receiverEmployeeId: number;
  notes?: string;
}

export interface SubmitSupplyDto {
  receiverEmployeeId: number;
  notes?: string;
}

export interface UpdateSupplyDetailDto {
  itemId: number;
  lot: string;
  quantity: number;
  notes?: string;
}

export interface SupplyDetailDto {
  id: number;
  supplyId: number;
  itemId: number;
  lot: string;
  quantity: number;
  notes?: string;
  requestedQuantity: number;
  totalSuppliedQuantity: number;
  isFullyFulfilled: boolean;
  expiryDate?: string;
  depot?: {
    id: number;
    nameAr?: string;
    nameEn?: string;
  };
  item?: {
    id: number;
    name?: string;
    itemNo?: string;
    itemType?: number;
    batchNo?: string;
  };
}

export interface WorkflowSupplySummaryLineDto {
  itemId: number;
  itemName: string;
  itemNo?: string | null;
  requestedQuantity: number;
  approvedQuantity?: number;
  suppliedQuantity: number;
  lot: string;
  depotId?: number | null;
  /** Legacy single name (often English); prefer depotNameEn / depotNameAr when present. */
  depotName?: string | null;
  depotNameEn?: string | null;
  depotNameAr?: string | null;
  depotCode?: string | null;
  notes?: string | null;
}

export interface WeaponSelectionLineDto {
  itemId: number;
  itemName: string;
  depotId: number;
  depotName?: string | null;
  depotNameEn?: string | null;
  depotNameAr?: string | null;
  depotCode?: string | null;
  batchId: number;
  batchNumber: string;
  selectedQuantity: number;
}

export interface WeaponSuppliedLineDto {
  itemId: number;
  itemName: string;
  assetId: number;
  serialNumber?: string | null;
  depotId?: number | null;
  depotName?: string | null;
  depotNameEn?: string | null;
  depotNameAr?: string | null;
  depotCode?: string | null;
  batchNumber?: string | null;
  assigneeName?: string | null;
  notes?: string | null;
}

export interface WorkflowSupplySummaryDto {
  orderId: number;
  orderSupplyDate?: string | null;
  supplyDate?: string | null;
  submissionStatus: number;
  fulfillmentStatus: number;
  receiverName?: string | null;
  receiverMilitaryId?: string | null;
  receiverRankName?: string | null;
  notes?: string | null;
  isWeaponOrder: boolean;
  isOrderCompleted?: boolean;
  phase?: string;
  lines: WorkflowSupplySummaryLineDto[];
  selectionLines?: WeaponSelectionLineDto[];
  weaponLines?: WeaponSuppliedLineDto[];
  files?: FileUploadDto[];
}

export interface SupplyDto {
  id: number;
  orderId: number;
  supplyDate?: string;
  receiverEmployeeId?: number;
  submissionStatus: number;
  fulfillmentStatus: number;
  notes?: string;
  order?: OrderDto;
  receiverEmployee?: EmployeeDto;
  supplyDetails: SupplyDetailDto[];
  files?: FileUploadDto[];
}
