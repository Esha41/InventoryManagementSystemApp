import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

// Children of `path: 'inventory-dashboard'` in app.routes.ts.
export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/overview/inventory-dashboard.component').then(m => m.InventoryDashboardComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.INVENTORY.DASHBOARD] }
  },
  {
    path: 'expiring-lots',
    loadComponent: () => import('./pages/expiring-lots/expiring-lots.component').then(m => m.ExpiringLotsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.INVENTORY.EXPIRING_LOTS_REPORT.PAGE] }
  },
  {
    path: 'low-stock',
    loadComponent: () => import('./pages/low-stock/low-stock.component').then(m => m.LowStockComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.INVENTORY.LOW_STOCK_REPORT.PAGE] }
  },
  {
    path: 'critical-stock',
    loadComponent: () => import('./pages/critical-stock/critical-stock.component').then(m => m.CriticalStockComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.INVENTORY.CRITICAL_STOCK_REPORT.PAGE] }
  },
  {
    path: 'draft-supplies',
    loadComponent: () => import('./pages/draft-supplies/draft-supplies.component').then(m => m.DraftSuppliesComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.INVENTORY.DASHBOARD] }
  },
  {
    path: 'orders-awaiting-fulfillment',
    loadComponent: () => import('./pages/orders-awaiting-fulfillment/orders-awaiting-fulfillment.component').then(m => m.OrdersAwaitingFulfillmentComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.INVENTORY.DASHBOARD] }
  }
];
