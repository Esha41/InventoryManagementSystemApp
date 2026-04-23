import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { AssetService } from '@assets/services/asset.service';
import { InventoryService } from '@inventory/services/inventory.service';
import { BatchService } from '@warehouse/services/batch.service';
import { IImportableService } from '@core/interfaces/importable-service.interface';
import { ToastService } from '@services/toast.service';
import { ImportExportService } from '@admin/services/import-export.service';
import { APIOperationResponse } from '@models/api-response.model';
import { ImportResult } from '@models/import-result.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { mapImportResultToPreviewData } from '@core/utils/asset-master-import-preview.utils';
import { WarehouseInventoryStore } from './warehouse-inventory.store';

@Injectable({
  providedIn: 'root'
})
export class WarehouseInventoryImportService {
  constructor(
    private inventoryService: InventoryService,
    private assetService: AssetService,
    private batchService: BatchService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private importExportService: ImportExportService
  ) {}

  generateTemplate(input: {
    activeTab: 'ammunition' | 'explosive' | 'batch';
    depotId: number;
    lang: string;
  }) {
    return this.resolveImportService(input.activeTab).generateImportTemplate(input.lang, input.depotId);
  }

  previewImport(input: {
    activeTab: 'ammunition' | 'explosive' | 'batch';
    depotId: number;
    file: File;
    lang: string;
    batchExcelImportMode: boolean;
    batchImportTargetId: number | null;
  }) {
    const useBatchExcel = input.batchExcelImportMode && input.batchImportTargetId != null && input.activeTab === 'batch';
    if (useBatchExcel && input.batchImportTargetId != null) {
      return this.batchService.importBatchAssetsPreview(input.file, input.lang, input.batchImportTargetId);
    }
    return this.resolveImportService(input.activeTab).importPreview(input.file, input.lang, input.depotId);
  }

  executeImport(input: {
    activeTab: 'ammunition' | 'explosive' | 'batch';
    depotId: number;
    file: File;
    lang: string;
    batchExcelImportMode: boolean;
    batchImportTargetId: number | null;
  }) {
    const useBatchExcel = input.batchExcelImportMode && input.batchImportTargetId != null && input.activeTab === 'batch';
    if (useBatchExcel && input.batchImportTargetId != null) {
      return this.batchService.importBatchAssets(input.file, input.lang, input.batchImportTargetId);
    }
    return this.resolveImportService(input.activeTab).importData(input.file, input.lang, input.depotId);
  }

  private resolveImportService(activeTab: 'ammunition' | 'explosive' | 'batch'): IImportableService {
    return activeTab === 'batch' ? this.assetService : this.inventoryService;
  }

  // ---------- Store-aware orchestration flows ----------

  downloadTemplateFlow(store: WarehouseInventoryStore, lang: string): void {
    const depotId = store.depoId();
    if (!this.guardDepot(depotId)) return;
    this.generateTemplate({ activeTab: store.activeTab(), depotId, lang })
      .pipe(takeUntilDestroyed(store.destroyRef))
      .subscribe({
        next: blob => {
          const fileName = store.activeTab() === 'batch'
            ? `Weapon_Asset_Import_Template_Depot_${depotId}.xlsx`
            : `Inventory_Import_Template_Depot_${depotId}.xlsx`;
          this.downloadBlob(blob, fileName);
          this.toastService.success('Template downloaded successfully');
        },
        error: err => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Failed to download template'));
        }
      });
  }

  previewFlow(file: File, store: WarehouseInventoryStore, lang: string): void {
    const depotId = store.depoId();
    if (!depotId) return;
    if (store.isPreviewInProgress()) {
      this.toastService.warning('Preview is already in progress. Please wait...');
      return;
    }
    const activeTab = store.activeTab();
    const batchExcelImportMode = store.batchExcelImportMode();
    const batchImportTargetId = store.batchImportTargetId();
    const useBatchExcel = batchExcelImportMode && batchImportTargetId != null && activeTab === 'batch';

    store.setPreviewData(null);
    store.setPreviewModalOpen(false);
    store.setPreviewInProgress(true);
    store.setLoading(true);
    store.setImportModalOpen(false);
    store.setPendingImportFile(file);

    this.previewImport({
      activeTab,
      depotId,
      file,
      lang,
      batchExcelImportMode,
      batchImportTargetId
    })
      .pipe(takeUntilDestroyed(store.destroyRef))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          store.setPreviewInProgress(false);
          store.setLoading(false);
          if (!res?.succeeded || !res.data) {
            store.setPreviewData(null);
            this.toastService.error(res?.message || 'Preview failed');
            store.setBatchExcelImportMode(false);
            store.setBatchImportTargetId(null);
            return;
          }
          const preview = mapImportResultToPreviewData(
            res.data,
            useBatchExcel ? { excludeColumns: ['assetId', 'itemId'], batchImportActions: true } : undefined
          );
          if (preview) {
            store.setPreviewData(preview);
            store.setPreviewModalOpen(true);
          }
        },
        error: err => {
          store.setPreviewInProgress(false);
          store.setLoading(false);
          store.setPreviewData(null);
          store.setBatchExcelImportMode(false);
          store.setBatchImportTargetId(null);
          this.toastService.error(`Preview failed: ${ErrorHandler.extractErrorMessage(err, 'Unknown error')}`);
        }
      });
  }

  executeFlow(
    file: File,
    store: WarehouseInventoryStore,
    lang: string,
    opts: { clearPending: boolean },
    onRefresh: () => void
  ): void {
    const depotId = store.depoId();
    this.executeImport({
      activeTab: store.activeTab(),
      depotId,
      file,
      lang,
      batchExcelImportMode: store.batchExcelImportMode(),
      batchImportTargetId: store.batchImportTargetId()
    })
      .pipe(takeUntilDestroyed(store.destroyRef))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          store.setImportInProgress(false);
          store.setLoading(false);
          if (opts.clearPending) store.setPendingImportFile(null);
          store.setBatchExcelImportMode(false);
          store.setBatchImportTargetId(null);
          if (res?.succeeded && res.data) {
            const r = res.data;
            this.importExportService.handleImportResult({
              successCount: r.successCount ?? r.successfulRecords?.length ?? 0,
              failureCount: r.errors?.length ?? 0,
              errors: r.errors || [],
              message: res?.message
            });
            onRefresh();
          } else {
            this.toastService.error(res?.message || 'Import failed');
          }
        },
        error: err => {
          store.setImportInProgress(false);
          store.setLoading(false);
          if (opts.clearPending) store.setPendingImportFile(null);
          store.setBatchExcelImportMode(false);
          store.setBatchImportTargetId(null);
          this.toastService.error(`Import failed: ${ErrorHandler.extractErrorMessage(err, 'Unknown error')}`);
        }
      });
  }

  private guardDepot(depotId: number): boolean {
    if (!depotId) {
      this.toastService.warning('Depot not loaded');
      return false;
    }
    return true;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}
