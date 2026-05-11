import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { ExcelService, ExcelColumn } from '@services/excel.service';
import { ToastService } from '@services/toast.service';
import { InventoryService } from '@inventory/services/inventory.service';
import { InventoryDetailDto } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { BatchSummaryDto } from '@models/batch.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { WarehouseInventoryStore } from '../../../services/warehouse-inventory.store';
import { WarehouseInventoryService } from '../../../services/warehouse-inventory.service';
import { WarehouseInventoryDataService } from '../../../services/warehouse-inventory-data.service';
import { WarehouseInventoryFormatterService } from './warehouse-inventory-formatter.service';

@Injectable({
  providedIn: 'root'
})
export class WarehouseInventoryExportService {

  constructor(
    private excelService: ExcelService,
    private translateService: TranslateService,
    private toastService: ToastService,
    private inventoryService: InventoryService,
    private warehouseInventoryService: WarehouseInventoryService,
    private warehouseInventoryDataService: WarehouseInventoryDataService,
    private formatterService: WarehouseInventoryFormatterService
  ) {}

  /**
   * Export filtered inventory to Excel (for ammunition and explosives)
   */
  /**
   * Export weapon inventory summary rows (policy number tab list).
   */
  exportBatchSummariesToExcel(batches: BatchSummaryDto[], depoName: string): void {
    if (!batches?.length) {
      this.showWarningToast('common.noData');
      return;
    }

    const columns: ExcelColumn[] = [
      {
        header: this.translateService.instant('warehouseInventory.batchNo'),
        key: 'batchNumber',
        width: 20,
        format: (value: string) => value || '-'
      },
      {
        header: this.translateService.instant('warehouseInventory.quantity') || 'Quantity',
        key: 'quantity',
        width: 12
      }
    ];

    this.excelService.exportToExcel({
      fileName: `${depoName}_Batches`,
      sheetName: 'Batches',
      columns,
      data: batches,
      includeTimestamp: true
    });

    this.showSuccessToast();
  }

  exportInventoryToExcel(
    inventoryDetails: InventoryDetailDto[],
    depoName: string,
    activeTab: 'ammunition' | 'explosive',
    getItemName: (detail: InventoryDetailDto) => string,
    formatDate: (date?: Date | string) => string,
    getPrimaryPurposeName?: (detail: InventoryDetailDto) => string
  ): void {
    const lang = getCurrentLang(this.translateService);

    const columns: ExcelColumn[] = [
      {
        header: this.translateService.instant('warehouseInventory.itemName'),
        key: 'itemNameExport',
        width: 30
      },
      {
        header: this.translateService.instant('warehouseInventory.itemNo'),
        key: 'itemNoExport',
        width: 15
      },
      {
        header: this.translateService.instant('common.supplier'),
        key: 'supplierExport',
        width: 20
      }
    ];

    if ((activeTab === 'ammunition' || activeTab === 'explosive') && getPrimaryPurposeName) {
      columns.push({
        header: this.translateService.instant('warehouseInventory.primaryPurpose'),
        key: 'primaryPurposeExport',
        width: 22
      });
    }

    columns.push(
      {
        header: this.translateService.instant('warehouseInventory.lot'),
        key: 'lot',
        width: 10
      },
      {
        header: this.translateService.instant('warehouseInventory.batchNo'),
        key: 'batchNo',
        width: 15,
        format: (value) => value || '-'
      },
      {
        header: this.translateService.instant('warehouseInventory.originalQty'),
        key: 'originalQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('warehouseInventory.currentQty'),
        key: 'currentQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('warehouseInventory.usedQty'),
        key: 'usedQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('warehouseInventory.remainingQty'),
        key: 'remainingQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('warehouseInventory.expiryDate'),
        key: 'expiryDateExport',
        width: 15
      }
    );

    const fileName = `${depoName}_Inventory_${activeTab}`;
    const sheetName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);

    const exportRows = inventoryDetails.map(d => ({
      ...d,
      itemNameExport: getItemName(d),
      itemNoExport: d.item?.itemNo || '-',
      supplierExport: getLocalizedName(d.supplier, lang) || '-',
      primaryPurposeExport: getPrimaryPurposeName ? getPrimaryPurposeName(d) : '-',
      expiryDateExport: formatDate(d.expiryDate)
    }));

    this.excelService.exportToExcel({
      fileName: fileName,
      sheetName: sheetName,
      columns: columns,
      data: exportRows,
      includeTimestamp: true
    });

