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
    loadComponent: () => import('./pages/manage-users/manage-users.component').then(m => m.ManageUsersComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.ADMIN.SYSTEM_USERS.PAGE, PERMISSIONS.ADMIN.SYSTEM_USERS.VIEW] },
  },
  { path: 'lookup-tables', redirectTo: '/settings/lookup-tables', pathMatch: 'full' },
  { path: 'roles', redirectTo: '/settings/roles', pathMatch: 'full' },
  { path: 'role-permissions', redirectTo: '/settings/role-permissions', pathMatch: 'full' },
  { path: 'import-export', redirectTo: '/settings/import-export', pathMatch: 'full' },
  { path: 'help-center', redirectTo: '/settings/help-center', pathMatch: 'full' },
  { path: 'announcements/create', redirectTo: '/settings/announcements/create', pathMatch: 'full' },
  {
    path: 'announcements/edit/:id',
    redirectTo: (rd) => `/settings/announcements/edit/${rd.paramMap.get('id') ?? ''}`,
    pathMatch: 'full',
  },
  { path: 'announcements', redirectTo: '/settings/announcements', pathMatch: 'full' }
];
