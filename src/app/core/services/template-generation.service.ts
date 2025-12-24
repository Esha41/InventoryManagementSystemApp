import { Injectable } from '@angular/core';
import { ExcelExportService, ExcelColumn } from './excel-export.service';
import { InventoryService } from './inventory.service';
import { AmmunitionService } from './ammunition.service';
import { ExplosiveService } from './explosive.service';
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
    private ammunitionService: AmmunitionService,
    private explosiveService: ExplosiveService,
    private toastService: ToastService
  ) { }

  /**
   * Generate asset import template based on type
   * For ammunition and explosive: downloads comprehensive template from backend with all fields and VLOOKUP support
   * For weapon: uses local generation (will be updated later)
   */
  generateAssetTemplate(type: 'ammunition' | 'weapon' | 'explosive'): void {
    // Use backend template for ammunition and explosive (comprehensive with all fields)
    if (type === 'ammunition' || type === 'explosive') {
      const service = type === 'ammunition' ? this.ammunitionService : this.explosiveService;
      const typeName = type.charAt(0).toUpperCase() + type.slice(1);

      service.downloadImportTemplate()
        .pipe(
          catchError(error => {
            console.error(`Error downloading ${type} template:`, error);
            this.toastService.error(`Failed to download ${type} template. Please try again.`);
            return of(null);
          })
        )
        .subscribe(blob => {
          if (blob) {
            const fileName = `${typeName}_Import_Template_${new Date().getTime()}.xlsx`;
            saveAs(blob, fileName);
            this.toastService.success(`${typeName} template downloaded successfully`);
          }
        });
      return;
    }

    // Keep local generation for weapons (will be updated later)
    let headers: ExcelColumn[] = [];
    let sampleData: any[] = [];

    if (type === 'weapon') {
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

