import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

// These routes are loaded under `path: 'admin'` in app.routes.ts → all URLs are /admin/...
export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['admindashboard.page', 'admindashboard.view'] }
  },
  {
    path: 'analytics-dashboard',
    loadComponent: () => import('./pages/analytics/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['analytics.page', 'analytics.view'] }
  },
  {
    path: 'depot-management',
    loadComponent: () => import('./pages/depot-management/depot-management.component').then(m => m.DepotManagementComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['depots.page'] }
  },
  {
    path: 'manage-admins',
    loadComponent: () => import('./pages/manage-users/manage-admins.component').then(m => m.ManageAdminsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['systemusers.page', 'systemusers.view'] }
  },
  {
    path: 'lookup-tables',
    loadComponent: () => import('./pages/lookup-tables/lookup-tables.component').then(m => m.LookupTablesComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['Permissions.LookupTables.Page'] }
  },
  {
    path: 'roles',
    loadComponent: () => import('./pages/roles/admin-roles.component').then(m => m.AdminRolesComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['roles.page', 'roles.view'] }
  },
  {
    path: 'role-permissions',
    loadComponent: () => import('./pages/permissions/role-permissions.component').then(m => m.RolePermissionsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['roles.edit', 'roles.view'] }
  },
  {
    path: 'import-export',
    loadComponent: () => import('./pages/import-export/admin-import-export.component').then(m => m.AdminImportExportComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['AdminImportExport'] }
  },
  {
    path: 'help-center',
    loadComponent: () => import('./pages/help-center-management/help-center-management.component').then(m => m.HelpCenterManagementComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['helpcenter.page', 'helpcenter.view'] }
  },
  {
    path: 'announcements',
    loadComponent: () => import('./pages/announcements/announcements.component').then(m => m.AnnouncementsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['announcements.page', 'announcements.view'] }
  },
  {
    path: 'announcements/create',
    loadComponent: () => import('./pages/announcements/announcement-form/announcement-form.component').then(m => m.AnnouncementFormComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['announcements.create'] }
  },
  {
    path: 'announcements/edit/:id',
    loadComponent: () => import('./pages/announcements/announcement-form/announcement-form.component').then(m => m.AnnouncementFormComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['announcements.edit'] }
  }
];
