/**
 * Explosive models matching backend DTOs
 */

import { BaseItemDto } from './inventory.model';

/**
 * Explosive DTO (extends BaseItem)
 */
export interface ExplosiveDto extends BaseItemDto {
  // Explosives only have BaseItem properties, no additional fields
}

/**
 * Create/Update Explosive DTO
 */
export interface CreateUpdateExplosiveDto {
  name: string;
  itemNo: string;
  partNo: string;
  batchNo: string;
  hccId: number;
  nsn?: string;
  readyForIssue: boolean;
  expiryDate?: Date | string;
}

