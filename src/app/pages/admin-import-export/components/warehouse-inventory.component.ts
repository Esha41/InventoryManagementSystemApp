import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Download, Upload, FileText } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { ImportDialogComponent } from '@components/import-dialog/import-dialog.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LoadingStateComponent } from '@components/index';
import { InventoryService } from '@services/inventory.service';
import { LookupService } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { ImportExportService } from '@services/import-export.service';
import { TemplateGenerationService } from '@services/template-generation.service';
import { InventoryDetailDto } from '@models/inventory.model';
import { LookupItem } from '@models/lookup.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';
import { ImportPreviewDialogComponent } from '@components/import-preview-dialog/import-preview-dialog.component';

@Component({
  selector: 'app-warehouse-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    ImportDialogComponent,
    ImportPreviewDialogComponent,
    DropdownComponent,
    LoadingStateComponent
  ],
  templateUrl: './warehouse-inventory.component.html'
})
export class WarehouseInventoryComponent implements OnInit, OnDestroy {
  depots: LookupItem[] = [];
  selectedDepotId: number | null = null;
  warehouseInventoryDetails: InventoryDetailDto[] = [];
  filteredWarehouseInventory: InventoryDetailDto[] = [];
  activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';
  loadingWarehouseInventory = false;
  showImportModal = false;
  showPreviewModal = false;
  previewData: any = null;

  readonly Download = Download;
  readonly Upload = Upload;
  readonly FileText = FileText;

  private destroy$ = new Subject<void>();

