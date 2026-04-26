import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { MainLayoutComponent } from '@shell/layouts/main-layout/main-layout.component';
import { AuthLayoutComponent } from '@layouts/auth-layout/auth-layout.component';
import { authGuard, permissionGuard } from '@guards/index';
export const routes: Routes = [
  // ── AUTH (lazy chunk) ─────────────────────────────────────────────────────
  {
    path: 'auth',
    component: AuthLayoutComponent,
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  // ── MAIN APP ──────────────────────────────────────────────────────────────
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
        path: 'inventory-summary',
        loadComponent: () => import('@warehouse/pages/summary/warehouse-inventory-summary.component').then(m => m.WarehouseInventorySummaryComponent),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.INVENTORY.SUMMARY_REPORT.PAGE] }
      },
      {
        path: 'access-denied',
        loadComponent: () => import('@auth/pages/access-denied/access-denied.component').then(m => m.AccessDeniedComponent)
      },
      { path: 'admin/help-me', redirectTo: 'admin/help-center', pathMatch: 'full' },
      // ── FEATURE LAZY CHUNKS ───────────────────────────────────────────────
      {
        path: '',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
      },
      {
        path: '',
        loadChildren: () => import('./features/forecast/forecast.routes').then(m => m.FORECAST_ROUTES)
      },
      {
        path: '',
        loadChildren: () => import('./features/notifications/notifications.routes').then(m => m.NOTIFICATIONS_ROUTES)
      },
      {
        path: '',
        loadChildren: () => import('./features/profile/profile.routes').then(m => m.PROFILE_ROUTES)
      },
      {
        path: '',
        loadChildren: () => import('./features/help/help.routes').then(m => m.HELP_ROUTES)
      },
      {
        path: 'warehouse',
        loadChildren: () => import('./features/warehouse/warehouse.routes').then(m => m.WAREHOUSE_ROUTES)
      },
      {
        path: 'inventory-dashboard',
        loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.INVENTORY_ROUTES)
      },
      {
        path: 'workflow',
        loadChildren: () => import('./features/workflow/workflow.routes').then(m => m.WORKFLOW_ROUTES)
      },
      // ── PREFIXED FEATURE ROUTES ───────────────────────────────────────────
      // Each feature owns its own URL namespace — no more path:'' collisions.
      {
        path: 'requests',
        loadChildren: () => import('./features/requests/requests.routes').then(m => m.REQUESTS_ROUTES)
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
      },
      {
        path: 'assets',
        loadChildren: () => import('./features/assets/assets.routes').then(m => m.ASSETS_ROUTES)
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES)
      },
      {
        path: 'department',
        loadChildren: () => import('./features/department/department.routes').then(m => m.DEPARTMENT_ROUTES)
      },
      {
        path: 'reports',
        loadChildren: () => import('./features/reports/reports.routes').then(m => m.REPORTS_ROUTES)
      }
    ]
  },
  // Unknown URLs → app root; authGuard on MainLayout then restores session or sends to login.
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
