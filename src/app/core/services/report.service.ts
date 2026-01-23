import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';

export interface Report {
  id: string;
  name: string;
  url: string;
  status: 'Draft' | 'Published' | 'Archived';
  createdDate: Date;
  modifiedDate?: Date;
  isPublic: boolean;
  description?: string;
}

export interface CanDesignResponse {
  canDesign: boolean;
  message: string;
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
   * Check if user has permission to design reports
   */
  canDesign(): Observable<CanDesignResponse> {
    return this.apiService.get<CanDesignResponse>(`${this.endpoint}/can-design`);
  }

  /**
   * Get list of reports
   */
  getReports(): Observable<Report[]> {
    // Backend returns { reports: [...] } directly (not wrapped in APIOperationResponse)
    // So we use getRaw to get the full response, then extract reports
    return this.apiService.getRaw<{ reports: Report[] }>(`${this.endpoint}/reports`).pipe(
      map(response => {
        // If it's wrapped in APIOperationResponse, extract data first
        if (response && 'succeeded' in response && response.succeeded && response.data) {
          return (response.data as any).reports || [];
        }
        // If it's direct response
        if (response && 'reports' in response) {
          return (response as any).reports || [];
        }
        // Fallback
        return [] as Report[];
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

