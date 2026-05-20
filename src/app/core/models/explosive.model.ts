/**
 * Explosive models matching backend inventory DTOs
 */

import { CatalogBaseItemDto, LookupDto } from './ammunition.model';

/**
 * Matches Ettad.Inventory.Service.Explosives.Dtos.ExplosiveDto (extends catalog base).
 */
export interface ExplosiveDto extends CatalogBaseItemDto {
  armNumber?: string | null;
  compatibilityId?: number | null;
  unitId?: number | null;
  hazardDivisionId?: number | null;
  compatibility?: LookupDto | null;
  unit?: LookupDto | null;
  hazardDivision?: LookupDto | null;
  /** Legacy single navigation when `primaryPurposes` is not populated */
  primaryPurpos?: LookupDto;

  /**
   * Not on inventory ExplosiveDto; optional on payloads / forms (e.g. type enum or UI-only).
   */
  explosiveType?: number | null;
  netExplosiveQuantity?: number | null;
  netExplosiveQuantityUnitId?: number | null;
  netExplosiveQuantityUnit?: LookupDto | null;
  totalWeight?: number | null;
  totalWeightUnitId?: number | null;
  totalWeightUnit?: LookupDto | null;

  /** Optional on catalog; may appear when merged with inventory / legacy API. */
  batchNo?: string | null;
  hccId?: number | null;
  hcc?: LookupDto | null;
  readyForIssue?: boolean;
  expiryDate?: Date | string;
}

/**
 * Create/Update Explosive DTO
 */
export interface CreateUpdateExplosiveDto {
  name: string;
  nameAr?: string;
  itemNo: string;
  partNo?: string;
  armNumber?: string;
  batchNo?: string;
  hccId?: number;
  nsn?: string;
  readyForIssue?: boolean;
  expiryDate?: Date | string;
  explosiveType?: number;
  unNumber?: string;
  netExplosiveQuantity?: number;
  netExplosiveQuantityUnitId?: number;
  totalWeight?: number;
  totalWeightUnitId?: number;
  hazardDivisionId?: number;
  compatibilityId?: number;
  price?: number;
  minimumQuantity?: number;
  criticalQuantity?: number;
  distribution?: string;
  referenceNo?: string;
  notes?: string;
  classificationId?: number;
  typeId?: number;
  unitId?: number;
  primaryPurposIds?: number[];
}
