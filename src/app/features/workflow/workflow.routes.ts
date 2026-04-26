import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

// Children of `path: 'workflow'` in app.routes.ts.
export const WORKFLOW_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/overview/workflow.component').then(m => m.WorkflowComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WORKFLOW.PAGE, PERMISSIONS.WORKFLOW.VIEW] }
  },
  {
    path: 'add',
    loadComponent: () => import('./pages/overview/add-workflow/add-workflow.component').then(m => m.AddWorkflowComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WORKFLOW.CREATE] }
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/overview/workflow-detail/workflow-detail.component').then(m => m.WorkflowDetailComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WORKFLOW.VIEW, PERMISSIONS.WORKFLOW.PAGE] }
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/overview/edit-workflow/edit-workflow.component').then(m => m.EditWorkflowComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.WORKFLOW.EDIT] }
  }
];
