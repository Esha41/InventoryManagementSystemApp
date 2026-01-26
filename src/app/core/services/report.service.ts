import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';

export interface Report {
  id: string;
  reportName: string;
  url: string;
  reportStatusId: number;
  reportStatusNameEn: string;
  reportStatusNameAr: string;
  description?: string;
  reportParameters?: string;
  creationDate: Date;
  createdBy: string;
  modificationDate?: Date;
  modifiedBy?: string;
  isDeleted: boolean;
  deletionDate?: Date;
  deletedBy?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly endpoint = '/Report';

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
  setReportPublic(id: string, isPublic: boolean): Observable<Report> {
    return this.apiService.patch<Report>(
    `${this.endpoint}/${id}/public?isPublic=${isPublic}`,
    null
  );
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
    const baseUrl = this.config.apiUrl.replace('/api', ''); // Remove /api to get base URL
    const designerUrl = `${baseUrl}/DXXRD`;
    
    if (reportUrl) {
      return `${designerUrl}?reportUrl=${encodeURIComponent(reportUrl)}`;
    }
    
    return designerUrl;
  }

  /**
   * Get the DevExpress Web Document Viewer endpoint URL
   */
  getViewerUrl(reportUrl: string): string {
    const baseUrl = this.config.apiUrl.replace('/api', ''); // Remove /api to get base URL
    return `${baseUrl}/DXXRDV?reportUrl=${encodeURIComponent(reportUrl)}`;
  }
}

