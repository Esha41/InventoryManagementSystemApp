import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Download } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { InventorySummaryDataService } from '@services/inventory-summary-data.service';
import { ToastService } from '@services/toast.service';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { ImportExportService } from '@services/import-export.service';
import { ItemInventorySummaryDto } from '@models/inventory.model';
import { InventorySummaryUtils } from '@utils/inventory-summary.utils';
import { TranslationService } from '@services/translation.service';
import { LoadingStateComponent } from '@components/index';

@Component({
  selector: 'app-inventory-summary',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    LoadingStateComponent
  ],
  providers: [InventorySummaryDataService],
  templateUrl: './inventory-summary.component.html'
})
export class InventorySummaryComponent implements OnInit, OnDestroy {
  inventorySummaryItems: ItemInventorySummaryDto[] = [];
  filteredInventoryItems: ItemInventorySummaryDto[] = [];
  activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';
  loadingInventorySummary = false;

  readonly Download = Download;

  private destroy$ = new Subject<void>();

  constructor(
    private inventorySummaryDataService: InventorySummaryDataService,
    private toastService: ToastService,
    private excelExportService: ExcelExportService,
    private importExportService: ImportExportService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) { }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  ngOnInit(): void {
    this.loadInventorySummary();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  switchTab(tab: 'ammunition' | 'weapon' | 'explosive'): void {
    this.activeTab = tab;
    this.loadInventorySummary();
  }

  loadInventorySummary(): void {
    this.loadingInventorySummary = true;
    this.cdr.markForCheck();

    this.inventorySummaryDataService.loadAllItems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.inventorySummaryItems = items;
          this.applyFilters();
          this.loadingInventorySummary = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading inventory summary:', error);
          this.loadingInventorySummary = false;
          this.toastService.error('Failed to load inventory summary');
          this.cdr.markForCheck();
        }
      });
  }

  private applyFilters(): void {
    let filtered = [...this.inventorySummaryItems];

    const itemType = InventorySummaryUtils.getItemTypeFromTab(this.activeTab);
    filtered = filtered.filter(item => item.itemType === itemType);

    this.filteredInventoryItems = filtered;
  }

  exportToExcel(): void {
    const columns: ExcelColumn[] = [
      {
        header: this.translateService.instant('inventorySummary.itemName'),
        key: 'itemName',
        width: 30
      },
      {
        header: this.translateService.instant('inventorySummary.itemNo'),
        key: 'itemNo',
        width: 15
      },
      {
        header: this.translateService.instant('inventorySummary.partNo'),
        key: 'partNo',
        width: 15,
        format: (value: string) => value || '-'
      },
      {
        header: this.translateService.instant('inventorySummary.nsn'),
        key: 'nsn',
        width: 15,
        format: (value: string) => value || '-'
      },
      {
        header: this.translateService.instant('inventorySummary.totalQty'),
        key: 'totalQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('inventorySummary.usedQty'),
        key: 'usedQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('inventorySummary.reservedQty'),
        key: 'reservedQuantityByOrdersOnProcessing',
        width: 18
      },
      {
        header: this.translateService.instant('inventorySummary.remainingQty'),
        key: 'remainingQuantity',
        width: 18
      },
      {
        header: this.translateService.instant('inventorySummary.totalLots'),
        key: 'totalLots',
        width: 12
      }
    ];

    const fileName = `Inventory_Summary_${this.activeTab.charAt(0).toUpperCase() + this.activeTab.slice(1)}`;

    this.importExportService.exportToExcel({
      fileName,
      sheetName: 'Summary',
      columns,
      data: this.filteredInventoryItems,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }
}

