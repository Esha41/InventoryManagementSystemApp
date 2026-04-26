import { Routes } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { permissionGuard } from '@guards/permission.guard';

export const REPORTS_ROUTES: Routes = [
  {
    path: 'report-designer',
    loadComponent: () => import('./designer-list/report-designer.component').then(m => m.ReportDesignerComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REPORTS.DESIGNER] }
  },
  {
    path: 'report-designer/designer',
    loadComponent: () => import('./designer/devexpress-designer.component').then(m => m.DevExpressReportDesignerComponent),
    canActivate: [permissionGuard],
    data: {
      permissions: [PERMISSIONS.REPORTS.DESIGNER],
      shell: { collapseSidebar: true }
    }
  },
  {
    path: 'report-dashboard',
    loadComponent: () => import('./dashboard/report-dashboard.component').then(m => m.ReportDashboardComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REPORTS.DASHBOARD] }
  },
  {
    path: 'scheduled-reports',
    loadComponent: () => import('./scheduled-reports/scheduled-reports-list.component').then(m => m.ScheduledReportsListComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REPORTS.SCHEDULED] }
  },
  {
    path: 'scheduled-reports/create',
    loadComponent: () => import('./scheduled-reports/scheduled-report-form/scheduled-report-form.component').then(m => m.ScheduledReportFormComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REPORTS.SCHEDULED] }
  },
  {
    path: 'scheduled-reports/:id/edit',
    loadComponent: () => import('./scheduled-reports/scheduled-report-form/scheduled-report-form.component').then(m => m.ScheduledReportFormComponent),
    canActivate: [permissionGuard],
    data: { permissions: [PERMISSIONS.REPORTS.SCHEDULED] }
  },
  {
    path: 'report-viewer',
    loadComponent: () => import('./viewer/report-viewer.component').then(m => m.ReportViewerComponent),
    data: { shell: { hideSidebar: true } }
  }
];
