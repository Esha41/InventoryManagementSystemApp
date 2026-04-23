import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ToastService } from '@services/toast.service';
import { ExcelService, ExcelColumn } from '@services/excel.service';
import { formatDateShort } from '@core/utils/format.utils';

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  constructor(
    private excelService: ExcelService,
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
   * Format date for display
   */
  formatDate(date?: Date | string): string {
    if (!date) return '-';
    const formatted = formatDateShort(date);
    return formatted === 'N/A' ? '-' : formatted;
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
    this.excelService.exportToExcel({
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
    /** Optional API message (e.g. batch import "X created, Y updated"). */
    message?: string | null;
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
      const prefix = result.message?.trim() ? `${result.message.trim()} — ` : '';
      this.toastService.warning(prefix + msg);
      console.warn('Import Validation Errors:', result.errors);
    } else {
      const successMsg = result.message?.trim()?.length
        ? result.message.trim()
        : `Imported ${result.successCount} items successfully.`;
      this.toastService.success(successMsg);
    }
  }
}

