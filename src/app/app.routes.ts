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
        pathMatch: 'full',
        loadComponent: () =>
          import('@core/components/default-landing/default-landing.component').then(m => m.DefaultLandingComponent)
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
        // Warehouse (depot) list: Permissions.WarehousePage.Page / .View only — not Inventory.* (different module).
        data: { permissions: ['warehousepage.page', 'warehousepage.view'] }
      },
      {
        path: 'allowance',
        loadComponent: () => import('@department/pages/list/allowance-list.component').then(m => m.AllowanceListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['allowanceitem.page', 'allowanceitem.view', 'order.create'] }
      },
      {
        path: 'allowance/add',
        loadComponent: () => import('@department/pages/overview/allowance.component').then(m => m.AllowanceComponent),
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
        data: { permissions: ['WarehouseMapView'] }
      },
      {
        path: 'warehouse/:warehouseId/assets/:id',
        loadComponent: () => import('@assets/pages/details/asset-details.component').then(m => m.AssetDetailsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.view'] }
      },
      {
        path: 'warehouse/:warehouseId/assets/:id/map',
        loadComponent: () => import('@warehouse/pages/map/warehouse-map/warehouse-map.component').then(m => m.WarehouseMapComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['WarehouseMapView'] }
      },
      {
        path: 'warehouse/:warehouseId/assets/:id/edit',
        loadComponent: () => import('@assets/pages/edit/edit-asset.component').then(m => m.EditAssetComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.edit'] }
      },
      {
        path: 'warehouse/:id/batches/:batchId/edit',
        loadComponent: () => import('@warehouse/pages/inventory/edit-batch/edit-batch.component').then(m => m.EditBatchComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.page', 'asset.edit'] }
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
        loadComponent: () => import('@requests/pages/discard/discard-request.component').then(m => m.DiscardRequestComponent),
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
        path: 'requests-management/:id/process-return-items',
        loadComponent: () => import('@requests/pages/management/process-return-items/process-return-items.component').then(m => m.ProcessReturnItemsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ProcessReturnItems'] }
      },
      {
        path: 'requests-management/:id/supply-request-detail',
        loadComponent: () => import('@requests/pages/management/supply-request-detail/supply-request-detail.component').then(m => m.SupplyRequestDetailComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
      },
      {
        path: 'requests-management/:id/weapon-supply-selection',
        loadComponent: () => import('@requests/pages/management/weapon-supply-review/components/weapon-supply-selection/weapon-supply-selection.component').then(m => m.WeaponSupplySelectionComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ReviewWeaponSupply', 'viewrequest.page', 'viewrequest.view', 'order.view', 'Permissions.AssetSupply.View'] }
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
        path: 'weapon-asset-master',
        loadComponent: () =>
          import('./features/assets/pages/weapon-asset-master/weapon-asset-master.component').then(
            m => m.WeaponAssetMasterComponent
          ),
        canActivate: [permissionGuard],
        data: { permissions: ['asset.page', 'asset.view'] }
      },
      {
        path: 'asset-list/:id',
        loadComponent: () => import('@shared/components/asset-details/asset-details.component').then(m => m.AssetDetailsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ammunition.view', 'weapon.view', 'explosive.view'] }
      },
      {
        path: 'depot-management',
        loadComponent: () => import('@admin/pages/depot-management/depot-management.component').then(m => m.DepotManagementComponent),
        canActivate: [permissionGuard],
        // Depots: .page = access this admin screen; .view / .viewAll = read via API (see backend DepotService / DepotAccessService).
        data: { permissions: ['depots.page'] }
      },
      {
        path: 'manage-admins',
        loadComponent: () => import('@admin/pages/manage-users/manage-admins.component').then(m => m.ManageAdminsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['systemusers.page', 'systemusers.view'] }
      },
      {
        path: 'lookup-tables',
        loadComponent: () => import('@admin/pages/lookup-tables/lookup-tables.component').then(m => m.LookupTablesComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['Permissions.LookupTables.Page'] }
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
        path: 'item-department-assignment',
        loadComponent: () => import('@department/pages/item-department-assignment/item-department-assignment.component').then(m => m.ItemDepartmentAssignmentComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['Permissions.ItemDepartmentAssignment.Page'] }
      },
      {
        path: 'stock-notification-settings',
        loadComponent: () => import('@settings/pages/stock-notifications/stock-notification-settings.component').then(m => m.StockNotificationSettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['stockNotificationSettingsPage'] }
      },
      {
        path: 'admin/announcements',
        loadComponent: () => import('@admin/pages/announcements/announcements.component').then(m => m.AnnouncementsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['announcements.page', 'announcements.view'] }
      },
      {
        path: 'admin/announcements/create',
        loadComponent: () => import('@admin/pages/announcements/announcement-form/announcement-form.component').then(m => m.AnnouncementFormComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['announcements.create'] }
      },
      {
        path: 'admin/announcements/edit/:id',
        loadComponent: () => import('@admin/pages/announcements/announcement-form/announcement-form.component').then(m => m.AnnouncementFormComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['announcements.edit'] }
      },

      {
        path: 'report-designer',
        loadComponent: () => import('@app/features/reports/designer-list/report-designer.component').then(m => m.ReportDesignerComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ReportDesigner'] }
      },
      {
        path: 'report-designer/designer',
        loadComponent: () => import('@app/features/reports/designer/devexpress-designer.component').then(m => m.DevExpressReportDesignerComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ReportDesigner'] }
      },
      {
        path: 'report-dashboard',
        loadComponent: () => import('@app/features/reports/dashboard/report-dashboard.component').then(m => m.ReportDashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ReportDashboard'] }
      },
      {
        path: 'scheduled-reports',
        loadComponent: () => import('@app/features/reports/scheduled-reports/scheduled-reports-list.component').then(m => m.ScheduledReportsListComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ScheduledReports'] }
      },
      {
        path: 'scheduled-reports/create',
        loadComponent: () => import('@app/features/reports/scheduled-reports/scheduled-report-form/scheduled-report-form.component').then(m => m.ScheduledReportFormComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ScheduledReports'] }
      },
      {
        path: 'scheduled-reports/:id/edit',
        loadComponent: () => import('@app/features/reports/scheduled-reports/scheduled-report-form/scheduled-report-form.component').then(m => m.ScheduledReportFormComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['ScheduledReports'] }
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
