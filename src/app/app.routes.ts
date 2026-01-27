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
        loadComponent: () => import('@auth/pages/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('@auth/pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('@auth/pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
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
        loadComponent: () => import('@dashboard/pages/overview/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['dashboard_view'] }
      },
      {
        path: 'inventory-dashboard',
        loadComponent: () => import('@inventory/pages/overview/inventory-dashboard.component').then(m => m.InventoryDashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['InventoryDashboard'] }
      },
      {
        path: 'inventory-dashboard/expiring-lots',
        loadComponent: () => import('@inventory/pages/expiring-lots/expiring-lots.component').then(m => m.ExpiringLotsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['expiringLotsReportPage'] }
      },
      {
        path: 'inventory-dashboard/low-stock',
        loadComponent: () => import('@inventory/pages/low-stock/low-stock.component').then(m => m.LowStockComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['lowStockReportPage'] }
      },
      {
        path: 'admin-dashboard',
        loadComponent: () => import('@admin/pages/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['admindashboard.page', 'admindashboard.view'] }
      },
      {
        path: 'analytics-dashboard',
        loadComponent: () => import('@admin/pages/analytics/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['analytics.page', 'analytics.view'] }
      },
      {
        path: 'supply-request-management',
        loadComponent: () => import('@requests/pages/supply-management/supply-request-management.component').then(m => m.SupplyRequestManagementComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.page', 'request.view', 'order.view'] }
      },
      {
        path: 'supply-request-management/:id',
        loadComponent: () => import('@requests/pages/supply-management/supply-request-detail/supply-request-detail.component').then(m => m.SupplyRequestDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['request.view', 'order.view'] }
      },
      {
        path: 'supply-order',
        loadComponent: () => import('@requests/pages/supply-order/supply-order-list.component').then(m => m.SupplyOrderListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['supply.page', 'supply.view'] }
      },
      {
        path: 'supply-order/:supplyId',
        loadComponent: () => import('@requests/pages/supply-order/supply-order.component').then(m => m.SupplyOrderComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['supply.view', 'supply.page'] }
      },
      {
        path: 'warehouse',
        loadComponent: () => import('@warehouse/pages/list/warehouse-list.component').then(m => m.WarehouseListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['warehousepage.page', 'warehousepage.view'] }
      },
      {
        path: 'allowance',
        loadComponent: () => import('@allowance/pages/list/allowance-list.component').then(m => m.AllowanceListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['allowanceitem.page', 'allowanceitem.view', 'order.create'] }
      },
      {
        path: 'allowance/add',
        loadComponent: () => import('@allowance/pages/overview/allowance.component').then(m => m.AllowanceComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['allowanceitem.create', 'order.create'] }
      },
      {
        path: 'warehouse/:id/inventory/add',
        loadComponent: () => import('@warehouse/pages/inventory/add-inventory/add-inventory.component').then(m => m.AddInventoryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventorypage.page', 'inventory.create'] }
      },
      {
        path: 'warehouse/:id/assets/add',
        loadComponent: () => import('@warehouse/pages/inventory/add-weapon/add-weapon-asset.component').then(m => m.AddWeaponAssetComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.page', 'asset.create'] }
      },
      {
        path: 'warehouse/:id/assets/add/bulk-entry',
        loadComponent: () => import('@warehouse/pages/inventory/add-weapon/bulk-entry/bulk-entry.component').then(m => m.BulkEntryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.page', 'asset.create'] }
      },
      {
        path: 'warehouse/:id/inventory',
        loadComponent: () => import('@warehouse/pages/inventory/warehouse-inventory.component').then(m => m.WarehouseInventoryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventorypage.page', 'inventory.view'] }
      },
      {
        path: 'warehouse/:warehouseId/inventory/:itemId',
        loadComponent: () => import('@warehouse/pages/inventory/inventory-item-detail/inventory-item-detail.component').then(m => m.InventoryItemDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventory.view'] }
      },
      {
        path: 'warehouse/:warehouseId/inventory/:itemId/map',
        loadComponent: () => import('@warehouse/pages/map/warehouse-map/warehouse-map.component').then(m => m.WarehouseMapComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventory.view'] }
      },
      {
        path: 'warehouse/:warehouseId/assets/:id',
        loadComponent: () => import('@assets/pages/details/asset-details.component').then(m => m.AssetDetailsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.view'] }
      },
      {
        path: 'warehouse/:warehouseId/assets/:id/edit',
        loadComponent: () => import('@assets/pages/edit/edit-asset.component').then(m => m.EditAssetComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.edit'] }
      },
      {
        path: 'workflow',
        loadComponent: () => import('@workflow/pages/overview/workflow.component').then(m => m.WorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflow.page', 'workflow.view'] }
      },
      {
        path: 'workflow/add',
        loadComponent: () => import('@workflow/pages/overview/add-workflow/add-workflow.component').then(m => m.AddWorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflow.create'] }
      },
      {
        path: 'workflow/:id',
        loadComponent: () => import('@workflow/pages/overview/workflow-detail/workflow-detail.component').then(m => m.WorkflowDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflow.view', 'workflow.page'] }
      },
      {
        path: 'workflow/:id/edit',
        loadComponent: () => import('@workflow/pages/overview/edit-workflow/edit-workflow.component').then(m => m.EditWorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['workflow.edit'] }
      },
      {
        path: 'new-issue-request',
        loadComponent: () => import('@requests/pages/new-issue/new-issue-request.component').then(m => m.NewIssueRequestComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['newrequest.page', 'newrequest.create', 'order.create'] }
      },
      {
        path: 'return-request',
        loadComponent: () => import('@requests/pages/new-issue/components/return-request/return-request.component').then(m => m.ReturnRequestComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['returnrequest.page', 'returnrequest.create', 'order.create'] }
      },
      {
        path: 'discard-request',
        loadComponent: () => import('@requests/pages/new-issue/components/discard-request/discard-request.component').then(m => m.DiscardRequestComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['discard.page', 'discard.create', 'order.create'] }
      },
      {
        path: 'requests-management',
        loadComponent: () => import('@requests/pages/management/requests-management.component').then(m => m.RequestsManagementComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
      },
      {
        path: 'requests-management/:id/workflow-approval',
        loadComponent: () => import('@requests/pages/management/workflow-approval-detail/workflow-approval-detail.component').then(m => m.WorkflowApprovalDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
      },
      {
        path: 'requests-management/:id/supply-request-detail',
        loadComponent: () => import('@requests/pages/management/supply-request-detail/supply-request-detail.component').then(m => m.SupplyRequestDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
      },
      {
        path: 'requests-management/:id/weapon-supply-review',
        loadComponent: () => import('@requests/pages/management/weapon-supply-review/weapon-supply-review.component').then(m => m.WeaponSupplyReviewComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ReviewWeaponSupply', 'viewrequest.page', 'viewrequest.view', 'order.view', 'Permissions.AssetSupply.View'] }
      },
      {
        path: 'requests-management/order-report',
        loadComponent: () => import('@requests/pages/management/order-report/order-report.component').then(m => m.OrderReportComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
      },
      {
        path: 'forecast',
        loadComponent: () => import('@forecast/pages/overview/forecast.component').then(m => m.ForecastComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['forecastpage.page', 'forecastpage.view', 'dashboard_view'] }
      },
      {
        path: 'inventory-summary',
        loadComponent: () => import('@warehouse/pages/summary/inventory-summary.component').then(m => m.InventorySummaryComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventorySummaryReportPage'] }
      },
      {
        path: 'add-asset',
        loadComponent: () => import('@assets/pages/add/add-asset.component').then(m => m.AddAssetComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['addnewassetpage.page', 'ammunition.create'] }
      },
      {
        path: 'asset-list',
        loadComponent: () => import('@assets/pages/list/asset-list.component').then(m => m.AssetListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ammunition.page'] }
      },
      {
        path: 'asset-list/:id',
        loadComponent: () => import('@shared/components/item-details/item-details.component').then(m => m.ItemDetailsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ammunition.view', 'weapon.view', 'explosive.view'] }
      },
      {
        path: 'item-detail/:id',
        loadComponent: () => import('@inventory/pages/detail/item-detail.component').then(m => m.ItemDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ammunition.view', 'weapon.view', 'explosive.view'] }
      },
      {
        path: 'depot-management',
        loadComponent: () => import('@admin/pages/depot-management/depot-management.component').then(m => m.DepotManagementComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['depots.page', 'depots.view'] }
      },
      {
        path: 'manage-admins',
        loadComponent: () => import('@admin/pages/manage-users/manage-admins.component').then(m => m.ManageAdminsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['systemusers.page', 'systemusers.view'] }
      },
      {
        path: 'admin-roles',
        loadComponent: () => import('@admin/pages/roles/admin-roles.component').then(m => m.AdminRolesComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['roles.page', 'roles.view'] }
      },
      {
        path: 'role-permissions',
        loadComponent: () => import('@admin/pages/permissions/role-permissions.component').then(m => m.RolePermissionsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['roles.edit', 'roles.view'] }
      },
      {
        path: 'ldap-settings',
        loadComponent: () => import('@settings/pages/ldap/ldap-settings.component').then(m => m.LdapSettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ldapsettings.page', 'ldapsettings.view'] }
      },
      {
        path: 'email-settings',
        loadComponent: () => import('@settings/pages/email/email-settings.component').then(m => m.EmailSettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['emailsettings.page', 'emailsettings.view'] }
      },
      {
        path: 'admin-import-export',
        loadComponent: () => import('@admin/pages/import-export/admin-import-export.component').then(m => m.AdminImportExportComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['AdminImportExport'] }
      },
      {
        path: 'stock-notification-settings',
        loadComponent: () => import('@settings/pages/stock-notifications/stock-notification-settings.component').then(m => m.StockNotificationSettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['inventory.edit', 'inventory.view'] }
      },
      {
        path: 'report-designer',
        loadComponent: () => import('@app/features/reports/designer-list/report-designer.component').then(m => m.ReportDesignerComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['Permissions.Report.View', 'Permissions.Report.Page'] }
      },
      {
        path: 'report-designer/designer',
        loadComponent: () => import('@app/features/reports/designer/devexpress-designer.component').then(m => m.DevExpressReportDesignerComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['Permissions.Report.Create', 'Permissions.Report.Edit'] }
      },
      {
        path: 'report-dashboard',
        loadComponent: () => import('@app/features/reports/dashboard/report-dashboard.component').then(m => m.ReportDashboardComponent)
      },
      {
        path: 'report-viewer',
        loadComponent: () => import('@app/features/reports/viewer/report-viewer.component').then(m => m.ReportViewerComponent)
      },
      {
        path: 'notifications',
        loadComponent: () => import('@notifications/pages/list/notifications.component').then(m => m.NotificationsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['notificationspage.page', 'notificationspage.view', 'dashboard_view'] }
      },
      {
        path: 'profile',
        loadComponent: () => import('@profile/pages/overview/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'access-denied',
        loadComponent: () => import('@auth/pages/access-denied/access-denied.component').then(m => m.AccessDeniedComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/auth/login'
  }
];
