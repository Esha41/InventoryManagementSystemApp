import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

// These routes are loaded under `path: ''` in app.routes.ts, preserving existing URLs.
export const REQUESTS_ROUTES: Routes = [
  {
    path: 'supply-request-management',
    loadComponent: () => import('./pages/supply-management/supply-request-management.component').then(m => m.SupplyRequestManagementComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['request.page', 'request.view', 'order.view'] }
  },
  {
    path: 'supply-request-management/:id',
    loadComponent: () => import('./pages/supply-management/supply-request-detail/supply-request-detail.component').then(m => m.SupplyRequestDetailComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['request.view', 'order.view'] }
  },
  {
    path: 'supply-order',
    loadComponent: () => import('./pages/supply-order/supply-order-list.component').then(m => m.SupplyOrderListComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['supply.page', 'supply.view'] }
  },
  {
    path: 'supply-order/:supplyId',
    loadComponent: () => import('./pages/supply-order/supply-order.component').then(m => m.SupplyOrderComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['supply.view', 'supply.page'] }
  },
  {
    path: 'new-issue-request',
    loadComponent: () => import('./pages/new-issue/new-issue-request.component').then(m => m.NewIssueRequestComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['newrequest.page', 'newrequest.create', 'order.create'] }
  },
  {
    path: 'return-request',
    loadComponent: () => import('./pages/new-issue/components/return-request/return-request.component').then(m => m.ReturnRequestComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['returnrequest.page', 'returnrequest.create', 'order.create'] }
  },
  {
    path: 'discard-request',
    loadComponent: () => import('./pages/discard/discard-request.component').then(m => m.DiscardRequestComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['discard.page', 'discard.create', 'order.create'] }
  },
  {
    path: 'requests-management',
    loadComponent: () => import('./pages/management/requests-management.component').then(m => m.RequestsManagementComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
  },
  {
    path: 'requests-management/order-report',
    loadComponent: () => import('./pages/management/order-report/order-report.component').then(m => m.OrderReportComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
  },
  {
    path: 'requests-management/:id/workflow-approval',
    loadComponent: () => import('./pages/management/workflow-approval-detail/workflow-approval-detail.component').then(m => m.WorkflowApprovalDetailComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
  },
  {
    path: 'requests-management/:id/process-return-items',
    loadComponent: () => import('./pages/management/process-return-items/process-return-items.component').then(m => m.ProcessReturnItemsComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ProcessReturnItems'] }
  },
  {
    path: 'requests-management/:id/supply-request-detail',
    loadComponent: () => import('./pages/management/supply-request-detail/supply-request-detail.component').then(m => m.SupplyRequestDetailComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['viewrequest.page', 'viewrequest.view', 'order.view'] }
  },
  {
    path: 'requests-management/:id/weapon-supply-selection',
    loadComponent: () => import('./pages/management/weapon-supply-review/components/weapon-supply-selection/weapon-supply-selection.component').then(m => m.WeaponSupplySelectionComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ReviewWeaponSupply', 'viewrequest.page', 'viewrequest.view', 'order.view', 'Permissions.AssetSupply.View'] }
  },
  {
    path: 'requests-management/:id/weapon-supply-review',
    loadComponent: () => import('./pages/management/weapon-supply-review/weapon-supply-review.component').then(m => m.WeaponSupplyReviewComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ReviewWeaponSupply', 'viewrequest.page', 'viewrequest.view', 'order.view', 'Permissions.AssetSupply.View'] }
  }
];
