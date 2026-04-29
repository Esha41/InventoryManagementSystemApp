/**
 * Weapon models matching backend inventory DTOs
 */

import { CatalogBaseItemDto, LookupDto } from './ammunition.model';

/**
 * Matches Ettad.Inventory.Service.Weapons.Dtos.WeaponDto (extends catalog base).
 */
export interface WeaponDto extends CatalogBaseItemDto {
  /** Backend WeaponCaliberCategory: 1 = Small, 2 = Medium, 3 = Large (JSON may be string). */
  caliberCategory?: number | string | null;
  caliberId?: number | null;
  caliberUnitId?: number | null;
  yearOfManufacture?: number | null;
  countryOfManufactureId?: number | null;
  model?: string | null;
  caliber?: LookupDto | null;
  caliberUnit?: LookupDto | null;
  countryOfManufacture?: LookupDto | null;
  /** Legacy single navigation when `primaryPurposes` is not populated */
  primaryPurpos?: LookupDto;

  /** Optional on catalog; may appear when merged with inventory / legacy API. */
  batchNo?: string | null;
  hccId?: number | null;
  hcc?: LookupDto | null;
  readyForIssue?: boolean;
  expiryDate?: Date | string;
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
  caliberCategory?: number;
  caliberId?: number | null;
  caliberUnitId?: number;
  yearOfManufacture?: number;
  countryOfManufactureId?: number;
  model?: string;
  primaryPurposIds?: number[];
}
