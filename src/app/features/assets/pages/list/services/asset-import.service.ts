/**
 * Asset Import Service
 * Handles import logic and error processing for assets
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ToastService } from '@services/toast.service';
import { AssetType } from '@models/asset-list.model';
import { APIOperationResponse } from '@models/api-response.model';

export interface ImportResult {
  successCount: number;
  failureCount: number;
  errors: Array<{ errorMessage: string }>;
}

@Injectable({
  providedIn: 'root'
})
export class AssetImportService {
  constructor(private toastService: ToastService) { }

  /**
   * Handle import response and show appropriate messages
   */
  handleImportResponse(res: APIOperationResponse<ImportResult>): void {
    if (res.succeeded && res.data) {
      const result = res.data;
      
      if (result.errors && result.errors.length > 0) {
        let msg = `Imported ${result.successCount} items. ${result.failureCount} failed.`;

        // If only 1-2 errors, show the first reason
        if (result.failureCount <= 2 && result.errors[0]?.errorMessage) {
          let reason = result.errors[0].errorMessage;

          // Extract inner exception if present for cleaner message
          if (reason.includes("(Inner:")) {
            const parts = reason.split("(Inner:");
            if (parts.length > 1) {
              reason = parts[1].replace(")", "").trim();
            }
          }

          if (reason.length > 300) reason = reason.substring(0, 300) + '...';
          msg += ` Reason: ${reason}`;
        } else {
          // Check for common issues in bulk
          const hasDuplicates = result.errors.some((e: { errorMessage: string }) =>
            e.errorMessage?.toLowerCase().includes('duplicate') ||
            e.errorMessage?.toLowerCase().includes('already exists')
          );
          if (hasDuplicates) msg += " (Duplicates found)";
          else msg += ` (${result.errors.length} errors found)`;
        }

        this.toastService.warning(msg);
      } else {
        this.toastService.success(`Imported ${result.successCount} items successfully.`);
      }
    } else {
      this.toastService.error(res.message || 'Import failed');
    }
  }

  /**
   * Handle import error
   */
  handleImportError(): void {
    this.toastService.error('Import failed');
  }
}
