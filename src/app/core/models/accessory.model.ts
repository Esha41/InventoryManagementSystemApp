/**
 * Accessory models matching backend inventory DTOs
 */

import { CatalogBaseItemDto } from './ammunition.model';

/** Matches Ettad.Inventory.Service.Accessories.Dtos.AccessoryDto */
export type AccessoryDto = CatalogBaseItemDto;

/** Matches CreateUpdateAccessoryDto — frontend only sends core catalog fields */
export interface CreateUpdateAccessoryDto {
  name: string;
  nameAr?: string;
  itemNo: string;
}
