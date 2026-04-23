import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

export const REPORTS_ROUTES: Routes = [
  {
    path: 'report-designer',
    loadComponent: () => import('./designer-list/report-designer.component').then(m => m.ReportDesignerComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ReportDesigner'] }
  },
  {
    path: 'report-designer/designer',
    loadComponent: () => import('./designer/devexpress-designer.component').then(m => m.DevExpressReportDesignerComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ReportDesigner'] }
  },
  {
    path: 'report-dashboard',
    loadComponent: () => import('./dashboard/report-dashboard.component').then(m => m.ReportDashboardComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ReportDashboard'] }
  },
  {
    path: 'scheduled-reports',
    loadComponent: () => import('./scheduled-reports/scheduled-reports-list.component').then(m => m.ScheduledReportsListComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ScheduledReports'] }
  },
  {
    path: 'scheduled-reports/create',
    loadComponent: () => import('./scheduled-reports/scheduled-report-form/scheduled-report-form.component').then(m => m.ScheduledReportFormComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ScheduledReports'] }
  },
  {
    path: 'scheduled-reports/:id/edit',
    loadComponent: () => import('./scheduled-reports/scheduled-report-form/scheduled-report-form.component').then(m => m.ScheduledReportFormComponent),
    canActivate: [permissionGuard],
    data: { permissions: ['ScheduledReports'] }
  },
  {
    path: 'report-viewer',
    loadComponent: () => import('./viewer/report-viewer.component').then(m => m.ReportViewerComponent)
  }
];
