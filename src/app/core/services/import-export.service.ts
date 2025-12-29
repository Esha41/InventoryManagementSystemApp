import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ToastService } from './toast.service';
import { ExcelExportService, ExcelColumn } from './excel-export.service';

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  constructor(
    private excelExportService: ExcelExportService,
    private toastService: ToastService
  ) {}

  /**
   * Parse date from various formats
   */
  parseDate(dateValue: any): string | undefined {
    if (!dateValue) return undefined;
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0];
    }
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    return undefined;
  }

  /**
   * Format date in military format: "dd MM yyyy HH mm"
   */
  formatDate(date?: Date | string): string {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${day} ${month} ${year} ${hours} ${minutes}`;
  }

  /**
   * Format number with locale
   */
  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  /**
   * Export data to Excel
   */
  exportToExcel(config: {
    fileName: string;
    sheetName: string;
    columns: ExcelColumn[];
    data: any[];
    includeTimestamp?: boolean;
  }): void {
    this.excelExportService.exportToExcel({
      fileName: config.fileName,
      sheetName: config.sheetName,
      columns: config.columns,
      data: config.data,
      includeTimestamp: config.includeTimestamp ?? true
    });
  }

  /**
   * Handle import result and show appropriate message
   */
  handleImportResult(result: {
    successCount: number;
    failureCount: number;
    errors?: any[];
  }): void {
    if (result.errors && result.errors.length > 0) {
      let msg = `Imported ${result.successCount} items. ${result.failureCount} failed.`;
      if (result.failureCount <= 2 && result.errors[0]?.errorMessage) {
        let reason = result.errors[0].errorMessage;
        if (reason.includes("(Inner:")) {
          const parts = reason.split("(Inner:");
          if (parts.length > 1) {
            reason = parts[1].replace(")", "").trim();
          }
        }
        if (reason.length > 300) reason = reason.substring(0, 300) + '...';
        msg += ` Reason: ${reason}`;
      } else {
        const hasDuplicates = result.errors.some((e: any) =>
          e.errorMessage?.toLowerCase().includes('duplicate') ||
          e.errorMessage?.toLowerCase().includes('already exists')
        );
        if (hasDuplicates) msg += " (Duplicates found)";
        else msg += " Check console for details.";
      }
      this.toastService.warning(msg);
      console.warn('Import Validation Errors:', result.errors);
    } else {
      this.toastService.success(`Imported ${result.successCount} items successfully.`);
    }
  }
}

