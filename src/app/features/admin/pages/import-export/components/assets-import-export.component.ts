import { Component, OnInit, OnDestroy, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Download, Upload, FileText } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { ImportDialogComponent } from '@components/import-dialog/import-dialog.component';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { ToastService } from '@services/toast.service';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { ImportExportService } from '@services/import-export.service';
import { TemplateGenerationService } from '@services/template-generation.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { getLookupDisplayName } from '@utils/asset-list.utils';
import { TranslationService } from '@services/translation.service';
import { LoadingStateComponent } from '@components/index';
import { ImportPreviewDialogComponent } from '@components/import-preview-dialog/import-preview-dialog.component';
import { IImportableService } from '@core/interfaces/importable-service.interface';
import { ImportResult } from '@models/import-result.model';
import { APIOperationResponse } from '@models/api-response.model';

@Component({
  selector: 'app-assets-import-export',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    ImportDialogComponent,
    ImportPreviewDialogComponent,
    LoadingStateComponent
  ],
  templateUrl: './assets-import-export.component.html',
  styleUrls: ['./assets-import-export.component.css']
})
export class AssetsImportExportComponent implements OnInit, OnDestroy {
  @Input() activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';

  private _activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';

  assets: (AmmunitionReadDto | WeaponDto | ExplosiveDto)[] = [];
  filteredAssets: (AmmunitionReadDto | WeaponDto | ExplosiveDto)[] = [];
  loadingAssets = false;
  showImportModal = false;
  showPreviewModal = false;
  previewData: any = null;
  pendingImportFile: File | null = null; // Store file for import after preview confirmation
  isPreviewInProgress = false; // Prevent multiple simultaneous preview requests
  isImportInProgress = false; // Prevent multiple simultaneous import requests

  readonly Download = Download;
  readonly Upload = Upload;
  readonly FileText = FileText;