    this.showSuccessToast();
  }

  /**
   * Export weapon assets to Excel
   */
  exportAssetsToExcel(
    assets: AssetDto[],
    depoName: string,
    getAssetItemName: (asset: AssetDto) => string,
    formatDate: (date?: Date | string) => string
  ): void {
    const columns: ExcelColumn[] = [
      {
        header: this.translateService.instant('warehouseInventory.itemName'),
        key: 'itemNameExport',
        width: 30
      },
      {
        header: this.translateService.instant('warehouseInventory.serialNumber'),
        key: 'serialNumber',
        width: 18,
        format: (value) => value || '-'
      },
      {
        header: this.translateService.instant('warehouseInventory.rfidTag'),
        key: 'rfid',
        width: 15,
        format: (value) => value || '-'
      },
      {
        header: this.translateService.instant('warehouseInventory.purchaseDate'),
        key: 'purchaseDateExport',
        width: 15
      },
      {
        header: this.translateService.instant('warehouseInventory.warrantyExpiryDate'),
        key: 'warrantyExpiryDateExport',
        width: 18
      },
      {
        header: this.translateService.instant('warehouseInventory.purchasePrice'),
        key: 'purchasePrice',
        width: 15,
        format: (value) => value ? value.toString() : '-'
      },
      {
        header: this.translateService.instant('common.notes'),
        key: 'notes',
        width: 30,
        format: (value) => value || '-'
      }
    ];

    const fileName = `${depoName}_Assets_Weapon`;
    const sheetName = 'Weapon';

    const exportRows = assets.map(a => ({
      ...a,
      itemNameExport: getAssetItemName(a),
      purchaseDateExport: formatDate(a.purchaseDate),
      warrantyExpiryDateExport: formatDate(a.warrantyExpiryDate)
    }));

    this.excelService.exportToExcel({
      fileName: fileName,
      sheetName: sheetName,
      columns: columns,
      data: exportRows,
      includeTimestamp: true
    });

    this.showSuccessToast();
  }

  // ---------- Store-aware orchestration flows ----------

  exportDepotFlow(store: WarehouseInventoryStore): void {
    const cfg = this.warehouseInventoryService.resolveExportConfig(store.activeTab());
    if (cfg.kind === 'batch') {
      this.exportBatchSummariesToExcel(store.filteredBatches(), store.depoName());
      return;
    }
    const depotId = store.depoId();
    if (!depotId) return;
    store.setLoading(true);
    this.inventoryService.getWarehouseInventoryDetailsForExport(depotId, cfg.itemType)
      .pipe(takeUntilDestroyed(store.destroyRef))
      .subscribe({
        next: rows => {
          store.setLoading(false);
          this.exportInventoryToExcel(
            rows,
            store.depoName(),
            cfg.exportTab,
            d => this.formatterService.getItemName(d),
            d => this.formatterService.formatDate(d),
            d => this.formatterService.getPrimaryPurposeName(d)
          );
        },
        error: (err: unknown) => {
          store.setLoading(false);
          this.showErrorToast(err, 'Failed to fetch data for export');
        }
      });
  }

  exportBatchAssetsFlow(batch: BatchSummaryDto, store: WarehouseInventoryStore, lang: string): void {
    this.warehouseInventoryDataService.exportBatchAssetsExcel(batch.id, lang)
      .pipe(takeUntilDestroyed(store.destroyRef))
      .subscribe({
        next: blob => {
          const nameSafe = (batch.batchNumber || `batch_${batch.id}`).replace(/[^\w.-]+/g, '_');
          this.downloadBlob(blob, `${nameSafe}_BatchAssets_${new Date().toISOString().slice(0, 10)}.xlsx`);
          this.showSuccessToast();
        },
        error: (err: unknown) => {
          this.showErrorToast(err, 'Export failed');
        }
      });
  }

  private showSuccessToast(messageKey = 'common.exportSuccess', titleKey = 'toast.success'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(take(1))
      .subscribe(t => {
        this.toastService.success(t[messageKey], t[titleKey]);
      });
  }

  private showWarningToast(messageKey: string, titleKey?: string): void {
    const title = titleKey ?? 'toast.warning';
    this.translateService
      .get([messageKey, title])
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.warning(translations[messageKey], translations[title]);
      });
  }

  private showErrorToast(error: unknown, defaultMsg: string): void {
    const msg = ErrorHandler.extractAndTranslateErrorMessage(error, defaultMsg, this.translateService);
    this.translateService
      .get('toast.error')
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.error(msg, translations['toast.error']);
      });
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

