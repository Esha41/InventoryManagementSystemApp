import { Injectable } from '@angular/core';
import { ExcelExportService, ExcelColumn } from './excel-export.service';
import { InventoryService } from './inventory.service';
import { AmmunitionService } from './ammunition.service';
import { ExplosiveService } from './explosive.service';
import { WeaponService } from './weapon.service';
import { TranslateService } from '@ngx-translate/core';
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
    private weaponService: WeaponService,
    private toastService: ToastService,
    private translateService: TranslateService
  ) { }

  /**
   * Generate asset import template based on type
   * For ammunition, explosive, and weapon: downloads comprehensive template from backend with all fields and VLOOKUP support
   * Template language matches current UI language (English/Arabic)
   */
  generateAssetTemplate(type: 'ammunition' | 'weapon' | 'explosive'): void {
    // Use backend template for all asset types (comprehensive with all fields)
    let service: AmmunitionService | ExplosiveService | WeaponService;

    if (type === 'ammunition') {
      service = this.ammunitionService;
    } else if (type === 'explosive') {
      service = this.explosiveService;
    } else {
      service = this.weaponService;
    }

    const typeName = type.charAt(0).toUpperCase() + type.slice(1);

    // Get current language from TranslateService
    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    service.downloadImportTemplate(currentLang)
      .pipe(
        catchError(error => {
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

    // Get current language from TranslateService
    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    this.inventoryService.downloadImportTemplate(depotId, currentLang)
      .pipe(
        catchError(() => {
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

