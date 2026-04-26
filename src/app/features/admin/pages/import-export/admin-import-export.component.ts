import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CardComponent } from '@components/card/card.component';
import { AssetsImportExportComponent } from './components/assets-import-export.component';
import { AdminInventorySummaryComponent } from './components/admin-inventory-summary.component';
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
    AdminInventorySummaryComponent,
    WarehouseInventoryComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-import-export.component.html',
  styleUrls: ['./admin-import-export.component.css']
})
export class AdminImportExportComponent {
  // State as signals
  activeSection = signal<'assets' | 'inventory-summary' | 'warehouse-inventory'>('assets');
  activeAssetTab = signal<'ammunition' | 'weapon' | 'explosive'>('ammunition');

  constructor(
    private translationService: TranslationService
  ) { }

  // Computed signal for RTL
  isRTL = computed(() => this.translationService?.isRTL() ?? false);

  switchSection(section: 'assets' | 'inventory-summary' | 'warehouse-inventory'): void {
    this.activeSection.set(section);
  }
}
