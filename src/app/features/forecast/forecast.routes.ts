import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

export const FORECAST_ROUTES: Routes = [
  {
    path: 'forecast',
    loadComponent: () => import('./pages/overview/forecast.component').then(m => m.ForecastComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['forecastpage.page', 'forecastpage.view', 'dashboard_view'] }
  }
];
