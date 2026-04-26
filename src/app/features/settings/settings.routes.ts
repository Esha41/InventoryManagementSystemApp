import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'ldap-settings',
    loadComponent: () => import('./pages/ldap/ldap-settings.component').then(m => m.LdapSettingsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.SETTINGS.LDAP.PAGE, PERMISSIONS.SETTINGS.LDAP.VIEW] }
  },
  {
    path: 'email-settings',
    loadComponent: () => import('./pages/email/email-settings.component').then(m => m.EmailSettingsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.SETTINGS.EMAIL.PAGE, PERMISSIONS.SETTINGS.EMAIL.VIEW] }
  },
  {
    path: 'stock-notification-settings',
    loadComponent: () => import('./pages/stock-notifications/stock-notification-settings.component').then(m => m.StockNotificationSettingsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.SETTINGS.STOCK_NOTIFICATIONS.PAGE] }
  },
  {
    path: 'order-auto-reject-settings',
    loadComponent: () => import('./pages/order-auto-reject/order-auto-reject-settings.component').then(m => m.OrderAutoRejectSettingsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.SETTINGS.ORDER_AUTO_REJECT.PAGE] }
  }
];
