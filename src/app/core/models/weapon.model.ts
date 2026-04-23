/**
 * Weapon models matching backend DTOs
 */

import { BaseItemDto } from './inventory.model';
import { LookupDto } from './ammunition.model';

/**
 * Weapon DTO (extends BaseItem)
 */
export interface WeaponDto extends BaseItemDto {
  /** Backend WeaponCaliberCategory: 1 = Small, 2 = Medium, 3 = Large */
  caliberCategory?: number;
  caliber?: string;
  caliberUnitId?: number;
  yearOfManufacture?: number;
  countryOfManufactureId?: number;
  model?: string;
  distribution?: string;
  referenceNo?: string;
  unNumber?: string;
  notes?: string;
  classificationId?: number;
  typeId?: number;

  /** Linked catalog purposes (BaseItemPrimaryPurposes) */
  primaryPurposes?: LookupDto[];
  /** Legacy single navigation when list not populated */
  primaryPurpos?: LookupDto;

  // Navigation properties
  caliberUnit?: LookupDto;
  countryOfManufacture?: LookupDto;
  classification?: LookupDto;
  type?: LookupDto;
  
  // Images array from response
  images?: Array<{
    id: number;
    fileUrl: string;
    fileName: string;
    originalName: string;
    isMain: boolean;
    entity: string;
    entityId: number;
  }>;
}

/**
 * Create/Update Weapon DTO
 */
export interface CreateUpdateWeaponDto {
  name: string;
  itemNo: string;
  partNo?: string;
  price?: number;
  minimumQuantity?: number;
  criticalQuantity?: number;
  nsn?: string;
  distribution?: string;
  referenceNo?: string;
  unNumber?: string;
  notes?: string;
  classificationId?: number;
  typeId?: number;
  /** Backend WeaponCaliberCategory: 1 = Small, 2 = Medium, 3 = Large */
  caliberCategory?: number;
  caliber?: string;
  caliberUnitId?: number;
  yearOfManufacture?: number;
  countryOfManufactureId?: number;
  model?: string;
  /** Matches API PrimaryPurposIds (BaseItemPrimaryPurposes) */
  primaryPurposIds?: number[];
}
