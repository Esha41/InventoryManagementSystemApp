/**
 * Permissions for import / export on list pages (align with backend CheckAuthorize).
 * Use *appHasPermission with appPermissionMode="any" for array constants.
 */

import { AssetType } from '@models/asset-list.model';
import { PERMISSIONS } from './permissions.constants';

/** Export catalog: user can export if they can see the asset type (page/view) or manage it */
export const ASSET_LIST_EXPORT_PERMISSIONS: Record<AssetType, readonly string[]> = {
  ammunition: [
    PERMISSIONS.ASSETS.AMMUNITION.PAGE,
    PERMISSIONS.ASSETS.AMMUNITION.VIEW,
    PERMISSIONS.ASSETS.AMMUNITION.CREATE_CLAIM,
    PERMISSIONS.ASSETS.AMMUNITION.EDIT
  ],
  weapon: [
    PERMISSIONS.ASSETS.WEAPON.PAGE,
    PERMISSIONS.ASSETS.WEAPON.VIEW,
    PERMISSIONS.ASSETS.WEAPON.CREATE_CLAIM,
    PERMISSIONS.ASSETS.WEAPON.EDIT
  ],
  explosive: [
    PERMISSIONS.ASSETS.EXPLOSIVE.PAGE,
    PERMISSIONS.ASSETS.EXPLOSIVE.VIEW,
    PERMISSIONS.ASSETS.EXPLOSIVE.CREATE_CLAIM,
    PERMISSIONS.ASSETS.EXPLOSIVE.EDIT
  ]
};

/** Catalog tabs (list / header): same as export — any browse or edit claim for that entity */
export const ASSET_LIST_TAB_PERMISSIONS: Record<AssetType, readonly string[]> = ASSET_LIST_EXPORT_PERMISSIONS;

/**
 * Create on the catalog tab: required for Add, bulk import, and API template download
 * (same as backend CheckAuthorize on POST Import / template for that entity).
 */
export const ASSET_LIST_CREATE_PERMISSIONS: Record<AssetType, readonly string[]> = {
  ammunition: [PERMISSIONS.ASSETS.AMMUNITION.CREATE_CLAIM],
  weapon: [PERMISSIONS.ASSETS.WEAPON.CREATE_CLAIM],
  explosive: [PERMISSIONS.ASSETS.EXPLOSIVE.CREATE_CLAIM]
};

/** @deprecated use ASSET_LIST_CREATE_PERMISSIONS */
export const ASSET_LIST_IMPORT_PERMISSIONS = ASSET_LIST_CREATE_PERMISSIONS;

/** Depot inventory page: export visible table */
export const WAREHOUSE_DEPOT_EXPORT_PERMISSIONS = [
  PERMISSIONS.WAREHOUSE.INVENTORY_PAGE.PAGE,
  PERMISSIONS.WAREHOUSE.INVENTORY.VIEW
] as const;

export const WAREHOUSE_DEPOT_INVENTORY_IMPORT_PERMISSIONS = [PERMISSIONS.WAREHOUSE.INVENTORY.CREATE_CLAIM] as const;

export const WAREHOUSE_DEPOT_ASSET_IMPORT_PERMISSIONS = [PERMISSIONS.ASSETS.ASSET.CREATE_CLAIM] as const;