  constructor(
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private excelExportService: ExcelExportService,
    private importExportService: ImportExportService,
    private templateGenerationService: TemplateGenerationService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) { }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  ngOnInit(): void {
    this.loadDepots();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDepots(): void {
    this.lookupService.getDepots()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots) => {
          this.depots = depots;
          this.cdr.markForCheck();
        },
        error: () => {
          // Silently handle error - depots loading failure
        }
      });
  }

  getDepotOptions(): DropdownOption[] {
    return this.depots.map(depot => ({
      label: getLocalizedName(depot, getCurrentLang(this.translateService)) || `Depot ${depot.id}`,
      value: depot.id
    }));
  }

  onDepotChange(depotId: number | string | null): void {
    if (depotId === null || depotId === undefined) {
      this.selectedDepotId = null;
      return;
    }
    this.selectedDepotId = typeof depotId === 'string' ? parseInt(depotId, 10) : depotId;
    if (this.selectedDepotId) {
      this.loadWarehouseInventory();
    }
  }

  switchTab(tab: 'ammunition' | 'weapon' | 'explosive'): void {
    this.activeTab = tab;
    this.applyFilters();
  }

  loadWarehouseInventory(): void {
    if (!this.selectedDepotId) return;

    this.loadingWarehouseInventory = true;
    this.cdr.markForCheck();

    this.inventoryService.getWarehouseInventoryItems(this.selectedDepotId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inventoryDetails) => {
          this.warehouseInventoryDetails = inventoryDetails;
          this.applyFilters();
          this.loadingWarehouseInventory = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingWarehouseInventory = false;
          this.toastService.error('Failed to load warehouse inventory');
          this.cdr.markForCheck();
        }
      });
  }

  private applyFilters(): void {
    let filtered = [...this.warehouseInventoryDetails];

    if (this.activeTab === 'ammunition') {
      filtered = filtered.filter(d => {
        const type = this.normalizeItemType(d.item?.itemType);
        return type === 1;
      });
    } else if (this.activeTab === 'weapon') {
      filtered = filtered.filter(d => {
        const type = this.normalizeItemType(d.item?.itemType);
        return type === 2;
      });
    } else if (this.activeTab === 'explosive') {
      filtered = filtered.filter(d => {
        const type = this.normalizeItemType(d.item?.itemType);
        return type === 3;
      });
    }

    this.filteredWarehouseInventory = filtered;
  }

  private normalizeItemType(itemType: any): number | undefined {
    if (itemType === undefined || itemType === null) return undefined;
    if (typeof itemType === 'number') return itemType;
    if (typeof itemType === 'string') {
      const enumMap: { [key: string]: number } = {
        'Ammunition': 1,
        'Weapon': 2,
        'Explosive': 3,
        'Accessory': 4
      };
      if (enumMap[itemType] !== undefined) return enumMap[itemType];
      const parsed = parseInt(itemType, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return Number(itemType);
  }

  getItemName(detail: InventoryDetailDto): string {
    if (!detail) return 'Unknown Item';
    const lang = getCurrentLang(this.translateService);
    const localized = getLocalizedName(detail.item, lang);
    return localized || detail.item?.itemNo || 'Unknown Item';
  }

  onImportClick(): void {
    if (!this.selectedDepotId) {
      this.toastService.warning('Please select a depot first');
      return;
    }
    this.showImportModal = true;
    this.cdr.markForCheck();
  }

  closeImportModal(): void {
    this.showImportModal = false;
    this.cdr.markForCheck();
  }

  // Import methods

  onImportConfirmed(file: File): void {
    if (!this.selectedDepotId) {
      this.toastService.warning('Please select a depot first');
      return;
    }

    this.loadingWarehouseInventory = true;
    this.closeImportModal();
    this.cdr.markForCheck();

    // Call backend import endpoint - Excel parsing is now done on the backend
    this.inventoryService.importData(file, this.selectedDepotId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loadingWarehouseInventory = false;

          if (response.succeeded && response.data) {
            const result = response.data;
            const successCount = result.successCount || 0;
            const failureCount = result.failureCount || 0;
            const errors = result.errors || [];

            if (failureCount > 0 || errors.length > 0) {
              let msg = `Imported ${successCount} items. ${failureCount} failed.`;
              if (errors.length > 0 && errors.length <= 3) {
                msg += ` Errors: ${errors.slice(0, 3).map((e: any) => e.errorMessage || e).join('; ')}`;
              } else if (errors.length > 3) {
                msg += ` (${errors.length} errors found)`;
              }
              this.toastService.warning(msg);
            } else {
              this.toastService.success(`Imported ${successCount} items successfully.`);
            }
          } else {
            this.toastService.error(response.message || 'Import failed');
          }

          this.loadWarehouseInventory();
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          this.toastService.error('Failed to import inventory: ' + (error.message || 'Unknown error'));
          this.loadingWarehouseInventory = false;
          this.cdr.markForCheck();
        }
      });
  }

  onImportPreview(file: File): void {
    if (!this.selectedDepotId) {
      this.toastService.warning('Please select a depot first');
      return;
    }

    this.loadingWarehouseInventory = true;
    this.closeImportModal();
    this.cdr.markForCheck();

    this.inventoryService.importPreview(file, this.selectedDepotId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loadingWarehouseInventory = false;
          if (res.succeeded) {
            const result = res.data;
            this.previewData = {
              rows: result.successfulRecords.map((record: any, index: number) => ({
                rowNumber: index + 1,
                data: record,
                isValid: true,
                errors: []
              })).concat(
                result.errors.map((error: any, index: number) => ({
                  rowNumber: result.successfulRecords.length + index + 1,
                  data: {},
                  isValid: false,
                  errors: [error.errorMessage]
                }))
              ),
              totalRows: result.successCount + result.failureCount,
              validRows: result.successCount,
              invalidRows: result.failureCount,
              columns: result.successfulRecords.length > 0 ? this.getOrderedColumns(result.successfulRecords[0]) : []
            };
            this.showPreviewModal = true;
          } else {
            this.toastService.error(res.message || 'Preview failed');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingWarehouseInventory = false;
          this.toastService.error('Preview failed');
          this.cdr.markForCheck();
        }
      });
  }

  onPreviewConfirmed(validRows: any[]): void {
    this.showPreviewModal = false;
    this.loadingWarehouseInventory = true;
    this.cdr.markForCheck();

    this.toastService.success(`${validRows.length} rows will be imported`);
    this.loadingWarehouseInventory = false;
    this.loadWarehouseInventory();
    this.cdr.markForCheck();
  }

  onPreviewCancelled(): void {
    this.showPreviewModal = false;
    this.previewData = null;
    this.cdr.markForCheck();
  }

  /**
   * Get ordered columns for preview dialog
   * Matches the exact column order from backend InventoryService.GetColumnMappings (line 1580-1600)
   * This ensures consistency between downloaded templates and import preview
   */
  private getOrderedColumns(record: any): string[] {
    if (!record) return [];

    const allKeys = Object.keys(record);

    // Define column order based on backend GetColumnMappings
    // From InventoryService.GetColumnMappings
    const priorityOrder = [
      'itemName',
      'itemNo',
      'itemId',
      'lot',
      'supplier',
      'manufacturer',
      'country',
      'originalQuantity',
      'batchNo',
      'expiryDate',
      'readyForIssue',
      'invoiceNumber',
      'invoiceDate',
      'receivedDate',
      'notes'
    ];

    // Separate keys into priority (matching template) and remaining
    const priorityKeys = priorityOrder.filter(key => allKeys.includes(key));
    const remainingKeys = allKeys.filter(key => !priorityOrder.includes(key));

    // Return priority keys first (matching template order), then remaining keys
    return [...priorityKeys, ...remainingKeys];
  }

  downloadTemplate(): void {
    if (!this.selectedDepotId) {
      this.toastService.warning('Please select a depot first');
      return;
    }
    this.templateGenerationService.generateWarehouseInventoryTemplate(this.selectedDepotId);
  }

  exportToExcel(): void {
    if (!this.selectedDepotId) {
      this.toastService.warning('Please select a depot first');
      return;
    }

    const selectedDepot = this.depots.find(d => d.id === this.selectedDepotId);
    const depotName = selectedDepot
      ? getLocalizedName(selectedDepot, getCurrentLang(this.translateService)) || `Depot ${this.selectedDepotId}`
      : `Depot ${this.selectedDepotId}`;

    const columns: ExcelColumn[] = [
      {
        header: this.translateService.instant('warehouseInventory.itemName'),
        key: 'item',
        width: 30,
        format: (item) => this.getItemName({ item } as InventoryDetailDto)
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
        format: (date) => this.importExportService.formatDate(date)
      }
    ];

    const fileName = `${depotName}_Inventory_${this.activeTab}`;

    this.importExportService.exportToExcel({
      fileName,
      sheetName: this.activeTab.charAt(0).toUpperCase() + this.activeTab.slice(1),
      columns,
      data: this.filteredWarehouseInventory,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }
}

