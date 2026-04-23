import { Routes } from '@angular/router';
import { MainLayoutComponent } from '@layouts/main-layout/main-layout.component';
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
        path: 'dashboard',
        loadComponent: () => import('@dashboard/pages/overview/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['dashboard_view'] }
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
      },
      {
        path: 'help',
        loadComponent: () =>
          import('@features/help/pages/help-center-user/help-center-user.component').then(m => m.HelpCenterUserComponent)
      },
      { path: 'help-me', redirectTo: 'help', pathMatch: 'full' },
      { path: 'admin/help-me', redirectTo: 'admin/help-center', pathMatch: 'full' },
      // ── FEATURE LAZY CHUNKS ───────────────────────────────────────────────
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
      // Scattered-URL features — path:'' preserves all existing URLs
      {
        path: '',
        loadChildren: () => import('./features/requests/requests.routes').then(m => m.REQUESTS_ROUTES)
      },
      {
        path: '',
        loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
      },
      {
        path: '',
        loadChildren: () => import('./features/assets/assets.routes').then(m => m.ASSETS_ROUTES)
      },
      {
        path: '',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES)
      },
      {
        path: '',
        loadChildren: () => import('./features/department/department.routes').then(m => m.DEPARTMENT_ROUTES)
      },
      {
        path: '',
        loadChildren: () => import('./features/reports/reports.routes').then(m => m.REPORTS_ROUTES)
      }
    ]
  },
  { path: '**', redirectTo: '/auth/login' }
];
