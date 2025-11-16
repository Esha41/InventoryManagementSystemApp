/**
 * Inventory models matching backend DTOs
 */

import { SupplierDto, CountryDto, ManufacturerDto } from '@services/lookup.service';

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
  readyForIssue: boolean;
  expiryDate?: Date | string;
  isDeleted: boolean;
  hcc?: {
    id: number;
    nameAr: string;
    nameEn: string;
  };
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
  lot: number;
  inventoryId: number;
  supplierId?: number;
  manufacturerId?: number;
  countryId?: number;
  itemQuantity: number;
  currentQuantity: number;
  
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
  invoiceDate?: Date | string;
  recievedDate?: Date | string;
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
  invoiceDate?: Date | string;
  recievedDate?: Date | string;
  notes?: string;
  inventoryDetails: CreateInventoryDetailDto[];
}

export interface CreateInventoryDetailDto {
  itemId: number;
  lot: number;
  supplierId?: number;
  manufacturerId?: number;
  countryId?: number;
  itemQuantity: number;
}

/**
 * Update Inventory DTO
 */
export interface UpdateInventoryDto {
  depoId: number;
  invoiceNumber?: string;
  invoiceDate?: Date | string;
  recievedDate?: Date | string;
  notes?: string;
  inventoryDetails: UpdateInventoryDetailDto[];
}

export interface UpdateInventoryDetailDto {
  id?: number;
  itemId: number;
  lot: number;
  supplierId?: number;
  manufacturerId?: number;
  countryId?: number;
  itemQuantity: number;
}

