import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal, ChangeDetectionStrategy } from '@angular/core';
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
import { IImportableService } from '@core/interfaces/importable-service.interface';
import { APIOperationResponse } from '@models/api-response.model';
import { ImportResult } from '@models/import-result.model';
import { ErrorHandler } from '@utils/error-handler.utils';

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
  templateUrl: './warehouse-inventory.component.html',
  styleUrls: ['./warehouse-inventory.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
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

    // For weapons, load assets; for ammunition/explosives, use paginated endpoint (same as warehouse page)
    if (this.activeTab === 'weapon') {
      this.assetService.getByDepotId(this.selectedDepotId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (assets) => {
            // All assets in depot are weapons - no itemType filter needed
            this.warehouseAssets = assets ?? [];
            this.applyFilters();
            this.loadingWarehouseInventory = false;
            this.cdr.markForCheck();
          },
          error: (error: unknown) => {
            this.loadingWarehouseInventory = false;
            this.toastService.error(ErrorHandler.extractErrorMessage(error, 'Failed to load warehouse assets'));
            this.cdr.markForCheck();
          }
        });
    } else {
      const itemType = this.activeTab === 'ammunition' ? 1 : 3;
      this.inventoryService.getWarehouseInventoryDetailsForExport(this.selectedDepotId, itemType)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (inventoryDetails) => {
            this.warehouseInventoryDetails = inventoryDetails ?? [];
            this.applyFilters();
            this.loadingWarehouseInventory = false;
            this.cdr.markForCheck();
          },
          error: (error: unknown) => {
            this.loadingWarehouseInventory = false;
            this.toastService.error(ErrorHandler.extractErrorMessage(error, 'Failed to load warehouse inventory'));
            this.cdr.markForCheck();
          }
        });
    }
  }

  private applyFilters(): void {
    if (this.activeTab === 'weapon') {
      this.filteredWarehouseAssets = [...this.warehouseAssets];
    } else {
      // Ammunition/explosive data is already filtered by itemType in loadWarehouseInventory
      this.filteredWarehouseInventory = [...this.warehouseInventoryDetails];
    }
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
    // Clear any pending import file before opening the dialog
    this.pendingImportFile = null;
    this.previewData = null;
    this.showImportModal = true;
    this.cdr.markForCheck();
  }

  closeImportModal(): void {
    // Clear any pending import file when closing the dialog
    this.pendingImportFile = null;
    this.showImportModal = false;
    this.cdr.markForCheck();
  }

  // Import methods

  onImportConfirmed(file: File): void {
    if (!this.selectedDepotId) {
      this.toastService.warning('Please select a depot first');
      return;
    }

    if (this.isImportInProgress) {
      this.toastService.warning('Import is already in progress. Please wait...');
      return;
    }

    this.isImportInProgress = true;
    this.loadingWarehouseInventory = true;
    this.closeImportModal();
    this.cdr.markForCheck();

    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const service = this.getService();

    service.importData(file, currentLang, this.selectedDepotId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isImportInProgress = false;
          this.loadingWarehouseInventory = false;
          this.pendingImportFile = null;

          if (res && res.succeeded && res.data) {
            const result = res.data;
            this.importExportService.handleImportResult({
              successCount: result.successfulRecords?.length || 0,
              failureCount: result.errors?.length || 0,
              errors: result.errors || []
            });

            this.loadWarehouseInventory();
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.isImportInProgress = false;
          this.loadingWarehouseInventory = false;
          this.pendingImportFile = null;
          const entityType = this.activeTab === 'weapon' ? 'assets' : 'inventory';
          this.toastService.error(`Failed to import ${entityType}: ` + ErrorHandler.extractErrorMessage(error, 'Unknown error'));
          this.cdr.markForCheck();
        }
      });
  }

  onImportPreview(file: File): void {
    if (!this.selectedDepotId) {
      this.toastService.warning('Please select a depot first');
      return;
    }

    if (this.isPreviewInProgress) {
      this.toastService.warning('Preview is already in progress. Please wait...');
      return;
    }

    this.previewData = null;
    this.showPreviewModal = false;
    this.isPreviewInProgress = true;
    this.loadingWarehouseInventory = true;
    this.closeImportModal();
    this.pendingImportFile = file;
    this.pendingDepotId = this.selectedDepotId;
    this.cdr.markForCheck();

    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const service = this.getService();

    service.importPreview(file, currentLang, this.selectedDepotId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isPreviewInProgress = false;
          this.loadingWarehouseInventory = false;

          if (res && res.succeeded && res.data) {
            const result = res.data;
            const successfulRecords = Array.isArray(result.successfulRecords) ? result.successfulRecords : [];
            const errors = result.errors || [];

            const errorsByRow = new Map<number, { errors: string[], rowData: any }>();
            errors.forEach((error: any) => {
              const rowNum = error.rowNumber || 0;
              if (!errorsByRow.has(rowNum)) {
                errorsByRow.set(rowNum, { errors: [], rowData: error.rowData || {} });
              }
              errorsByRow.get(rowNum)!.errors.push(error.errorMessage || 'Unknown error');
            });

            const previewRows: any[] = [];
            successfulRecords.forEach((record: any, index: number) => {
              const rowNum = (record as any).rowNumber || (index + 2);
              const errorInfo = errorsByRow.get(rowNum);
              previewRows.push({
                rowNumber: rowNum,
                data: record,
                isValid: !errorInfo || errorInfo.errors.length === 0,
                errors: errorInfo ? errorInfo.errors : []
              });
              if (errorInfo) errorsByRow.delete(rowNum);
            });

            errorsByRow.forEach((errorInfo, rowNum) => {
              previewRows.push({
                rowNumber: rowNum,
                data: errorInfo.rowData || {},
                isValid: false,
                errors: errorInfo.errors
              });
            });

            previewRows.sort((a, b) => a.rowNumber - b.rowNumber);

            this.previewData = {
              rows: previewRows,
              totalRows: previewRows.length,
              validRows: previewRows.filter(r => r.isValid).length,
              invalidRows: previewRows.filter(r => !r.isValid).length,
              columns: result.importHeaders && result.importHeaders.length > 0
                ? result.importHeaders
                : (previewRows.length > 0 ? Object.keys(previewRows[0].data) : [])
            };
            this.showPreviewModal = true;
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.isPreviewInProgress = false;
          this.loadingWarehouseInventory = false;
          this.previewData = null;
          this.toastService.error(`Preview failed: ${ErrorHandler.extractErrorMessage(error, 'Unknown error')}`);
          this.cdr.markForCheck();
        }
      });
  }

  onPreviewConfirmed(validRows: any[]): void {
    this.showPreviewModal = false;
    this.previewData = null;

    if (!this.pendingImportFile) {
      this.toastService.error('Import file not found. Please try uploading again.');
      this.cdr.markForCheck();
      return;
    }

    if (this.isImportInProgress) {
      this.toastService.warning('Import is already in progress. Please wait...');
      this.cdr.markForCheck();
      return;
    }

    this.onImportConfirmed(this.pendingImportFile);
  }

  onPreviewCancelled(): void {
    this.showPreviewModal = false;
    this.previewData = null;
    this.pendingImportFile = null;
    this.pendingDepotId = null;
    this.isPreviewInProgress = false;
    this.cdr.markForCheck();
  }

  private getService(): IImportableService {
    return this.activeTab === 'weapon' ? this.assetService : this.inventoryService;
  }

  downloadTemplate(): void {
    if (!this.selectedDepotId) {
      this.toastService.warning('Please select a depot first');
      return;
    }

    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const service = this.getService();

    service.generateImportTemplate(currentLang, this.selectedDepotId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const fileName = this.activeTab === 'weapon'
            ? `Weapon_Asset_Import_Template_Depot_${this.selectedDepotId}.xlsx`
            : `Inventory_Import_Template_Depot_${this.selectedDepotId}.xlsx`;

          saveAs(blob, fileName);
          this.toastService.success('Template downloaded successfully');
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Failed to download template'));
          this.cdr.markForCheck();
        }
      });
  }

  exportToExcel(): void {
    if (!this.selectedDepotId) {
      this.toastService.warning('Please select a depot first');
      return;
    }

    const hasData = this.activeTab === 'weapon'
      ? this.filteredWarehouseAssets.length > 0
      : this.filteredWarehouseInventory.length > 0;
    if (!hasData) {
      this.toastService.warning('No data available to export');
      return;
    }

    const selectedDepot = this.depots.find(d => d.id === this.selectedDepotId);
    const depotName = selectedDepot
      ? getLocalizedName(selectedDepot, getCurrentLang(this.translateService)) || `Depot ${this.selectedDepotId}`
      : `Depot ${this.selectedDepotId}`;

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
          header: this.translateService.instant('warehouseInventory.serialNumber') || 'Serial Number',
          key: 'serialNumber',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.rfidTag') || 'RFID',
          key: 'rfid',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('assetDetails.purchaseDate') || 'Purchase Date',
          key: 'purchaseDate',
          width: 15,
          format: (date: any) => this.importExportService.formatDate(date)
        },
        {
          header: this.translateService.instant('assetDetails.warrantyExpiryDate') || 'Warranty Expiry Date',
          key: 'warrantyExpiryDate',
          width: 20,
          format: (date: any) => this.importExportService.formatDate(date)
        },
        {
          header: this.translateService.instant('assetDetails.purchasePrice') || 'Purchase Price',
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
          header: this.translateService.instant('weapon.yearOfManufacture') || 'Year Of Manufacture',
          key: 'item.yearOfManufacture',
          width: 20,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('weapon.countryOfManufacture') || 'Country Of Manufacture',
          key: 'item.countryOfManufacture',
          width: 25,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.model') || 'Model',
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
          header: this.translateService.instant('weapon.distribution') || 'Distribution',
          key: 'item.distribution',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('weapon.referenceNo') || 'Reference No',
          key: 'item.referenceNo',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.location') || 'Location',
          key: 'location',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.status') || 'Status',
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
          header: this.translateService.instant('warehouseInventory.notes') || 'Notes',
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
          header: this.translateService.instant('common.supplier') || 'Supplier',
          key: 'supplier',
          width: 20,
          format: (supplier: any) => getLocalizedName(supplier, getCurrentLang(this.translateService)) || '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.lot') || 'Lot',
          key: 'lot',
          width: 10,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.batchNo') || 'Batch No',
          key: 'batchNo',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.originalQty') || 'Original Quantity',
          key: 'originalQuantity',
          width: 15,
          format: (value: number) => value ? value.toString() : '0'
        },
        {
          header: this.translateService.instant('warehouseInventory.currentQty') || 'Current Quantity',
          key: 'currentQuantity',
          width: 15,
          format: (value: number) => value ? value.toString() : '0'
        },
        {
          header: this.translateService.instant('warehouseInventory.usedQty') || 'Used Quantity',
          key: 'usedQuantity',
          width: 15,
          format: (value: number) => value ? value.toString() : '0'
        },
        {
          header: this.translateService.instant('warehouseInventory.remainingQty') || 'Remaining Quantity',
          key: 'remainingQuantity',
          width: 15,
          format: (value: number) => value ? value.toString() : '0'
        },
        {
          header: this.translateService.instant('warehouseInventory.expiryDate') || 'Expiry Date',
          key: 'expiryDate',
          width: 15,
          format: (date: any) => this.importExportService.formatDate(date)
        },
        {
          header: this.translateService.instant('common.manufacturer') || 'Manufacturer',
          key: 'manufacturer',
          width: 20,
          format: (manufacturer: any) => getLocalizedName(manufacturer, getCurrentLang(this.translateService)) || '-'
        },
        {
          header: this.translateService.instant('common.country') || 'Country',
          key: 'country',
          width: 20,
          format: (country: any) => getLocalizedName(country, getCurrentLang(this.translateService)) || '-'
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

