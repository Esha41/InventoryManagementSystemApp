/**
 * Weapon models matching backend DTOs
 */

import { BaseItemDto } from './inventory.model';

/**
 * Weapon DTO (extends BaseItem)
 */
export interface WeaponDto extends BaseItemDto {
  // Weapons only have BaseItem properties, no additional fields
}

/**
 * Create/Update Weapon DTO
 */
export interface CreateUpdateWeaponDto {
  name: string;
  itemNo: string;
  partNo: string;
  batchNo: string;
  hccId: number;
  nsn?: string;
  readyForIssue: boolean;
  expiryDate?: Date | string;
}

