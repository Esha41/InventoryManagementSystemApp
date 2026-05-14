import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

// These routes are loaded under `path: ''` in app.routes.ts, preserving existing URLs.
export const REQUESTS_ROUTES: Routes = [
  {
    path: 'supply-order',
    loadComponent: () => import('./pages/supply-order/supply-order-list.component').then(m => m.SupplyOrderListComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.SUPPLY.PAGE, PERMISSIONS.REQUESTS.SUPPLY.VIEW] }
  },
  {
    path: 'supply-order/:supplyId',
    loadComponent: () => import('./pages/supply-order/supply-order.component').then(m => m.SupplyOrderComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.SUPPLY.VIEW, PERMISSIONS.REQUESTS.SUPPLY.PAGE] }
  },
  {
    path: 'new-issue-request',
    loadComponent: () => import('./pages/new-issue/new-issue-request.component').then(m => m.NewIssueRequestComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.NEW_REQUEST.PAGE, PERMISSIONS.REQUESTS.NEW_REQUEST.CREATE, PERMISSIONS.REQUESTS.ORDER.CREATE] }
  },
  {
    path: 'return-request',
    loadComponent: () => import('./pages/return-request/return-request.component').then(m => m.ReturnRequestComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.RETURN_REQUEST.PAGE, PERMISSIONS.REQUESTS.RETURN_REQUEST.CREATE, PERMISSIONS.REQUESTS.ORDER.CREATE] }
  },
  // Discard request — not used by client for now (restore block to re-enable /requests/discard-request).
  // {
  //   path: 'discard-request',
  //   loadComponent: () => import('./pages/discard/discard-request.component').then(m => m.DiscardRequestComponent),
  //   canActivate: [permissionGuard],
  //   data: { permissions: [PERMISSIONS.REQUESTS.DISCARD.PAGE, PERMISSIONS.REQUESTS.DISCARD.CREATE, PERMISSIONS.REQUESTS.ORDER.CREATE] }
  // },
  {
    path: 'requests-management',
    loadComponent: () => import('./pages/management/requests-management.component').then(m => m.RequestsManagementComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.VIEW_REQUEST.PAGE, PERMISSIONS.REQUESTS.VIEW_REQUEST.VIEW, PERMISSIONS.REQUESTS.ORDER.VIEW] }
  },
  {
    path: 'requests-management/order-report',
    redirectTo: 'requests-management/requests-report',
    pathMatch: 'full'
  },
  {
    path: 'requests-management/requests-report',
    loadComponent: () => import('./pages/management/order-report/order-report.component').then(m => m.OrderReportComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.VIEW_REQUEST.PAGE, PERMISSIONS.REQUESTS.VIEW_REQUEST.VIEW, PERMISSIONS.REQUESTS.ORDER.VIEW] }
  },
  {
    path: 'requests-management/:id/workflow-approval',
    loadComponent: () => import('./pages/management/workflow-approval-detail/workflow-approval-detail.component').then(m => m.WorkflowApprovalDetailComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.VIEW_REQUEST.PAGE, PERMISSIONS.REQUESTS.VIEW_REQUEST.VIEW, PERMISSIONS.REQUESTS.ORDER.VIEW] }
  },
  {
    path: 'requests-management/:id/process-return-items',
    loadComponent: () => import('./pages/management/process-return-items/process-return-items.component').then(m => m.ProcessReturnItemsComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.PROCESS_RETURN_ITEMS] }
  },
  {
    path: 'requests-management/:id/supply-request-detail',
    loadComponent: () => import('./pages/management/supply-request-detail/supply-request-detail.component').then(m => m.SupplyRequestDetailComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.VIEW_REQUEST.PAGE, PERMISSIONS.REQUESTS.VIEW_REQUEST.VIEW, PERMISSIONS.REQUESTS.ORDER.VIEW] }
  },
  {
    path: 'requests-management/:id/weapon-supply-selection',
    loadComponent: () => import('./pages/management/weapon-supply-review/components/weapon-supply-selection/weapon-supply-selection.component').then(m => m.WeaponSupplySelectionComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.REVIEW_WEAPON_SUPPLY, PERMISSIONS.REQUESTS.VIEW_REQUEST.PAGE, PERMISSIONS.REQUESTS.VIEW_REQUEST.VIEW, PERMISSIONS.REQUESTS.ORDER.VIEW, PERMISSIONS.REQUESTS.ASSET_SUPPLY.VIEW] }
  },
  {
    path: 'requests-management/:id/weapon-supply-review',
    loadComponent: () => import('./pages/management/weapon-supply-review/weapon-supply-review.component').then(m => m.WeaponSupplyReviewComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REQUESTS.REVIEW_WEAPON_SUPPLY, PERMISSIONS.REQUESTS.VIEW_REQUEST.PAGE, PERMISSIONS.REQUESTS.VIEW_REQUEST.VIEW, PERMISSIONS.REQUESTS.ORDER.VIEW, PERMISSIONS.REQUESTS.ASSET_SUPPLY.VIEW] }
  }
];
