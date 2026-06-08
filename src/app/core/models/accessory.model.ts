
import { CatalogBaseItemDto, LookupDto } from './ammunition.model';

/** Matches Ettad.Inventory.Service.Accessories.Dtos.AccessoryDto */

export interface AccessoryDto extends CatalogBaseItemDto {
  /** Legacy single navigation when `primaryPurposes` is not populated */
  primaryPurpos?: LookupDto;
}


/** Matches CreateUpdateAccessoryDto — frontend only sends core catalog fields */

export interface CreateUpdateAccessoryDto {
  name: string;
  nameAr?: string;
  itemNo: string;
}


