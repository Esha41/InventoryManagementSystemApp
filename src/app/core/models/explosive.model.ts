/**
 * Explosive models matching backend DTOs
 */

import { BaseItemDto } from './inventory.model';
import { LookupDto } from './ammunition.model';

/**
 * Explosive DTO (extends BaseItem)
 */
export interface ExplosiveDto extends BaseItemDto {
  explosiveType?: number;
  unNumber?: string;
  netExplosiveQuantity?: number;
  netExplosiveQuantityUnitId?: number;
  totalWeight?: number;
  totalWeightUnitId?: number;
  hazardDivisionId?: number;
  compatibilityId?: number;
  distribution?: string;
  referenceNo?: string;
  notes?: string;
  classificationId?: number;
  typeId?: number;
  unit?: number; // ExplosiveUnit enum: 1 = Gram, 3 = Meter

  // Navigation properties
  netExplosiveQuantityUnit?: LookupDto;
  totalWeightUnit?: LookupDto;
  hazardDivision?: LookupDto;
  compatibility?: LookupDto;
  classification?: LookupDto;
  type?: LookupDto;
}

/**
 * Create/Update Explosive DTO
 */
export interface CreateUpdateExplosiveDto {
  name: string;
  itemNo: string;
  partNo?: string;
  batchNo?: string;
  hccId?: number;
  nsn?: string;
  readyForIssue?: boolean;
  expiryDate?: Date | string;

  explosiveType?: number;
  unNumber: string;
  netExplosiveQuantity?: number;
  netExplosiveQuantityUnitId?: number;
  totalWeight?: number;
  totalWeightUnitId?: number;
  hazardDivisionId?: number;
  compatibilityId?: number;
  price?: number;
  minimumQuantity?: number;
  distribution?: string;
  referenceNo?: string;
  notes?: string;
  classificationId?: number;
  typeId?: number;
  unit?: number; // ExplosiveUnit enum: 1 = Gram, 3 = Meter
}
