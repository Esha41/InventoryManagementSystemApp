/**
 * Permissions for import / export on list pages (align with backend CheckAuthorize).
 * Use *appHasPermission with appPermissionMode="any" for array constants.
 */

import { AssetType } from '@models/asset-list.model';

/** Export catalog: user can export if they can see the asset type (page/view) or manage it */
export const ASSET_LIST_EXPORT_PERMISSIONS: Record<AssetType, readonly string[]> = {
  ammunition: ['ammunition.page', 'ammunition.view', 'Ammunition.Create', 'Ammunition.Edit'],
  weapon: ['weapon.page', 'weapon.view', 'Weapon.Create', 'Weapon.Edit'],
  explosive: ['explosive.page', 'explosive.view', 'Explosive.Create', 'Explosive.Edit']
};

/** Catalog tabs (list / header): same as export — any browse or edit claim for that entity */
export const ASSET_LIST_TAB_PERMISSIONS: Record<AssetType, readonly string[]> = ASSET_LIST_EXPORT_PERMISSIONS;

/**
 * Create on the catalog tab: required for Add, bulk import, and API template download
 * (same as backend CheckAuthorize on POST Import / template for that entity).
 */
export const ASSET_LIST_CREATE_PERMISSIONS: Record<AssetType, readonly string[]> = {
  ammunition: ['Ammunition.Create'],
  weapon: ['Weapon.Create'],
  explosive: ['Explosive.Create']
};

/** @deprecated use ASSET_LIST_CREATE_PERMISSIONS */
export const ASSET_LIST_IMPORT_PERMISSIONS = ASSET_LIST_CREATE_PERMISSIONS;

/** Depot inventory page: export visible table */
export const WAREHOUSE_DEPOT_EXPORT_PERMISSIONS = ['inventorypage.page', 'inventory.view'] as const;

export const WAREHOUSE_DEPOT_INVENTORY_IMPORT_PERMISSIONS = ['Inventory.Create'] as const;

export const WAREHOUSE_DEPOT_ASSET_IMPORT_PERMISSIONS = ['Asset.Create'] as const;
