import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { saveAs } from 'file-saver';

@Injectable({
    providedIn: 'root'
})
export class ExcelDownloadService {

    constructor(
        private http: HttpClient,
        private config: ConfigService
    ) { }

    /**
     * Download Excel file from server
     */
    downloadExcel(
        endpoint: string,
        fileName: string,
        params?: any
    ): Observable<void> {
        const url = `${this.config.apiUrl}${endpoint}`;

        return new Observable(observer => {
            this.http.get(url, {
                params: params,
                responseType: 'blob',
                observe: 'response'
            }).subscribe({
                next: (response) => {
                    const blob = response.body;
                    if (blob) {
                        // Extract filename from Content-Disposition header if available
                        const contentDisposition = response.headers.get('Content-Disposition');
                        const serverFileName = this.extractFileName(contentDisposition);

                        saveAs(blob, serverFileName || `${fileName}_${this.getTimestamp()}.xlsx`);
                    }
                    observer.next();
                    observer.complete();
                },
                error: (error) => {
                    observer.error(error);
                }
            });
        });
    }

    private extractFileName(contentDisposition: string | null): string | null {
        if (!contentDisposition) return null;

        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches && matches[1]) {
            return matches[1].replace(/['"]/g, '');
        }
        return null;
    }

    private getTimestamp(): string {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }
}
