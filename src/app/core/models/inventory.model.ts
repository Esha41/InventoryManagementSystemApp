/**
 * Inventory models matching backend DTOs
 */

import { SupplierDto, CountryDto, ManufacturerDto } from '@services/lookup.service';
import { FileUploadDto } from '@models/file-upload.model';

/**
 * Base Item DTO (for Ammunition, Weapons, etc.)
 */
export interface BaseItemDto {
  id: number;
  name: string;
  nameAr?: string | null;
  itemNo: string;
  itemType: ItemType;
  batchNo: string;
  hccId: number;
  partNo: string;
  nsn?: string;
  readyForIssue: boolean;
  expiryDate?: Date | string;
  price?: number;
  minimumQuantity?: number;
  criticalQuantity?: number;
  isDeleted: boolean;
  hcc?: {
    id: number;
    nameAr: string;
    nameEn: string;
  };
  /** Catalog-linked purposes; used to resolve lot primary purpose label when line navigation is partial */
  primaryPurposes?: Array<{ id: number; nameAr: string; nameEn: string }>;
}

export { ItemType } from '@models/backend-enums';

import { ItemType } from '@models/backend-enums';

/** Coerce API itemType to numeric {@link ItemType} (0 if invalid). */
export function normalizeItemType(raw: unknown): ItemType | 0 {
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < ItemType.Ammunition || n > ItemType.Accessory) return 0;
  return n as ItemType;
}

/** Minimal row from POST /api/Asset/catalog-items/paged */
export interface AssetItemCatalogSummaryDto {
  itemId: number;
  itemName: string;
  itemNameAr?: string | null;
  itemNo: string;
  nsn: string;
  partNo: string;
  itemType: ItemType;
  caliberId?: number | null;
  caliber?: string | null;
  totalAssets: number;
}

/**
 * Inventory Detail DTO
 */
export interface InventoryDetailDto {
  id: number;
  itemId: number;
  lot: string;
  inventoryId: number;
  files?: FileUploadDto[];
  deliveryReceipt?: string;
  supplierId?: number;
  manufacturerId?: number;
  countryId?: number;
  originalQuantity: number;
  currentQuantity: number;
  batchNo?: string;
  expiryDate?: Date | string;
  yearOfManufacture?: number;
  readyForIssue: boolean;
  usedQuantity: number;
  reservedQuantityByOrdersOnProcessing: number;
  remainingQuantity: number;
  isLotEmpty: boolean;

  // Invoice Information (from parent Inventory)
  invoiceNumber?: string;
  invoiceDate?: Date | string;
  recievedDate?: Date | string;
  contractNumber?: string;
  notes?: string;

  /** Backend typo for `primaryPurposeId` — see primary-purpose.model.ts */
  primaryPurposId?: number;
  /** Backend typo for `primaryPurpose` navigation — see primary-purpose.model.ts */
  primaryPurpos?: {
    id: number;
    nameAr: string;
    nameEn: string;
  };

  // Navigation properties
  item?: BaseItemDto;
  supplier?: SupplierDto;
  manufacturer?: ManufacturerDto;
  country?: CountryDto;
}

/**
 * Inventory DTO
 */
export interface InventoryDto {
  id: number;
  depoId: number;
  invoiceNumber?: string;
  deliveryReceipt?: string;
  invoiceDate?: Date | string;
  recievedDate?: Date | string;
  contractNumber?: string;
  notes?: string;

  // Navigation properties
  depo?: {
    id: number;
    nameAr: string;
    nameEn: string;
    location?: string;
    latitude?: number;
    longitude?: number;
  };
  inventoryDetails?: InventoryDetailDto[];
}

/**
 * Create Inventory DTO
 */
export interface CreateInventoryDto {
  depoId: number;
  invoiceNumber?: string;
  deliveryReceipt?: string;
  invoiceDate?: Date | string;
  recievedDate?: Date | string;
  contractNumber?: string;
  notes?: string;
  inventoryDetails: CreateInventoryDetailDto[];
}

export interface CreateInventoryDetailDto {
  itemId: number;
  lot: string;
  supplierId?: number;
  manufacturerId?: number;
  countryId?: number;
  originalQuantity: number;
  batchNo?: string;
  expiryDate?: Date | string;
  readyForIssue?: boolean;
  /** Must be one of the selected catalog item's primaryPurposes (when provided) */
  primaryPurposId?: number;
}

/**
 * Update Inventory DTO
 */
export interface UpdateInventoryDto {
  depoId: number;
  invoiceNumber?: string;
  deliveryReceipt?: string;
  invoiceDate?: Date | string;
  recievedDate?: Date | string;
  contractNumber?: string;
  notes?: string;
  inventoryDetails: UpdateInventoryDetailDto[];
  /** Existing uploaded file ids removed in UI; backend deletes them during update. */
  removedFileIds?: number[];
}

export interface UpdateInventoryDetailDto {
  id?: number;
  itemId: number;
  lot: string;
  supplierId?: number;
  manufacturerId?: number;
  countryId?: number;
  originalQuantity: number;
  batchNo?: string;
  expiryDate?: Date | string;
  readyForIssue?: boolean;
  /** Must be one of the catalog item's primaryPurposes when applicable (ammunition / explosive) */
  primaryPurposId?: number;
}

export interface ItemInventorySummaryDto {
  itemId: number;
  itemName: string;
  itemNameAr?: string | null;
  itemNo: string;
  itemType: number;
  nsn: string;
  partNo: string;
  /** Lookup id for ammunition / weapon caliber (asset-list style filter). */
  caliberId?: number | null;
  /** Catalog field (ammunition / weapon); may be empty */
  caliber?: string | null;
  caliberUnitName?: string | null;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantityByOrdersOnProcessing: number;
  remainingQuantity: number;
  totalLots: number;
}

