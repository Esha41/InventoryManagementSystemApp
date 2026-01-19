import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CardComponent } from '@components/card/card.component';
import { AssetsImportExportComponent } from './components/assets-import-export.component';
import { InventorySummaryComponent } from './components/inventory-summary.component';
import { WarehouseInventoryComponent } from './components/warehouse-inventory.component';
import { TranslationService } from '@services/translation.service';

@Component({
  selector: 'app-admin-import-export',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    CardComponent,
    AssetsImportExportComponent,
    InventorySummaryComponent,
    WarehouseInventoryComponent
  ],
  templateUrl: './admin-import-export.component.html',
  styleUrls: ['./admin-import-export.component.css']
})
export class AdminImportExportComponent {
  activeSection: 'assets' | 'inventory-summary' | 'warehouse-inventory' = 'assets';
  activeAssetTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';

  constructor(
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  switchSection(section: 'assets' | 'inventory-summary' | 'warehouse-inventory'): void {
    this.activeSection = section;
    this.cdr.markForCheck();
  }
}
