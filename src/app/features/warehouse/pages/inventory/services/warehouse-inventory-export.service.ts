import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { ToastService } from '@services/toast.service';
import { InventoryDetailDto } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { BatchSummaryDto } from '@models/batch.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Injectable({
  providedIn: 'root'
})
export class WarehouseInventoryExportService {

  constructor(
    private excelExportService: ExcelExportService,
    private translateService: TranslateService,
    private toastService: ToastService
  ) {}

  /**
   * Export filtered inventory to Excel (for ammunition and explosives)
   */
  /**
   * Export weapon batch summary rows (batch tab list).
   */
  exportBatchSummariesToExcel(batches: BatchSummaryDto[], depoName: string): void {
    if (!batches?.length) {
      this.toastService.warning('No data available to export');
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

    this.excelExportService.exportToExcel({
      fileName: `${depoName}_Batches`,
      sheetName: 'Batches',
      columns,
      data: batches,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe((translations) => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
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

    this.excelExportService.exportToExcel({
      fileName: fileName,
      sheetName: sheetName,
      columns: columns,
      data: exportRows,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
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

    this.excelExportService.exportToExcel({
      fileName: fileName,
      sheetName: sheetName,
      columns: columns,
      data: exportRows,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }
}

