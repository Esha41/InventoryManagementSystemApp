import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'ldap-settings',
    loadComponent: () => import('./pages/ldap/ldap-settings.component').then(m => m.LdapSettingsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ldapsettings.page', 'ldapsettings.view'] }
  },
  {
    path: 'email-settings',
    loadComponent: () => import('./pages/email/email-settings.component').then(m => m.EmailSettingsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['emailsettings.page', 'emailsettings.view'] }
  },
  {
    path: 'stock-notification-settings',
    loadComponent: () => import('./pages/stock-notifications/stock-notification-settings.component').then(m => m.StockNotificationSettingsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['stockNotificationSettingsPage'] }
  },
  {
    path: 'order-auto-reject-settings',
    loadComponent: () => import('./pages/order-auto-reject/order-auto-reject-settings.component').then(m => m.OrderAutoRejectSettingsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['orderAutoRejectSettings.page'] }
  }
];
