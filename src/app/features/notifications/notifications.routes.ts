import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: 'notifications',
    loadComponent: () => import('./pages/list/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.NOTIFICATIONS.PAGE.PAGE, PERMISSIONS.NOTIFICATIONS.PAGE.VIEW, PERMISSIONS.DASHBOARD.VIEW] }
  }
];
