import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

// All routes are children of the parent `path: 'warehouse'` in app.routes.ts.
// Paths here are relative — e.g., `path: ''` maps to /warehouse.
export const WAREHOUSE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/warehouse-list.component').then(m => m.WarehouseListComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WAREHOUSE.PAGE.PAGE, PERMISSIONS.WAREHOUSE.PAGE.VIEW] }
  },
  {
    path: ':id/inventory',
    loadComponent: () => import('./pages/inventory/warehouse-inventory.component').then(m => m.WarehouseInventoryComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WAREHOUSE.INVENTORY_PAGE.PAGE, PERMISSIONS.WAREHOUSE.INVENTORY.VIEW] }
  },
  // Must be before `:warehouseId/inventory/:itemId` or `/inventory/add` is matched with itemId="add" and the wrong component loads.
  {
    path: ':id/inventory/add',
    loadComponent: () => import('./pages/inventory/add-inventory/add-inventory.component').then(m => m.AddInventoryComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WAREHOUSE.INVENTORY_PAGE.PAGE, PERMISSIONS.WAREHOUSE.INVENTORY.CREATE] }
  },
  {
    path: ':warehouseId/inventory/:itemId',
    loadComponent: () => import('./pages/inventory/inventory-item-detail/inventory-item-detail.component').then(m => m.InventoryItemDetailComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WAREHOUSE.INVENTORY.VIEW] }
  },
  {
    path: ':warehouseId/inventory/:itemId/map',
    loadComponent: () => import('./pages/map/warehouse-map/warehouse-map.component').then(m => m.WarehouseMapComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WAREHOUSE.MAP.VIEW] }
  },
  {
    path: ':id/assets/add',
    loadComponent: () => import('./pages/inventory/add-weapon/add-weapon-asset.component').then(m => m.AddWeaponAssetComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ASSETS.ASSET.PAGE, PERMISSIONS.ASSETS.ASSET.CREATE] }
  },
  {
    path: ':id/assets/add/bulk-entry',
    loadComponent: () => import('./pages/inventory/add-weapon/bulk-entry/bulk-entry.component').then(m => m.BulkEntryComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ASSETS.ASSET.PAGE, PERMISSIONS.ASSETS.ASSET.CREATE] }
  },
  {
    path: ':warehouseId/assets/:id',
    loadComponent: () => import('@assets/pages/details/asset-details.component').then(m => m.AssetDetailsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ASSETS.ASSET.VIEW] }
  },
  {
    path: ':warehouseId/assets/:id/map',
    loadComponent: () => import('./pages/map/warehouse-map/warehouse-map.component').then(m => m.WarehouseMapComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WAREHOUSE.MAP.VIEW] }
  },
  {
    path: ':warehouseId/assets/:id/edit',
    loadComponent: () => import('@assets/pages/edit/edit-asset.component').then(m => m.EditAssetComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ASSETS.ASSET.EDIT] }
  },
  {
    path: ':id/batches/:batchId/edit',
    loadComponent: () => import('./pages/inventory/edit-batch/edit-batch.component').then(m => m.EditBatchComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ASSETS.ASSET.PAGE, PERMISSIONS.ASSETS.ASSET.EDIT] }
  }
];
