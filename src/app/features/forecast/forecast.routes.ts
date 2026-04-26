import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

export const FORECAST_ROUTES: Routes = [
  {
    path: 'forecast',
    loadComponent: () => import('./pages/overview/forecast.component').then(m => m.ForecastComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.DASHBOARD.FORECAST.PAGE, PERMISSIONS.DASHBOARD.FORECAST.VIEW, PERMISSIONS.DASHBOARD.VIEW] }
  }
];
