import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal } from '@angular/core';
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
import { AssetService } from '@services/asset.service';
import { LookupService } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { ImportExportService } from '@services/import-export.service';
import { TemplateGenerationService } from '@services/template-generation.service';
import { InventoryDetailDto } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { LookupItem } from '@models/lookup.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { getLookupDisplayName } from '@utils/asset-list.utils';
import { TranslationService } from '@services/translation.service';
import { ImportPreviewDialogComponent } from '@components/import-preview-dialog/import-preview-dialog.component';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-warehouse-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
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
  warehouseAssets: AssetDto[] = [];
  filteredWarehouseAssets: AssetDto[] = [];
  activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';
  loadingWarehouseInventory = false;
  showImportModal = false;
  showPreviewModal = false;
  previewData: any = null;
  pendingImportFile: File | null = null; // Store file for import after preview confirmation
  pendingDepotId: number | null = null; // Store depot ID for import after preview confirmation
  isPreviewInProgress = false; // Prevent multiple simultaneous preview requests
  isImportInProgress = false; // Prevent multiple simultaneous import requests

  readonly Download = Download;
  readonly Upload = Upload;
  readonly FileText = FileText;

  private destroy$ = new Subject<void>();

  constructor(
    private inventoryService: InventoryService,
    private assetService: AssetService,
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
    // Reload data when switching tabs to ensure we have the right data type
    if (this.selectedDepotId) {
      this.loadWarehouseInventory();
    } else {
      this.applyFilters();
    }
  }

  loadWarehouseInventory(): void {
    if (!this.selectedDepotId) {
      return;
    }

    this.loadingWarehouseInventory = true;
    this.cdr.markForCheck();

    // For weapons, load assets; for ammunition/explosives, load inventory
    if (this.activeTab === 'weapon') {
      this.assetService.getByDepotId(this.selectedDepotId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (assets) => {
            // Filter assets to only include weapons (itemType === 2)
            this.warehouseAssets = assets.filter(asset => {
              const type = this.normalizeItemType(asset.item?.itemType);
              return type === 2;
            });
            this.applyFilters();
            this.loadingWarehouseInventory = false;
            this.cdr.markForCheck();
          },
          error: (error: any) => {
            this.loadingWarehouseInventory = false;
            this.toastService.error('Failed to load warehouse assets');
            this.cdr.markForCheck();
          }
        });
    } else {
      this.inventoryService.getWarehouseInventoryItems(this.selectedDepotId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (inventoryDetails) => {
            this.warehouseInventoryDetails = inventoryDetails;
            this.applyFilters();
            this.loadingWarehouseInventory = false;
            this.cdr.markForCheck();
          },
          error: (error: any) => {
            this.loadingWarehouseInventory = false;
            this.toastService.error('Failed to load warehouse inventory');
            this.cdr.markForCheck();
          }
        });
    }
  }

  private applyFilters(): void {
    if (this.activeTab === 'weapon') {
      // For weapons, use assets (already filtered by weapon type in loadWarehouseInventory)
      this.filteredWarehouseAssets = [...this.warehouseAssets];
    } else {
      // For ammunition/explosives, use inventory
      let filtered = [...this.warehouseInventoryDetails];

      if (this.activeTab === 'ammunition') {
        filtered = filtered.filter(d => {
          const type = this.normalizeItemType(d.item?.itemType);
          return type === 1;
        });
      } else if (this.activeTab === 'explosive') {
        filtered = filtered.filter(d => {
          const type = this.normalizeItemType(d.item?.itemType);
          return type === 3;
        });
      }

      this.filteredWarehouseInventory = filtered;
    }
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

    // Prevent multiple simultaneous import requests
    if (this.isImportInProgress) {
      this.toastService.warning('Import is already in progress. Please wait...');
      return;
    }

    this.isImportInProgress = true;
    this.loadingWarehouseInventory = true;
    this.closeImportModal();
    this.cdr.markForCheck();

    // For weapons, use asset import (includes serial number, RFID, asset tag, etc.)
    // For ammunition/explosives, use inventory import (includes lots, batches, quantities)
    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const importService = this.activeTab === 'weapon'
      ? this.assetService.importData(file, this.selectedDepotId, currentLang)
      : this.inventoryService.importData(file, this.selectedDepotId, currentLang);

    importService
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.isImportInProgress = false;
          this.loadingWarehouseInventory = false;

          // Handle both wrapped and unwrapped responses
          let result: any;
          if (response?.succeeded !== undefined) {
            // Wrapped response
            if (!response.succeeded || !response.data) {
              this.toastService.error(response.message || 'Import failed');
              this.cdr.markForCheck();
              return;
            }
            result = response.data;
          } else {
            // Unwrapped response
            if ((response as any)?.successCount !== undefined || (response as any)?.successfulRecords !== undefined || (response as any)?.errors !== undefined) {
              result = response;
            } else {
              this.toastService.error('Unexpected response format from server');
              this.cdr.markForCheck();
              return;
            }
          }

          if (result) {
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
          }

          this.loadWarehouseInventory();
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          this.isImportInProgress = false;
          const entityType = this.activeTab === 'weapon' ? 'assets' : 'inventory';
          this.toastService.error(`Failed to import ${entityType}: ` + (error.message || 'Unknown error'));
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

    // Prevent multiple simultaneous preview requests
    if (this.isPreviewInProgress) {
      this.toastService.warning('Preview is already in progress. Please wait...');
      return;
    }

    // Clear previous preview data before starting new preview
    this.previewData = null;
    this.showPreviewModal = false;
    this.isPreviewInProgress = true;
    this.loadingWarehouseInventory = true;
    this.closeImportModal();
    this.pendingImportFile = file; // Store file for later import
    this.pendingDepotId = this.selectedDepotId; // Store depot ID for later import
    this.cdr.markForCheck();

    // For weapons, use asset preview (includes serial number, RFID, asset tag, etc.)
    // For ammunition/explosives, use inventory preview (includes lots, batches, quantities)
    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const previewService = this.activeTab === 'weapon'
      ? this.assetService.importPreview(file, this.selectedDepotId, currentLang)
      : this.inventoryService.importPreview(file, this.selectedDepotId, currentLang);

    previewService
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.isPreviewInProgress = false;
          this.loadingWarehouseInventory = false;

          // Check if response is valid
          if (!res) {
            this.previewData = null;
            this.toastService.error('Invalid response from server');
            this.cdr.markForCheck();
            return;
          }

          // Handle both wrapped (APIOperationResponse) and unwrapped responses
          // If response has 'succeeded' property, it's wrapped; otherwise it's the data directly
          let result: any;
          if (res.succeeded !== undefined) {
            // Wrapped response: {succeeded: true, data: {...}}
            if (!res.succeeded || !res.data) {
              this.previewData = null;
              const errorMsg = res.message || res.Message || 'Preview failed';
              this.toastService.error(errorMsg);
              this.cdr.markForCheck();
              return;
            }
            result = res.data;
          } else {
            // Unwrapped response: the data is directly in res
            // Check if it looks like ImportResult structure
            if (res.successfulRecords !== undefined || res.errors !== undefined || res.successCount !== undefined) {
              result = res;
            } else {
              this.previewData = null;
              this.toastService.error('Unexpected response format from server');
              this.cdr.markForCheck();
              return;
            }
          }

          if (result) {
            // Ensure arrays exist
            const successfulRecords = Array.isArray(result.successfulRecords) ? result.successfulRecords : [];
            const errors = Array.isArray(result.errors) ? result.errors : [];

            // Create a map to track which rows have errors (by row number)
            const errorsByRow = new Map<number, { errors: string[], rowData: any }>();
            errors.forEach((error: any) => {
              const rowNum = error.rowNumber || error.RowNumber || 0;
              if (!errorsByRow.has(rowNum)) {
                errorsByRow.set(rowNum, { errors: [], rowData: error.rowData || error.RowData || {} });
              }
              const errorMsg = error.errorMessage || error.ErrorMessage || 'Unknown error';
              errorsByRow.get(rowNum)!.errors.push(errorMsg);
            });

            // Build preview rows with proper Excel row numbers
            const previewRows: any[] = [];

            // Process successful records - use rowNumber from backend if available, otherwise calculate
            successfulRecords.forEach((record: any, index: number) => {
              // Excel rows start at 2 (row 1 is header), so rowNumber should be index + 2
              // But if backend provides rowNumber, use that instead
              const rowNum = record.rowNumber || record.RowNumber || (index + 2);
              const errorInfo = errorsByRow.get(rowNum);

              previewRows.push({
                rowNumber: rowNum,
                data: record,
                isValid: !errorInfo || errorInfo.errors.length === 0,
                errors: errorInfo ? errorInfo.errors : []
              });

              // Remove from errorsByRow since we've processed it
              if (errorInfo) {
                errorsByRow.delete(rowNum);
              }
            });

            // Process errors that don't have corresponding successful records
            errorsByRow.forEach((errorInfo, rowNum) => {
              previewRows.push({
                rowNumber: rowNum,
                data: errorInfo.rowData || {},
                isValid: false,
                errors: errorInfo.errors
              });
            });

            // Sort by row number to maintain Excel row order
            previewRows.sort((a, b) => a.rowNumber - b.rowNumber);

            // Calculate valid/invalid counts
            const validRows = previewRows.filter(r => r.isValid).length;
            const invalidRows = previewRows.filter(r => !r.isValid).length;

            this.previewData = {
              rows: previewRows,
              totalRows: previewRows.length,
              validRows: validRows,
              invalidRows: invalidRows,
              columns: previewRows.length > 0 && previewRows[0].data ? this.getOrderedColumns(previewRows[0].data) : []
            };
            this.showPreviewModal = true;
          }
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          this.isPreviewInProgress = false;
          this.loadingWarehouseInventory = false;
          // Clear preview data on error
          this.previewData = null;
          const errorMessage = error?.error?.message || error?.message || 'Unknown error';
          this.toastService.error(`Preview failed: ${errorMessage}`);
          this.cdr.markForCheck();
        }
      });
  }

  onPreviewConfirmed(validRows: any[]): void {
    this.showPreviewModal = false;
    this.previewData = null;

    // Validate that we have the file and depot ID
    if (!this.pendingImportFile || !this.pendingDepotId) {
      this.toastService.error('Import file or depot not found. Please try uploading again.');
      this.cdr.markForCheck();
      return;
    }

    // Prevent multiple simultaneous import requests
    if (this.isImportInProgress) {
      this.toastService.warning('Import is already in progress. Please wait...');
      this.cdr.markForCheck();
      return;
    }

    this.isImportInProgress = true;
    this.loadingWarehouseInventory = true;
    this.cdr.markForCheck();

    const file = this.pendingImportFile;
    const depotId = this.pendingDepotId;
    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    // For weapons, use asset import; for ammunition/explosives, use inventory import
    const importService = this.activeTab === 'weapon'
      ? this.assetService.importData(file, depotId, currentLang)
      : this.inventoryService.importData(file, depotId, currentLang);

    importService
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const resp = response as any;
          this.isImportInProgress = false;
          this.loadingWarehouseInventory = false;
          this.pendingImportFile = null; // Clear the stored file
          this.pendingDepotId = null; // Clear the stored depot ID

          // Handle both wrapped and unwrapped responses
          // Use resp (already cast to any above) for all checks
          let result: any;
          if (resp?.succeeded !== undefined) {
            // Wrapped response
            if (!resp.succeeded || !resp.data) {
              this.toastService.error(resp.message || 'Import failed');
              this.cdr.markForCheck();
              return;
            }
            result = resp.data;
          } else {
            // Unwrapped response - check for ImportResult properties
            if (resp?.successCount !== undefined || resp?.successfulRecords !== undefined || resp?.errors !== undefined) {
              result = resp;
            } else {
              this.toastService.error('Unexpected response format from server');
              this.cdr.markForCheck();
              return;
            }
          }

          if (result) {
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

            this.loadWarehouseInventory();
          }
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          this.isImportInProgress = false;
          this.loadingWarehouseInventory = false;
          this.pendingImportFile = null; // Clear the stored file
          this.pendingDepotId = null; // Clear the stored depot ID

          const entityType = this.activeTab === 'weapon' ? 'assets' : 'inventory';
          const errorMessage = error?.error?.message || error?.message || error?.statusText || 'Unknown error';
          this.toastService.error(`Failed to import ${entityType}: ${errorMessage}`);
          this.cdr.markForCheck();
        }
      });
  }

  onPreviewCancelled(): void {
    this.showPreviewModal = false;
    this.previewData = null;
    this.pendingImportFile = null; // Clear the stored file
    this.pendingDepotId = null; // Clear the stored depot ID
    this.isPreviewInProgress = false; // Reset preview flag
    this.cdr.markForCheck();
  }

  /**
   * Get ordered columns for preview dialog
   * Matches the exact column order from backend GetColumnMappings
   * For weapons: Uses AssetService.GetColumnMappings (serial number, RFID, asset tag, etc.)
   * For ammunition/explosives: Uses InventoryService.GetColumnMappings (lots, batches, quantities)
   */
  private getOrderedColumns(record: any): string[] {
    if (!record) return [];

    const allKeys = Object.keys(record);

    // Define column order based on backend GetColumnMappings
    let priorityOrder: string[];

    if (this.activeTab === 'weapon') {
      // Asset import columns (from AssetService.GetColumnMappings)
      priorityOrder = [
        'itemName',
        'itemNo',
        'itemId',
        'serialNumber',
        'rfid',
        'assetTag',
        'purchaseDate',
        'warrantyExpiryDate',
        'condition',
        'purchasePrice',
        'notes'
      ];
    } else {
      // Inventory import columns (from InventoryService.GetColumnMappings)
      priorityOrder = [
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
    }

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

    // For weapons, use asset template (includes serial number, RFID, asset tag, etc.)
    // For ammunition/explosives, use inventory template (includes lots, batches, quantities)
    if (this.activeTab === 'weapon') {
      const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
      this.assetService.downloadImportTemplate(this.selectedDepotId, currentLang)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (blob) => {
            const fileName = `Asset_Import_Template_Depot_${this.selectedDepotId}_${new Date().getTime()}.xlsx`;
            saveAs(blob, fileName);
            this.toastService.success('Asset template downloaded successfully');
          },
          error: () => {
            this.toastService.error('Failed to download asset template. Please try again.');
          }
        });
    } else {
      this.templateGenerationService.generateWarehouseInventoryTemplate(this.selectedDepotId);
    }
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

    // For weapons, export assets with serial numbers, RFID, etc.
    // For ammunition/explosives, export inventory with lots, batches, quantities
    if (this.activeTab === 'weapon') {
      const columns: ExcelColumn[] = [
        {
          header: this.translateService.instant('warehouseInventory.itemName') || 'Item Name',
          key: 'item',
          width: 30,
          format: (item: any) => {
            if (!item) return '-';
            const lang = getCurrentLang(this.translateService);
            return getLocalizedName(item, lang) || item.itemNo || '-';
          }
        },
        {
          header: this.translateService.instant('warehouseInventory.itemNo') || 'Item No',
          key: 'item.itemNo',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: 'Serial Number',
          key: 'serialNumber',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: 'RFID',
          key: 'rfid',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: 'Asset Tag',
          key: 'assetTag',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: 'Purchase Date',
          key: 'purchaseDate',
          width: 15,
          format: (date) => this.importExportService.formatDate(date)
        },
        {
          header: 'Warranty Expiry Date',
          key: 'warrantyExpiryDate',
          width: 20,
          format: (date) => this.importExportService.formatDate(date)
        },
        {
          header: 'Condition',
          key: 'condition',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: 'Purchase Price',
          key: 'purchasePrice',
          width: 15,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('assetList.table.nsn') || 'NSN',
          key: 'item.nsn',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('addAsset.caliber') || 'Caliber',
          key: 'item.caliber',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: 'Caliber Unit',
          key: 'item.caliberUnit',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Year Of Manufacture',
          key: 'item.yearOfManufacture',
          width: 20,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: 'Country Of Manufacture',
          key: 'item.countryOfManufacture',
          width: 25,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Model',
          key: 'item.model',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('addAsset.unNumber') || 'UN Number',
          key: 'item.unNumber',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: 'Distribution',
          key: 'item.distribution',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: 'Reference No',
          key: 'item.referenceNo',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: 'Location',
          key: 'location',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: 'Status',
          key: 'status',
          width: 15,
          format: (status: number) => {
            const statusMap: { [key: number]: string } = {
              1: 'Available',
              2: 'In Use',
              3: 'Under Maintenance',
              4: 'Retired'
            };
            return status ? (statusMap[status] || '-') : '-';
          }
        },
        {
          header: 'Notes',
          key: 'notes',
          width: 30,
          format: (value: string) => value || '-'
        }
      ];

      const fileName = `${depotName}_Assets_Weapons`;

      this.importExportService.exportToExcel({
        fileName,
        sheetName: 'Weapons',
        columns,
        data: this.filteredWarehouseAssets,
        includeTimestamp: true
      });
    } else {
      // Export inventory for ammunition/explosives
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
        },
        {
          header: this.translateService.instant('common.manufacturer') || 'Manufacturer',
          key: 'manufacturer',
          width: 20,
          format: (manufacturer) => getLocalizedName(manufacturer, getCurrentLang(this.translateService)) || '-'
        },
        {
          header: this.translateService.instant('common.country') || 'Country',
          key: 'country',
          width: 20,
          format: (country) => getLocalizedName(country, getCurrentLang(this.translateService)) || '-'
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
    }

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }
}

