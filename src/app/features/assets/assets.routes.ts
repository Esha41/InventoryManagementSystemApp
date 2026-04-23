import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

export const ASSETS_ROUTES: Routes = [
  {
    path: 'add-asset',
    loadComponent: () => import('./pages/add/add-asset.component').then(m => m.AddAssetComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['addnewassetpage.page', 'ammunition.create'] }
  },
  {
    path: 'asset-list',
    loadComponent: () => import('./pages/list/asset-list.component').then(m => m.AssetListComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ammunition.page'] }
  },
  {
    path: 'asset-list/:id',
    loadComponent: () => import('@components/asset-details/asset-details.component').then(m => m.AssetDetailsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ammunition.view', 'weapon.view', 'explosive.view'] }
  },
  {
    path: 'weapon-asset-master',
    loadComponent: () => import('./pages/weapon-asset-master/weapon-asset-master.component').then(m => m.WeaponAssetMasterComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['asset.page', 'asset.view'] }
  }
];