  private destroy$ = new Subject<void>();

  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
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
    if (this.activeTab) {
      this._activeTab = this.activeTab;
    }
    this.loadAssets();
  }

  get currentTab(): 'ammunition' | 'weapon' | 'explosive' {
    return this._activeTab;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  switchTab(tab: 'ammunition' | 'weapon' | 'explosive'): void {
    this._activeTab = tab;
    this.loadAssets();
  }

  loadAssets(): void {
    this.loadingAssets = true;
    this.cdr.markForCheck();

    const service = this.getService(this._activeTab);

    (service as any).getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any) => {
          // Service already returns the array directly, not wrapped in response
          if (Array.isArray(data)) {
            this.assets = data;
            this.filteredAssets = data;
          } else if (data && data.succeeded && Array.isArray(data.data)) {
            // Fallback: handle wrapped response if service returns it
            this.assets = data.data;
            this.filteredAssets = data.data;
          } else {
            this.assets = [];
            this.filteredAssets = [];
          }
          this.loadingAssets = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingAssets = false;
          this.toastService.error('Failed to load assets');
          this.cdr.markForCheck();
        }
      });
  }

  onImportClick(): void {
    this.showImportModal = true;
    this.cdr.markForCheck();
  }

  closeImportModal(): void {
    this.showImportModal = false;
    this.cdr.markForCheck();
  }

  onImportPreview(file: File): void {
    // Prevent multiple simultaneous preview requests
    if (this.isPreviewInProgress) {
      this.toastService.warning('Preview is already in progress. Please wait...');
      return;
    }

    // Clear previous preview data before starting new preview
    this.previewData = null;
    this.showPreviewModal = false;
    this.isPreviewInProgress = true;
    this.loadingAssets = true;
    this.closeImportModal();
    this.pendingImportFile = file; // Store file for later import
    this.cdr.markForCheck();

    const service = this.getService(this._activeTab);
    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    service.importPreview(file, currentLang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isPreviewInProgress = false;
          this.loadingAssets = false;

          if (!res || !res.succeeded || !res.data) {
            this.previewData = null;
            const errorMsg = res?.message || 'Preview failed';
            this.toastService.error(errorMsg);
            this.cdr.markForCheck();
            return;
          }

          const result = res.data;

          if (result) {
            // Ensure arrays exist
            const successfulRecords = Array.isArray(result.successfulRecords) ? result.successfulRecords : [];
            const errors = Array.isArray(result.errors) ? result.errors : [];

            // Create a map to track which rows have errors (by row number)
            const errorsByRow = new Map<number, { errors: string[], rowData: any }>();
            errors.forEach((error) => {
              const rowNum = error.rowNumber || 0;
              if (!errorsByRow.has(rowNum)) {
                errorsByRow.set(rowNum, { errors: [], rowData: error.rowData || {} });
              }
              const errorMsg = error.errorMessage || 'Unknown error';
              errorsByRow.get(rowNum)!.errors.push(errorMsg);
            });

            // Build preview rows
            const previewRows: any[] = [];

            // Process successful records - use rowNumber from backend if available, otherwise calculate
            successfulRecords.forEach((record: any, index: number) => {
              // Excel rows start at 2 (row 1 is header), so rowNumber should be index + 2
              // But if backend provides rowNumber, use that instead
              // Note: Backend ImportResult logic might need observation, assuming standard behavior
              const rowNum = (record as any).rowNumber || (index + 2);
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
            // (These are rows that failed validation and have rowData in the error)
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

            // Transform backend data to preview format
            this.previewData = {
              rows: previewRows,
              totalRows: previewRows.length,
              validRows: validRows,
              invalidRows: invalidRows,
              // Use headers directly from backend response for the Single Source of Truth
              columns: result.importHeaders && result.importHeaders.length > 0
                ? result.importHeaders
                : (previewRows.length > 0 && previewRows[0].data ? Object.keys(previewRows[0].data) : [])
            };
            this.showPreviewModal = true;
          }
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          this.isPreviewInProgress = false;
          this.loadingAssets = false;
          // Clear preview data on error
          this.previewData = null;
          const errorMessage = error?.error?.message || error?.message || 'Unknown error';
          this.toastService.error(`Preview failed: ${errorMessage}`);
          this.cdr.markForCheck();
        }
      });
  }

  onImportConfirmed(file: File): void {
    // Prevent multiple simultaneous import requests
    if (this.isImportInProgress) {
      this.toastService.warning('Import is already in progress. Please wait...');
      return;
    }

    this.isImportInProgress = true;
    this.loadingAssets = true;
    this.closeImportModal();
    this.cdr.markForCheck();

    const service = this.getService(this._activeTab);
    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    service.importData(file, currentLang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isImportInProgress = false;
          this.loadingAssets = false;
          if (res.succeeded && res.data) {
            const result = res.data;
            this.importExportService.handleImportResult({
              successCount: result.successCount ?? result.successfulRecords?.length ?? 0,
              failureCount: result.errors?.length ?? 0,
              errors: result.errors || []
            });
            this.loadAssets();
          } else {
            this.toastService.error(res.message || 'Import failed');
          }
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          this.isImportInProgress = false;
          this.loadingAssets = false;
          const errorMessage = error?.error?.message || error?.message || 'Unknown error';
          this.toastService.error(`Import failed: ${errorMessage}`);
          this.cdr.markForCheck();
        }
      });
  }

  downloadTemplate(): void {
    const service = this.getService(this._activeTab);
    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    // Use the service method for template generation
    service.generateImportTemplate(currentLang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          // Format filename: Asset_Import_Template_{Type}_{Lang}.xlsx
          const date = new Date().toISOString().split('T')[0];
          link.download = `Import_Template_${this._activeTab}_${currentLang}_${date}.xlsx`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          this.toastService.error('Failed to download template');
          console.error(err);
        }
      });
  }

  onPreviewConfirmed(validRows: any[]): void {
    this.showPreviewModal = false;
    this.previewData = null;

    // Validate that we have the file
    if (!this.pendingImportFile) {
      this.toastService.error('Import file not found. Please try uploading again.');
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
    this.loadingAssets = true;
    this.cdr.markForCheck();

    const service = this.getService(this._activeTab);
    const file = this.pendingImportFile;
    const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    try {
      const importObservable = service.importData(file, currentLang);

      importObservable
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: APIOperationResponse<ImportResult>) => {
            this.isImportInProgress = false;
            this.loadingAssets = false;
            this.pendingImportFile = null; // Clear the stored file

            if (res.succeeded && res.data) {
              const result = res.data;
              // Show import results using the import-export service
              this.importExportService.handleImportResult({
                successCount: result.successCount ?? result.successfulRecords?.length ?? 0,
                failureCount: result.errors?.length ?? 0,
                errors: result.errors || []
              });

              // Reload the assets list to show newly imported items
              this.loadAssets();
            } else {
              this.toastService.error(res.message || 'Import failed');
            }
            this.cdr.markForCheck();
          },
          error: (error: any) => {
            this.isImportInProgress = false;
            this.loadingAssets = false;
            this.pendingImportFile = null; // Clear the stored file

            const errorMessage = error?.error?.message || error?.message || error?.statusText || 'Unknown error';
            this.toastService.error(`Import failed: ${errorMessage}`);
            this.cdr.markForCheck();
          }
        });
    } catch (error) {
      this.isImportInProgress = false;
      this.loadingAssets = false;
      this.toastService.error('Failed to start import: ' + (error as any)?.message);
      this.cdr.markForCheck();
    }
  }

  onPreviewCancelled(): void {
    this.showPreviewModal = false;
    this.previewData = null;
    this.pendingImportFile = null; // Clear the stored file
    this.isPreviewInProgress = false; // Reset preview flag
    this.cdr.markForCheck();
  }

  exportToExcel(): void {
    if (this.filteredAssets.length === 0) {
      this.toastService.warning('No data available to export');
      return;
    }

    const columns = this.buildExportColumns();
    const fileName = `Asset_List_${this._activeTab.charAt(0).toUpperCase() + this._activeTab.slice(1)}`;

    this.importExportService.exportToExcel({
      fileName,
      sheetName: this._activeTab.charAt(0).toUpperCase() + this._activeTab.slice(1),
      columns,
      data: this.filteredAssets,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }

  private getService(tab: 'ammunition' | 'weapon' | 'explosive'): IImportableService {
    switch (tab) {
      case 'ammunition':
        return this.ammunitionService;
      case 'weapon':
        return this.weaponService;
      case 'explosive':
        return this.explosiveService;
      default:
        return this.ammunitionService;
    }
  }
  private buildExportColumns(): ExcelColumn[] {
    const columns: ExcelColumn[] = [
      {
        header: this.translateService.instant('assetList.table.name'),
        key: 'name',
        width: 30,
        format: (value: string) => value || '-'
      },
      {
        header: this.translateService.instant('assetList.table.itemNo'),
        key: 'itemNo',
        width: 15,
        format: (value: string) => value || '-'
      },
      {
        header: this.translateService.instant('assetList.table.partNo'),
        key: 'partNo',
        width: 15,
        format: (value: string) => value || '-'
      }
    ];

    if (this._activeTab === 'ammunition') {
      // Add ALL ammunition fields to match template
      columns.push(
        {
          header: this.translateService.instant('warehouseInventory.armNumber') || 'Arm Number',
          key: 'armNumber',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('assetList.table.nsn'),
          key: 'nsn',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('assetList.table.price'),
          key: 'price',
          width: 12,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('assetList.table.minimumQuantity'),
          key: 'minimumQuantity',
          width: 18,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.bulletDiameter') || 'Bullet Diameter',
          key: 'bulletDiameter',
          width: 15,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.caliberUnit') || 'Bullet Diameter Unit',
          key: 'bulletDiameterUnit',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.totalWeight') || 'Total Weight',
          key: 'totalWeight',
          width: 15,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.isLinked') || 'Is Linked',
          key: 'isLinked',
          width: 12,
          format: (value: boolean) => value ? 'Yes' : 'No'
        },
        {
          header: this.translateService.instant('warehouseInventory.primer') || 'Primer',
          key: 'primer',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('assetList.table.caseType'),
          key: 'caseType',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.propellant') || 'Propellant',
          key: 'propellant',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('warehouseInventory.compatibility') || 'Compatibility',
          key: 'compatibility',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('assetList.table.hazardDivision'),
          key: 'hazardDivision',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('addAsset.nature') || 'Nature Option',
          key: 'natureOption',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('addAsset.primaryPurpose') || 'Primary Purpose',
          key: 'primaryPurpos',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('addAsset.projectileColor') || 'Projectile Color',
          key: 'projectileColor',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('addAsset.projectileMaterial') || 'Projectile Material',
          key: 'projectailMaterial',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.unNumber') || 'UN Number',
          key: 'unNumber',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('weapon.distribution') || 'Distribution',
          key: 'distribution',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('weapon.referenceNo') || 'Reference No',
          key: 'referenceNo',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('weapon.classification') || 'Classification',
          key: 'classification',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.type') || 'Type',
          key: 'type',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.notes') || 'Notes',
          key: 'notes',
          width: 30,
          format: (value: string) => value || '-'
        }
      );
    } else if (this._activeTab === 'weapon') {
      // Add ALL weapon fields to match template
      columns.push(
        {
          header: this.translateService.instant('assetList.table.nsn'),
          key: 'nsn',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('assetList.table.price'),
          key: 'price',
          width: 12,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('assetList.table.minimumQuantity'),
          key: 'minimumQuantity',
          width: 18,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('addAsset.caliber'),
          key: 'caliber',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('weapon.caliberUnit') || 'Caliber Unit',
          key: 'caliberUnit',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.yearOfManufacture') || 'Year Of Manufacture',
          key: 'yearOfManufacture',
          width: 20,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('weapon.countryOfManufacture') || 'Country Of Manufacture',
          key: 'countryOfManufacture',
          width: 25,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.model') || 'Model',
          key: 'model',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('addAsset.unNumber'),
          key: 'unNumber',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('weapon.distribution') || 'Distribution',
          key: 'distribution',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('weapon.referenceNo') || 'Reference No',
          key: 'referenceNo',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('weapon.classification') || 'Classification',
          key: 'classification',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.type') || 'Type',
          key: 'type',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.notes') || 'Notes',
          key: 'notes',
          width: 30,
          format: (value: string) => value || '-'
        }
      );
    } else if (this._activeTab === 'explosive') {
      // Add ALL explosive fields to match template
      columns.push(
        {
          header: this.translateService.instant('assetList.table.nsn'),
          key: 'nsn',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('assetList.table.price'),
          key: 'price',
          width: 12,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('assetList.table.minimumQuantity'),
          key: 'minimumQuantity',
          width: 18,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: this.translateService.instant('addAsset.unNumber'),
          key: 'unNumber',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('addAsset.unit') || 'Unit',
          key: 'unit',
          width: 15,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.distribution') || 'Distribution',
          key: 'distribution',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('weapon.referenceNo') || 'Reference No',
          key: 'referenceNo',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('assetList.table.hazardDivision') || 'Hazard Division',
          key: 'hazardDivision',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.classification') || 'Classification',
          key: 'classification',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.type') || 'Type',
          key: 'type',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: this.translateService.instant('weapon.notes') || 'Notes',
          key: 'notes',
          width: 30,
          format: (value: string) => value || '-'
        }
      );
    }

    return columns;
  }
}

