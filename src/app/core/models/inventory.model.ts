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
  isDeleted: boolean;
  hcc?: {
    id: number;
    nameAr: string;
    nameEn: string;
  };
  /** Catalog-linked purposes; used to resolve lot primary purpose label when line navigation is partial */
  primaryPurposes?: Array<{ id: number; nameAr: string; nameEn: string }>;
}

export enum ItemType {
  Ammunition = 1,
  Weapon = 2,
  Explosive = 3,
  Accessory = 4
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

  /** Selected primary purpose for this lot (inventory line) */
  primaryPurposId?: number;
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
  itemNo: string;
  itemType: number;
  nsn: string;
  partNo: string;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantityByOrdersOnProcessing: number;
  remainingQuantity: number;
  totalLots: number;
}

