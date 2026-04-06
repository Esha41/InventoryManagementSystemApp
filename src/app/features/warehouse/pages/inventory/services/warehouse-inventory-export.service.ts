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
    const columns: ExcelColumn[] = [
      {
        header: this.translateService.instant('warehouseInventory.itemName'),
        key: 'item',
        width: 30,
        format: (item) => {
          const detail = item as InventoryDetailDto;
          return getItemName(detail);
        }
      },
      {
        header: this.translateService.instant('warehouseInventory.itemNo'),
        key: 'item.itemNo',
        width: 15
      },
      {
        header: this.translateService.instant('common.supplier'),
        key: 'supplier',
        width: 20,
        format: (supplier) => getLocalizedName(supplier, getCurrentLang(this.translateService)) || '-'
      }
    ];

    if ((activeTab === 'ammunition' || activeTab === 'explosive') && getPrimaryPurposeName) {
      columns.push({
        header: this.translateService.instant('warehouseInventory.primaryPurpose'),
        key: 'primaryPurposeExport',
        width: 22,
        format: (value) => value ?? '-'
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
        key: 'expiryDate',
        width: 15,
        format: (date) => formatDate(date)
      }
    );

    const fileName = `${depoName}_Inventory_${activeTab}`;
    const sheetName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);

    const exportRows =
      (activeTab === 'ammunition' || activeTab === 'explosive') && getPrimaryPurposeName
        ? inventoryDetails.map(d => ({
            ...d,
            primaryPurposeExport: getPrimaryPurposeName(d)
          }))
        : inventoryDetails;

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
        key: 'item',
        width: 30,
        format: (item) => {
          const asset = item as AssetDto;
          return getAssetItemName(asset);
        }
      },
      {
        header: this.translateService.instant('warehouseInventory.itemNo'),
        key: 'item.itemNo',
        width: 15,
        format: (value) => value || '-'
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
        header: this.translateService.instant('warehouseInventory.assetTag'),
        key: 'assetTag',
        width: 15,
        format: (value) => value || '-'
      },
      {
        header: this.translateService.instant('warehouseInventory.condition'),
        key: 'condition',
        width: 15,
        format: (value) => value || '-'
      },
      {
        header: this.translateService.instant('warehouseInventory.purchaseDate'),
        key: 'purchaseDate',
        width: 15,
        format: (date) => formatDate(date)
      },
      {
        header: this.translateService.instant('warehouseInventory.warrantyExpiryDate'),
        key: 'warrantyExpiryDate',
        width: 18,
        format: (date) => formatDate(date)
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

    this.excelExportService.exportToExcel({
      fileName: fileName,
      sheetName: sheetName,
      columns: columns,
      data: assets,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }
}

