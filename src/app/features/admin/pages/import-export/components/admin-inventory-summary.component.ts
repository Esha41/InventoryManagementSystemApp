import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Upload } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { InventorySummaryDataService } from '@inventory/services/inventory-summary-data.service';
import { ToastService } from '@services/toast.service';
import { ExcelColumn } from '@services/excel.service';
import { ImportExportService } from '@admin/services/import-export.service';
import { ItemInventorySummaryDto } from '@models/inventory.model';
import { InventorySummaryUtils } from '@warehouse/utils/inventory-summary.utils';
import { TranslationService } from '@services/translation.service';
import { LoadingStateComponent } from '@components/index';

/** Admin Import/Export tab: rolled-up inventory summary totals and Excel export (not the warehouse full-report page). */
@Component({
  selector: 'app-admin-inventory-summary',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    LoadingStateComponent
  ],
  providers: [InventorySummaryDataService],
  templateUrl: './admin-inventory-summary.component.html',
  styleUrls: ['./admin-inventory-summary.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminInventorySummaryComponent implements OnInit, OnDestroy {
  inventorySummaryItems: ItemInventorySummaryDto[] = [];
  filteredInventoryItems: ItemInventorySummaryDto[] = [];
  activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';
  loadingInventorySummary = false;

  readonly Upload = Upload;

  private destroy$ = new Subject<void>();

  constructor(
    private inventorySummaryDataService: InventorySummaryDataService,
    private toastService: ToastService,
    private importExportService: ImportExportService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) { }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get summaryItemCount(): number {
    return this.filteredInventoryItems.length;
  }

  /** Rolled-up totals for the current tab (no per-item table). */
  get summaryTotalLots(): number {
    return this.filteredInventoryItems.reduce((s, i) => s + (Number(i.totalLots) || 0), 0);
  }

  get summaryTotalQuantity(): number {
    return this.filteredInventoryItems.reduce((s, i) => s + (Number(i.totalQuantity) || 0), 0);
  }

  get summaryUsedQuantity(): number {
    return this.filteredInventoryItems.reduce((s, i) => s + (Number(i.usedQuantity) || 0), 0);
  }

  get summaryReservedQuantity(): number {
    return this.filteredInventoryItems.reduce(
      (s, i) => s + (Number(i.reservedQuantityByOrdersOnProcessing) || 0),
      0
    );
  }

  get summaryRemainingQuantity(): number {
    return this.filteredInventoryItems.reduce((s, i) => s + (Number(i.remainingQuantity) || 0), 0);
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
        header: 'Part No',
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

    this.translateService.get(['common.exportSuccess', 'toast.success']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }
}
