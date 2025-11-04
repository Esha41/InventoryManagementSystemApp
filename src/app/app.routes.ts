import { Routes } from '@angular/router';
import { MainLayoutComponent } from '@layouts/main-layout/main-layout.component';
import { AuthLayoutComponent } from '@layouts/auth-layout/auth-layout.component';
import { authGuard, permissionGuard } from '@guards/index';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('@pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'supply-request-management',
        loadComponent: () => import('@pages/supply-request-management/supply-request-management.component').then(m => m.SupplyRequestManagementComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.view', 'request.manage'] }
      },
      {
        path: 'supply-request-management/:id',
        loadComponent: () => import('@pages/supply-request-management/supply-request-detail/supply-request-detail.component').then(m => m.SupplyRequestDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.view', 'request.manage'] }
      },
      {
        path: 'warehouse',
        loadComponent: () => import('@pages/warehouse/warehouse.component').then(m => m.WarehouseComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['warehouse.view', 'warehousepage.view'] } // Support both permission formats
      },
      {
        path: 'warehouse/ammunition-display',
        loadComponent: () => import('@pages/warehouse/ammunition-display/ammunition-display.component').then(m => m.AmmunitionDisplayComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['warehouse.view', 'warehousepage.view'] } // Support both permission formats
      },
      {
        path: 'allowance',
        loadComponent: () => import('@pages/allowance/allowance.component').then(m => m.AllowanceComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.create', 'allowance.view'] }
      },
      {
        path: 'warehouse/:id/inventory',
        loadComponent: () => import('@pages/warehouse-inventory/warehouse-inventory.component').then(m => m.WarehouseInventoryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['warehouse.view', 'warehousepage.view'] } // Support both permission formats
      },
      {
        path: 'warehouse/:warehouseId/inventory/:itemId',
        loadComponent: () => import('@pages/warehouse-inventory/inventory-item-detail/inventory-item-detail.component').then(m => m.InventoryItemDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['warehouse.view', 'warehousepage.view'] } // Support both permission formats
      },
      {
        path: 'warehouse/:warehouseId/inventory/:itemId/map',
        loadComponent: () => import('@pages/warehouse-inventory/warehouse-map/warehouse-map.component').then(m => m.WarehouseMapComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['warehouse.view', 'warehousepage.view'] } // Support both permission formats
      },
      {
        path: 'new-issue-request',
        loadComponent: () => import('@pages/new-issue-request/new-issue-request.component').then(m => m.NewIssueRequestComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.create'] }
      },
      {
        path: 'return-request',
        loadComponent: () => import('@pages/new-issue-request/components/return-request/return-request.component').then(m => m.ReturnRequestComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.create'] }
      },
      {
        path: 'discard-request',
        loadComponent: () => import('@pages/new-issue-request/components/discard-request/discard-request.component').then(m => m.DiscardRequestComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.create'] }
      },
      {
        path: 'requests-management',
        loadComponent: () => import('@pages/requests-management/requests-management.component').then(m => m.RequestsManagementComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.view', 'request.manage'] }
      },
      {
        path: 'forecast',
        loadComponent: () => import('@pages/forecast/forecast.component').then(m => m.ForecastComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['dashboard.view'] }
      },
      {
        path: 'add-asset',
        loadComponent: () => import('@pages/add-asset/add-asset.component').then(m => m.AddAssetComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.create'] }
      },
      {
        path: 'asset-list',
        loadComponent: () => import('@pages/asset-list/asset-list.component').then(m => m.AssetListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.view'] }
      },
      {
        path: 'search-inventory',
        loadComponent: () => import('@pages/search-inventory/search-inventory.component').then(m => m.SearchInventoryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventory.view'] }
      },
      {
        path: 'depot-management',
        loadComponent: () => import('@pages/depot-management/depot-management.component').then(m => m.DepotManagementComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['depot.view'] }
      },
      {
        path: 'manage-admins',
        loadComponent: () => import('@pages/manage-admins/manage-admins.component').then(m => m.ManageAdminsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['user.view'] }
      },
      {
        path: 'admin-roles',
        loadComponent: () => import('@pages/admin-roles/admin-roles.component').then(m => m.AdminRolesComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['role.view'] } // Match sidebar menu requirement
      },
      {
        path: 'role-permissions',
        loadComponent: () => import('@pages/role-permissions/role-permissions.component').then(m => m.RolePermissionsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['role.edit', 'role.view'] } // Accept both: sidebar requires role.edit, but role.view should also work
      },
      {
        path: 'notifications',
        loadComponent: () => import('@pages/notifications/notifications.component').then(m => m.NotificationsComponent)
      }
    ]
  },
  // Auth routes
  {
    path: 'auth',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'login',
        loadComponent: () => import('@pages/auth/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
