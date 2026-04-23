import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

// Children of `path: 'workflow'` in app.routes.ts.
export const WORKFLOW_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/overview/workflow.component').then(m => m.WorkflowComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['workflow.page', 'workflow.view'] }
  },
  {
    path: 'add',
    loadComponent: () => import('./pages/overview/add-workflow/add-workflow.component').then(m => m.AddWorkflowComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['workflow.create'] }
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/overview/workflow-detail/workflow-detail.component').then(m => m.WorkflowDetailComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['workflow.view', 'workflow.page'] }
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/overview/edit-workflow/edit-workflow.component').then(m => m.EditWorkflowComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['workflow.edit'] }
  }
];
