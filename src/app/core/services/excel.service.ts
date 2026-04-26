import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ConfigService } from './config.service';

export interface ExcelColumn {
    header: string;
    key: string;
    width?: number;
    format?: (value: any) => any;
}

export interface ExcelExportOptions {
    fileName: string;
    sheetName?: string;
    columns: ExcelColumn[];
    data: any[];
    includeTimestamp?: boolean;
}

/**
 * Client-side Excel generation and server-side Excel blob download.
 */
@Injectable({
    providedIn: 'root'
})
export class ExcelService {

    constructor(
        private readonly http: HttpClient,
        private readonly config: ConfigService
    ) { }

    /**
     * Export data to Excel file (client-side)
     */
    exportToExcel(options: ExcelExportOptions): void {
        const {
            fileName,
            sheetName = 'Sheet1',
            columns,
            data,
            includeTimestamp = true
        } = options;

        const transformedData = this.transformData(data, columns);

        const worksheet = XLSX.utils.json_to_sheet(transformedData);

        const columnWidths = columns.map(col => ({
            wch: col.width || 15
        }));
        worksheet['!cols'] = columnWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array'
        });

        const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const finalFileName = includeTimestamp
            ? `${fileName}_${this.getTimestamp()}.xlsx`
            : `${fileName}.xlsx`;

        saveAs(blob, finalFileName);
    }

    /**
     * Export multiple sheets to one Excel file (client-side)
     */
    exportMultipleSheets(
        fileName: string,
        sheets: Array<{ sheetName: string; columns: ExcelColumn[]; data: any[] }>
    ): void {
        const workbook = XLSX.utils.book_new();

        sheets.forEach(sheet => {
            const transformedData = this.transformData(sheet.data, sheet.columns);
            const worksheet = XLSX.utils.json_to_sheet(transformedData);

            const columnWidths = sheet.columns.map(col => ({
                wch: col.width || 15
            }));
            worksheet['!cols'] = columnWidths;

            XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
        });

        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array'
        });

        const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        saveAs(blob, `${fileName}_${this.getTimestamp()}.xlsx`);
    }

    /**
     * Download Excel file from server (blob)
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

    private transformData(data: any[], columns: ExcelColumn[]): any[] {
        return data.map(item => {
            const row: any = {};
            columns.forEach(col => {
                const value = this.getNestedValue(item, col.key);
                row[col.header] = col.format ? col.format(value) : value;
            });
            return row;
        });
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
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
