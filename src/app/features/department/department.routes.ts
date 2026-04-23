import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

export const DEPARTMENT_ROUTES: Routes = [
  {
    path: 'allowance',
    loadComponent: () => import('./pages/list/allowance-list.component').then(m => m.AllowanceListComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['allowanceitem.page', 'allowanceitem.view', 'order.create'] }
  },
  {
    path: 'allowance/add',
    loadComponent: () => import('./pages/overview/allowance.component').then(m => m.AllowanceComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['allowanceitem.create', 'order.create'] }
  },
  {
    path: 'item-department-assignment',
    loadComponent: () => import('./pages/item-department-assignment/item-department-assignment.component').then(m => m.ItemDepartmentAssignmentComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['Permissions.ItemDepartmentAssignment.Page'] }
  }
];
