/**
 * Weapon models matching backend DTOs
 */

import { BaseItemDto } from './inventory.model';
import { LookupDto } from './ammunition.model';

/**
 * Weapon DTO (extends BaseItem)
 */
export interface WeaponDto extends BaseItemDto {
  weaponType: number;
  caliber: string;
  actionType: number;
  barrelLength?: number;
  barrelLengthUnitId?: number;
  overallLength?: number;
  overallLengthUnitId?: number;
  weight?: number;
  weightUnitId?: number;
  capacity?: number;

  // Navigation properties
  weaponTypeNav?: LookupDto; // Enum mapped to lookup if needed, usually just handled by util
  actionTypeNav?: LookupDto; // Enum mapped to lookup if needed
  barrelLengthUnit?: LookupDto;
  overallLengthUnit?: LookupDto;
  weightUnit?: LookupDto;
}

/**
 * Create/Update Weapon DTO
 */
export interface CreateUpdateWeaponDto {
  name: string;
  itemNo: string;
  partNo?: string;
  batchNo?: string; // Managed separately usually, but included in backend entity
  hccId?: number;
  nsn?: string;
  readyForIssue?: boolean;
  expiryDate?: Date | string;

  weaponType: number;
  caliber: string;
  actionType: number;
  barrelLength?: number;
  barrelLengthUnitId?: number;
  overallLength?: number;
  overallLengthUnitId?: number;
  weight?: number;
  weightUnitId?: number;
  capacity?: number;
  price?: number;
  minimumQuantity?: number;
}
