import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./settings-layout.component').then(m => m.SettingsLayoutComponent),
    children: [
      {
        path: 'ldap-settings',
        loadComponent: () => import('./pages/ldap/ldap-settings.component').then(m => m.LdapSettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.SETTINGS.LDAP.PAGE, PERMISSIONS.SETTINGS.LDAP.VIEW] },
      },
      {
        path: 'email-settings',
        loadComponent: () => import('./pages/email/email-settings.component').then(m => m.EmailSettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.SETTINGS.EMAIL.PAGE, PERMISSIONS.SETTINGS.EMAIL.VIEW] },
      },
      {
        path: 'stock-notification-settings',
        loadComponent: () =>
          import('./pages/stock-notifications/stock-notification-settings.component').then(
            m => m.StockNotificationSettingsComponent
          ),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.SETTINGS.STOCK_NOTIFICATIONS.PAGE] },
      },
      {
        path: 'order-auto-reject-settings',
        loadComponent: () =>
          import('./pages/order-auto-reject/order-auto-reject-settings.component').then(
            m => m.OrderAutoRejectSettingsComponent
          ),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.SETTINGS.ORDER_AUTO_REJECT.PAGE] },
      },
      {
        path: 'requester-qty-notifications',
        loadComponent: () =>
          import('../workflow/pages/requester-qty-notification/requester-qty-notification.component').then(
            m => m.RequesterQtyNotificationComponent
          ),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.SETTINGS.REQUESTER_QTY_NOTIFICATIONS.PAGE] },
      },
      {
        path: 'manage-admins',
        redirectTo: '/admin/manage-admins',
        pathMatch: 'full',
      },
      {
        path: 'lookup-tables',
        loadComponent: () =>
          import('../admin/pages/lookup-tables/lookup-tables.component').then(m => m.LookupTablesComponent),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.ADMIN.LOOKUP_TABLES.PAGE] },
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('../admin/pages/roles/admin-roles.component').then(m => m.AdminRolesComponent),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.ADMIN.ROLES.PAGE, PERMISSIONS.ADMIN.ROLES.VIEW] },
      },
      {
        path: 'role-permissions',
        loadComponent: () =>
          import('../admin/pages/permissions/role-permissions.component').then(m => m.RolePermissionsComponent),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.ADMIN.ROLES.EDIT, PERMISSIONS.ADMIN.ROLES.VIEW] },
      },
      {
        path: 'workflow',
        loadComponent: () =>
          import('../workflow/pages/overview/workflow.component').then(m => m.WorkflowComponent),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.WORKFLOW.PAGE, PERMISSIONS.WORKFLOW.VIEW] },
      },
      {
        path: 'import-export',
        loadComponent: () =>
          import('../admin/pages/import-export/admin-import-export.component').then(
            m => m.AdminImportExportComponent
          ),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.ADMIN.IMPORT_EXPORT.PAGE] },
      },
      {
        path: 'help-center',
        loadComponent: () =>
          import('../admin/pages/help-center-management/help-center-management.component').then(
            m => m.HelpCenterManagementComponent
          ),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.ADMIN.HELP_CENTER.PAGE, PERMISSIONS.ADMIN.HELP_CENTER.VIEW] },
      },
      {
        path: 'announcements/create',
        loadComponent: () =>
          import('../admin/pages/announcements/announcement-form/announcement-form.component').then(
            m => m.AnnouncementFormComponent
          ),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.ADMIN.ANNOUNCEMENTS.CREATE] },
      },
      {
        path: 'announcements/edit/:id',
        loadComponent: () =>
          import('../admin/pages/announcements/announcement-form/announcement-form.component').then(
            m => m.AnnouncementFormComponent
          ),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.ADMIN.ANNOUNCEMENTS.EDIT] },
      },
      {
        path: 'announcements',
        loadComponent: () =>
          import('../admin/pages/announcements/announcements.component').then(m => m.AnnouncementsComponent),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.ADMIN.ANNOUNCEMENTS.PAGE, PERMISSIONS.ADMIN.ANNOUNCEMENTS.VIEW] },
      },
    ],
  },
];
