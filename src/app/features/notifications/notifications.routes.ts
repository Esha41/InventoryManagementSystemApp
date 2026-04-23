import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: 'notifications',
    loadComponent: () => import('./pages/list/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['notificationspage.page', 'notificationspage.view', 'dashboard_view'] }
  }
];
