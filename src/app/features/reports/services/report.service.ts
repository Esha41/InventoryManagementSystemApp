import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';
import {
  Report,
  ReportTemplate,
  ScheduledReport,
  ScheduledReportExecution,
  CreateScheduledReportDto
} from '@models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly endpoint = '/Report';
  private readonly scheduledEndpoint = '/ScheduledReport';

  constructor(
    private apiService: ApiService,
    private config: ConfigService
  ) { }

  /**
   * Get list of reports from backend
   */
  getAll(): Observable<Report[]> {
    return this.apiService.get<Report[]>(this.endpoint);
  }

  /**
   * Get list of public reports (Published status) from backend
   */
  getPublicReports(): Observable<Report[]> {
    return this.apiService.get<Report[]>(`${this.endpoint}/public`);
  }

  /**
   * Get report by ID
   */
  getById(id: string): Observable<Report> {
    return this.apiService.get<Report>(`${this.endpoint}/${id}`);
  }

  /**
   * Get report by URL
   */
  getByUrl(url: string): Observable<Report> {
    return this.apiService.get<Report>(`${this.endpoint}/url/${encodeURIComponent(url)}`);
  }

  /**
   * Delete a report
   */
  delete(id: string): Observable<boolean> {
    return this.apiService.delete<boolean>(`${this.endpoint}/${id}`);
  }

  /**
   * Update a report
   */
  update(id: string, data: Partial<Report>): Observable<Report> {
    return this.apiService.put<Report>(`${this.endpoint}/${id}`, data);
  }

  /**
   * Set report public (Published) or private (Draft).
   * Returns the updated report.
   */
  setReportPublic(id: string, isPublic: boolean, roleIds?: string[]): Observable<Report> {
    const body = {
      isPublic,
      roleIds: roleIds || []
    };
    return this.apiService.patch<Report>(
      `${this.endpoint}/${id}/public`,
      body
    );
  }

  /**
   * Get role IDs associated with a report
   */
  getReportRoles(id: string): Observable<string[]> {
    return this.apiService.get<string[]>(`${this.endpoint}/${id}/roles`);
  }

  /**
   * Create a new report
   */
  create(data: Partial<Report>): Observable<string> {
    return this.apiService.post<string>(this.endpoint, data);
  }

  /**
   * Import a report from file (.repx or .xml)
   */
  import(file: File, reportName?: string, url?: string, description?: string): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    if (reportName) {
      formData.append('reportName', reportName);
    }
    if (url) {
      formData.append('url', url);
    }
    if (description) {
      formData.append('description', description);
    }

    // Use postRaw to handle FormData properly
    return this.apiService.postRaw<string>(`${this.endpoint}/import`, formData).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to import report');
      })
    );
  }

  /**
   * Get the DevExpress Report Designer endpoint URL
   */
  getDesignerUrl(reportUrl?: string): string {
    const baseUrl = this.config.reportingHost;
    const designerUrl = `${baseUrl}${this.config.reportingDesignerPath}`;

    if (reportUrl) {
      return `${designerUrl}?reportUrl=${encodeURIComponent(reportUrl)}`;
    }

    return designerUrl;
  }

  /**
   * Get the DevExpress Web Document Viewer endpoint URL
   */
  getViewerUrl(reportUrl: string): string {
    const baseUrl = this.config.reportingHost;
    return `${baseUrl}${this.config.reportingViewerInvokeAction}?reportUrl=${encodeURIComponent(reportUrl)}`;
  }

  /**
   * Get all available report templates
   */
  getTemplates(): Observable<ReportTemplate[]> {
    return this.apiService.get<ReportTemplate[]>(`${this.endpoint}/templates`);
  }

  // ==================== SCHEDULED REPORTS ====================

  /**
   * Get all scheduled reports
   */
  getScheduledReports(): Observable<ScheduledReport[]> {
    return this.apiService.get<ScheduledReport[]>(this.scheduledEndpoint);
  }

  /**
   * Get scheduled report by ID
   */
  getScheduledReportById(id: string): Observable<ScheduledReport> {
    return this.apiService.get<ScheduledReport>(`${this.scheduledEndpoint}/${id}`);
  }

  /**
   * Create a new scheduled report
   */
  createScheduledReport(data: CreateScheduledReportDto): Observable<string> {
    return this.apiService.post<string>(this.scheduledEndpoint, data);
  }

  /**
   * Update a scheduled report
   */
  updateScheduledReport(id: string, data: CreateScheduledReportDto): Observable<boolean> {
    return this.apiService.put<boolean>(`${this.scheduledEndpoint}/${id}`, data);
  }

  /**
   * Delete a scheduled report
   */
  deleteScheduledReport(id: string): Observable<boolean> {
    return this.apiService.delete<boolean>(`${this.scheduledEndpoint}/${id}`);
  }

  /**
   * Toggle scheduled report active status
   */
  toggleScheduledReportActive(id: string, isActive: boolean): Observable<boolean> {
    return this.apiService.patch<boolean>(`${this.scheduledEndpoint}/${id}/toggle-active`, { isActive });
  }

  /**
   * Execute scheduled report immediately
   */
  executeScheduledReportNow(id: string): Observable<boolean> {
    return this.apiService.post<boolean>(`${this.scheduledEndpoint}/${id}/execute-now`, {});
  }

  /**
   * Get execution history for a scheduled report
   */
  getExecutionHistory(scheduledReportId: string): Observable<ScheduledReportExecution[]> {
    return this.apiService.get<ScheduledReportExecution[]>(`${this.scheduledEndpoint}/${scheduledReportId}/executions`);
  }
}
