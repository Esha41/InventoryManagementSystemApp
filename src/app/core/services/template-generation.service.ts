import { Injectable } from '@angular/core';
import { ExcelExportService, ExcelColumn } from './excel-export.service';
import { InventoryService } from './inventory.service';
import { saveAs } from 'file-saver';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class TemplateGenerationService {
  constructor(
    private excelExportService: ExcelExportService,
    private inventoryService: InventoryService,
    private toastService: ToastService
  ) { }

  /**
   * Generate asset import template based on type
   */
  generateAssetTemplate(type: 'ammunition' | 'weapon' | 'explosive'): void {
    let headers: ExcelColumn[] = [];
    let sampleData: any[] = [];

    if (type === 'ammunition') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Arm Number', key: 'armNumber' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'Bullet Diameter', key: 'bulletDiameter' },
        { header: 'Is Linked', key: 'isLinked' },
        { header: 'Primer', key: 'primer' },
        { header: 'Total Weight', key: 'totalWeight' },
        { header: 'NSN', key: 'nsn' }
      ];
      sampleData = [{
        name: '6.5×55mm Swedish',
        itemNo: 'AMM-111',
        partNo: 'P-655-SWE',
        armNumber: 'ARM-111',
        price: 4.8,
        minimumQuantity: 100,
        bulletDiameter: 6.5,
        isLinked: false,
        primer: 'Boxer',
        totalWeight: 12.5,
        nsn: '1305-12-345-6789'
      }];
    } else if (type === 'weapon') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Weapon Type', key: 'weaponType' },
        { header: 'Caliber', key: 'caliber' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'NSN', key: 'nsn' }
      ];
      sampleData = [{
        name: 'AK-47',
        itemNo: 'WPN-001',
        partNo: 'P-AK47',
        weaponType: 'Rifle',
        caliber: '7.62x39mm',
        price: 500,
        minimumQuantity: 10,
        nsn: '1005-12-345-6789'
      }];
    } else if (type === 'explosive') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Explosive Type', key: 'explosiveType' },
        { header: 'UN Number', key: 'unNumber' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'NSN', key: 'nsn' }
      ];
      sampleData = [{
        name: 'TNT',
        itemNo: 'EXP-001',
        partNo: 'P-TNT',
        explosiveType: 'High Explosive',
        unNumber: 'UN0209',
        price: 50,
        minimumQuantity: 5,
        nsn: '1375-12-345-6789'
      }];
    }

    this.excelExportService.exportToExcel({
      fileName: `${type}_import_template`,
      columns: headers,
      data: sampleData,
      sheetName: 'Import Template',
      includeTimestamp: false
    });
  }

  /**
   * Generate warehouse inventory import template with data validation
   * Downloads template from backend which includes Excel dropdown validation for lookups
   */
  generateWarehouseInventoryTemplate(depotId: number): void {
    if (!depotId || depotId <= 0) {
      this.toastService.error('Please select a valid depot first');
      return;
    }

    this.inventoryService.downloadImportTemplate(depotId)
      .pipe(
        catchError(error => {
          console.error('Error downloading template:', error);
          this.toastService.error('Failed to download template. Please try again.');
          return of(null);
        })
      )
      .subscribe(blob => {
        if (blob) {
          const fileName = `Warehouse_Inventory_Import_Template_Depot_${depotId}.xlsx`;
          saveAs(blob, fileName);
          this.toastService.success('Template downloaded successfully');
        }
      });
  }
}

