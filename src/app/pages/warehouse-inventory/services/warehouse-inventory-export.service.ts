import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { ToastService } from '@services/toast.service';
import { InventoryDetailDto } from '@models/inventory.model';
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
   * Export filtered inventory to Excel
   */
  exportInventoryToExcel(
    inventoryDetails: InventoryDetailDto[],
    depoName: string,
    activeTab: 'ammunition' | 'weapon' | 'explosive',
    getItemName: (detail: InventoryDetailDto) => string,
    formatDate: (date?: Date | string) => string
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
      },
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
    ];

    const fileName = `${depoName}_Inventory_${activeTab}`;
    const sheetName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);

    this.excelExportService.exportToExcel({
      fileName: fileName,
      sheetName: sheetName,
      columns: columns,
      data: inventoryDetails,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }
}

