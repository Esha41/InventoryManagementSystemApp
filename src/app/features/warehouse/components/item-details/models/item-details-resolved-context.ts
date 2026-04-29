import { ItemDetailsData, ItemTypeHint } from './item-details-types';

/** Resolved view context for item-details (shape flags + asset subtype). */
export interface ItemDetailsResolvedContext {
  item: Exclude<ItemDetailsData, null>;
  itemTypeHint?: ItemTypeHint;
  isInventoryDetail: boolean;
  isCartridge: boolean;
  isAsset: boolean;
  isDirectDto: boolean;
  isAmmunition: boolean;
  isWeapon: boolean;
  isExplosive: boolean;
}
