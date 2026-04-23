import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/overview/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['dashboard_view'] }
  }
];
