import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

export const DEPARTMENT_ROUTES: Routes = [
  {
    path: 'allowance',
    loadComponent: () => import('./pages/list/allowance-list.component').then(m => m.AllowanceListComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.DEPARTMENT.ALLOWANCE_ITEM.PAGE, PERMISSIONS.DEPARTMENT.ALLOWANCE_ITEM.VIEW, PERMISSIONS.REQUESTS.ORDER.CREATE] }
  },
  {
    path: 'allowance/add',
    loadComponent: () => import('./pages/overview/allowance.component').then(m => m.AllowanceComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.DEPARTMENT.ALLOWANCE_ITEM.CREATE, PERMISSIONS.REQUESTS.ORDER.CREATE] }
  },
  {
    path: 'item-department-assignment',
    loadComponent: () => import('./pages/item-department-assignment/item-department-assignment.component').then(m => m.ItemDepartmentAssignmentComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.DEPARTMENT.ITEM_DEPARTMENT_ASSIGNMENT.PAGE] }
  }
];
