import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

// These routes are loaded under `path: 'admin'` in app.routes.ts → all URLs are /admin/...
export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.DASHBOARD.PAGE, PERMISSIONS.ADMIN.DASHBOARD.VIEW] }
  },
  {
    path: 'analytics-dashboard',
    loadComponent: () => import('./pages/analytics/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.ANALYTICS.PAGE, PERMISSIONS.ADMIN.ANALYTICS.VIEW] }
  },
  {
    path: 'depot-management',
    loadComponent: () => import('./pages/depot-management/depot-management.component').then(m => m.DepotManagementComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.DEPOTS.PAGE] }
  },
  {
    path: 'manage-admins',
    loadComponent: () => import('./pages/manage-users/manage-admins.component').then(m => m.ManageAdminsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.SYSTEM_USERS.PAGE, PERMISSIONS.ADMIN.SYSTEM_USERS.VIEW] }
  },
  {
    path: 'lookup-tables',
    loadComponent: () => import('./pages/lookup-tables/lookup-tables.component').then(m => m.LookupTablesComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.LOOKUP_TABLES.PAGE] }
  },
  {
    path: 'roles',
    loadComponent: () => import('./pages/roles/admin-roles.component').then(m => m.AdminRolesComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.ROLES.PAGE, PERMISSIONS.ADMIN.ROLES.VIEW] }
  },
  {
    path: 'role-permissions',
    loadComponent: () => import('./pages/permissions/role-permissions.component').then(m => m.RolePermissionsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.ROLES.EDIT, PERMISSIONS.ADMIN.ROLES.VIEW] }
  },
  {
    path: 'import-export',
    loadComponent: () => import('./pages/import-export/admin-import-export.component').then(m => m.AdminImportExportComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.IMPORT_EXPORT.PAGE] }
  },
  {
    path: 'help-center',
    loadComponent: () => import('./pages/help-center-management/help-center-management.component').then(m => m.HelpCenterManagementComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.HELP_CENTER.PAGE, PERMISSIONS.ADMIN.HELP_CENTER.VIEW] }
  },
  {
    path: 'announcements',
    loadComponent: () => import('./pages/announcements/announcements.component').then(m => m.AnnouncementsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.ANNOUNCEMENTS.PAGE, PERMISSIONS.ADMIN.ANNOUNCEMENTS.VIEW] }
  },
  {
    path: 'announcements/create',
    loadComponent: () => import('./pages/announcements/announcement-form/announcement-form.component').then(m => m.AnnouncementFormComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.ANNOUNCEMENTS.CREATE] }
  },
  {
    path: 'announcements/edit/:id',
    loadComponent: () => import('./pages/announcements/announcement-form/announcement-form.component').then(m => m.AnnouncementFormComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.ANNOUNCEMENTS.EDIT] }
  }
];
