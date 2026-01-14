import { Routes } from '@angular/router';
import { MainLayoutComponent } from '@layouts/main-layout/main-layout.component';
import { AuthLayoutComponent } from '@layouts/auth-layout/auth-layout.component';
import { authGuard, permissionGuard } from '@guards/index';

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'login',
        loadComponent: () => import('@pages/auth/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('@pages/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('@pages/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },
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
        data: { permissions: ['InventoryDashboard'] }
      },
      {
        path: 'admin-dashboard',
        loadComponent: () => import('@pages/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['admindashboard.page', 'admindashboard.view'] }
      },
      {
        path: 'analytics-dashboard',
        loadComponent: () => import('@pages/analytics-dashboard/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['analytics.page', 'analytics.view'] }
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
        path: 'supply-order',
        loadComponent: () => import('@pages/supply-order/supply-order-list.component').then(m => m.SupplyOrderListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['supply.page', 'supply.view'] }
      },
      {
        path: 'supply-order/:supplyId',
        loadComponent: () => import('@pages/supply-order/supply-order.component').then(m => m.SupplyOrderComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['supply.view', 'supply.page'] }
      },
      {
        path: 'warehouse',
        loadComponent: () => import('@pages/warehouse/warehouse.component').then(m => m.WarehouseComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['warehousepage.page', 'warehousepage.view'] }
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
        path: 'warehouse/:id/assets/add',
        loadComponent: () => import('@pages/add-weapon-asset/add-weapon-asset.component').then(m => m.AddWeaponAssetComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.page', 'asset.create'] }
      },
      {
        path: 'warehouse/:id/assets/add/bulk-entry',
        loadComponent: () => import('@pages/add-weapon-asset/bulk-entry/bulk-entry.component').then(m => m.BulkEntryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.page', 'asset.create'] }
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
        path: 'warehouse/:warehouseId/assets/:id',
        loadComponent: () => import('@pages/asset-details/asset-details.component').then(m => m.AssetDetailsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.view'] }
      },
      {
        path: 'warehouse/:warehouseId/assets/:id/edit',
        loadComponent: () => import('./pages/edit-asset/edit-asset.component').then(m => m.EditAssetComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.edit'] }
      },
      {
        path: 'workflow',
        loadComponent: () => import('@pages/workflow/workflow.component').then(m => m.WorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflow.page', 'workflow.view'] }
      },
      {
        path: 'workflow/add',
        loadComponent: () => import('@pages/workflow/add-workflow/add-workflow.component').then(m => m.AddWorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflow.create'] }
      },
      {
        path: 'workflow/:id',
        loadComponent: () => import('@pages/workflow/workflow-detail/workflow-detail.component').then(m => m.WorkflowDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflow.view', 'workflow.page'] }
      },
      {
        path: 'workflow/:id/edit',
        loadComponent: () => import('@pages/workflow/edit-workflow/edit-workflow.component').then(m => m.EditWorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflow.edit'] }
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
        path: 'requests-management/:id/workflow-approval',
        loadComponent: () => import('@pages/requests-management/workflow-approval-detail/workflow-approval-detail.component').then(m => m.WorkflowApprovalDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
      },
      {
        path: 'requests-management/:id/supply-request-detail',
        loadComponent: () => import('@pages/requests-management/supply-request-detail/supply-request-detail.component').then(m => m.SupplyRequestDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
      },
      {
        path: 'requests-management/:id/weapon-supply-review',
        loadComponent: () => import('@pages/requests-management/weapon-supply-review/weapon-supply-review.component').then(m => m.WeaponSupplyReviewComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ReviewWeaponSupply', 'viewrequest.page', 'viewrequest.view', 'order.view', 'Permissions.AssetSupply.View'] }
      },
      {
        path: 'requests-management/order-report',
        loadComponent: () => import('@pages/requests-management/order-report/order-report.component').then(m => m.OrderReportComponent),
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
        path: 'inventory-forecast',
        loadComponent: () => import('@pages/inventory-forecast/inventory-forecast.component').then(m => m.InventoryForecastComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventorypage.page', 'inventorypage.view'] }
      },
      {
        path: 'inventory-summary',
        loadComponent: () => import('@pages/inventory-summary/inventory-summary.component').then(m => m.InventorySummaryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventorypage.page', 'inventorypage.view'] }
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
        path: 'item-detail/:id',
        loadComponent: () => import('@pages/item-detail/item-detail.component').then(m => m.ItemDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ammunition.view', 'weapon.view', 'explosive.view'] }
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
        path: 'ldap-settings',
        loadComponent: () => import('./pages/ldap-settings/ldap-settings.component').then(m => m.LdapSettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ldapsettings.page', 'ldapsettings.view'] }
      },
      {
        path: 'email-settings',
        loadComponent: () => import('@pages/email-settings/email-settings.component').then(m => m.EmailSettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['emailsettings.page', 'emailsettings.view'] }
      },
      {
        path: 'admin-import-export',
        loadComponent: () => import('@pages/admin-import-export/admin-import-export.component').then(m => m.AdminImportExportComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['AdminImportExport'] }
      },
      {
        path: 'stock-notification-settings',
        loadComponent: () => import('@pages/stock-notification-settings/stock-notification-settings.component').then(m => m.StockNotificationSettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventory.edit', 'inventory.view'] }
      },
      {
        path: 'notifications',
        loadComponent: () => import('@pages/notifications/notifications.component').then(m => m.NotificationsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['notificationspage.page', 'notificationspage.view', 'dashboard_view'] }
      },
      {
        path: 'profile',
        loadComponent: () => import('@pages/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'access-denied',
        loadComponent: () => import('@pages/access-denied/access-denied.component').then(m => m.AccessDeniedComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/auth/login'
  }
];
