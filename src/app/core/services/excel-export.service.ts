import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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

@Injectable({
    providedIn: 'root'
})
export class ExcelExportService {

    /**
     * Export data to Excel file (Client-side)
     */
    exportToExcel(options: ExcelExportOptions): void {
        const {
            fileName,
            sheetName = 'Sheet1',
            columns,
            data,
            includeTimestamp = true
        } = options;

        // Transform data according to column definitions
        const transformedData = this.transformData(data, columns);

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(transformedData);

        // Set column widths
        const columnWidths = columns.map(col => ({
            wch: col.width || 15
        }));
        worksheet['!cols'] = columnWidths;

        // Create workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array'
        });

        // Create blob and download
        const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const finalFileName = includeTimestamp
            ? `${fileName}_${this.getTimestamp()}.xlsx`
            : `${fileName}.xlsx`;

        saveAs(blob, finalFileName);
    }

    /**
     * Transform data according to column definitions
     */
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

    /**
     * Get nested property value using dot notation
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
    }

    /**
     * Generate timestamp for filename
     */
    private getTimestamp(): string {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    /**
     * Export multiple sheets to one Excel file
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
}
