import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

export const ASSETS_ROUTES: Routes = [
  {
    path: 'add-asset',
    loadComponent: () => import('./pages/add/add-asset.component').then(m => m.AddAssetComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ASSETS.ADD_NEW_ASSET_PAGE.PAGE, PERMISSIONS.ASSETS.AMMUNITION.CREATE] }
  },
  {
    path: 'asset-list',
    loadComponent: () => import('./pages/list/asset-list.component').then(m => m.AssetListComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ASSETS.AMMUNITION.PAGE] }
  },
  {
    path: 'asset-list/:id',
    loadComponent: () => import('@assets/components/asset-details/asset-details.component').then(m => m.AssetDetailsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ASSETS.AMMUNITION.VIEW, PERMISSIONS.ASSETS.WEAPON.VIEW, PERMISSIONS.ASSETS.EXPLOSIVE.VIEW] }
  },
  {
    path: 'weapon-asset-master',
    loadComponent: () => import('./pages/weapon-asset-master/weapon-asset-master.component').then(m => m.WeaponAssetMasterComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ASSETS.ASSET.PAGE, PERMISSIONS.ASSETS.ASSET.VIEW] }
  }
];
