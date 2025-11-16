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
        loadComponent: () => import('@pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['dashboard_view'] }
      },
      {
        path: 'inventory-dashboard',
        loadComponent: () => import('@pages/inventory-dashboard/inventory-dashboard.component').then(m => m.InventoryDashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['dashboard_view'] }
      },
      {
        path: 'supply-request-management',
        loadComponent: () => import('@pages/supply-request-management/supply-request-management.component').then(m => m.SupplyRequestManagementComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.page', 'request.view', 'order.view'] }
      },
      {
        path: 'supply-request-management/:id',
        loadComponent: () => import('@pages/supply-request-management/supply-request-detail/supply-request-detail.component').then(m => m.SupplyRequestDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.view', 'order.view'] }
      },
      {
        path: 'warehouse',
        loadComponent: () => import('@pages/warehouse/warehouse.component').then(m => m.WarehouseComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['warehousepage.page', 'warehousepage.view'] }
      },
      {
        path: 'warehouse/ammunition-display',
        loadComponent: () => import('@pages/warehouse/ammunition-display/ammunition-display.component').then(m => m.AmmunitionDisplayComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['warehousepage.view', 'ammunition.view'] }
      },
      {
        path: 'allowance',
        loadComponent: () => import('@pages/allowance-list/allowance-list.component').then(m => m.AllowanceListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['allowanceitem.page', 'allowanceitem.view', 'order.create'] }
      },
      {
        path: 'allowance/add',
        loadComponent: () => import('@pages/allowance/allowance.component').then(m => m.AllowanceComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['allowanceitem.create', 'order.create'] }
      },
      {
        path: 'warehouse/:id/inventory/add',
        loadComponent: () => import('@pages/add-inventory/add-inventory.component').then(m => m.AddInventoryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventorypage.page', 'inventory.create'] }
      },
      {
        path: 'warehouse/:id/inventory',
        loadComponent: () => import('@pages/warehouse-inventory/warehouse-inventory.component').then(m => m.WarehouseInventoryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventorypage.page', 'inventory.view'] }
      },
      {
        path: 'warehouse/:warehouseId/inventory/:itemId',
        loadComponent: () => import('@pages/warehouse-inventory/inventory-item-detail/inventory-item-detail.component').then(m => m.InventoryItemDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventory.view'] }
      },
      {
        path: 'warehouse/:warehouseId/inventory/:itemId/map',
        loadComponent: () => import('@pages/warehouse-inventory/warehouse-map/warehouse-map.component').then(m => m.WarehouseMapComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventory.view'] }
      },
      {
        path: 'workflow',
        loadComponent: () => import('@pages/workflow/workflow.component').then(m => m.WorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflowtype.page', 'workflowtype.view'] }
      },
      {
        path: 'workflow/add',
        loadComponent: () => import('@pages/workflow/add-workflow/add-workflow.component').then(m => m.AddWorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflowtype.create'] }
      },
      {
        path: 'workflow/:id',
        loadComponent: () => import('@pages/workflow/workflow-detail/workflow-detail.component').then(m => m.WorkflowDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflowtype.view'] }
      },
      {
        path: 'workflow/:id/edit',
        loadComponent: () => import('@pages/workflow/add-workflow/add-workflow.component').then(m => m.AddWorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflowtype.edit'] }
      },
      {
        path: 'new-issue-request',
        loadComponent: () => import('@pages/new-issue-request/new-issue-request.component').then(m => m.NewIssueRequestComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['newrequest.page', 'newrequest.create', 'order.create'] }
      },
      {
        path: 'return-request',
        loadComponent: () => import('@pages/new-issue-request/components/return-request/return-request.component').then(m => m.ReturnRequestComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['returnrequest.page', 'returnrequest.create', 'order.create'] }
      },
      {
        path: 'discard-request',
        loadComponent: () => import('@pages/new-issue-request/components/discard-request/discard-request.component').then(m => m.DiscardRequestComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['discard.page', 'discard.create', 'order.create'] }
      },
      {
        path: 'requests-management',
        loadComponent: () => import('@pages/requests-management/requests-management.component').then(m => m.RequestsManagementComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
      },
      {
        path: 'forecast',
        loadComponent: () => import('@pages/forecast/forecast.component').then(m => m.ForecastComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['forecastpage.page', 'forecastpage.view', 'dashboard_view'] }
      },
      {
        path: 'add-asset',
        loadComponent: () => import('@pages/add-asset/add-asset.component').then(m => m.AddAssetComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['addnewassetpage.page', 'ammunition.create'] }
      },
      {
        path: 'asset-list',
        loadComponent: () => import('@pages/asset-list/asset-list.component').then(m => m.AssetListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ammunition.page'] }
      },
      {
        path: 'depot-management',
        loadComponent: () => import('@pages/depot-management/depot-management.component').then(m => m.DepotManagementComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['depots.page', 'depots.view'] }
      },
      {
        path: 'manage-admins',
        loadComponent: () => import('@pages/manage-admins/manage-admins.component').then(m => m.ManageAdminsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['systemusers.page', 'systemusers.view'] }
      },
      {
        path: 'admin-roles',
        loadComponent: () => import('@pages/admin-roles/admin-roles.component').then(m => m.AdminRolesComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['roles.page', 'roles.view'] }
      },
      {
        path: 'role-permissions',
        loadComponent: () => import('@pages/role-permissions/role-permissions.component').then(m => m.RolePermissionsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['roles.edit', 'roles.view'] }
      },
      {
        path: 'notifications',
        loadComponent: () => import('@pages/notifications/notifications.component').then(m => m.NotificationsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['notificationspage.page', 'notificationspage.view', 'dashboard_view'] }
      },
      {
        path: 'access-denied',
        loadComponent: () => import('@pages/access-denied/access-denied.component').then(m => m.AccessDeniedComponent)
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
