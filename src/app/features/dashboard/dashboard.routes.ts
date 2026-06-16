import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

// Loaded under `path: 'dashboard'` in app.routes.ts — `path: ''` maps to /dashboard.
export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/overview/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.DASHBOARD.VIEW] }
  }
];
