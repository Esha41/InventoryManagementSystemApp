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

@Component({
  selector: 'app-assets-import-export',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    ImportDialogComponent,
    ImportPreviewDialogComponent,
    LoadingStateComponent
  ],
  templateUrl: './assets-import-export.component.html'
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

    service.getAll()
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
    this.loadingAssets = true;
    this.closeImportModal();
    this.cdr.markForCheck();

    const service = this.getService(this._activeTab) as any;

    service.importPreview(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loadingAssets = false;
          if (res.succeeded) {
            const result = res.data;

            // Create a map to track which rows have errors (by row number)
            const errorsByRow = new Map<number, { errors: string[], rowData: any }>();
            result.errors.forEach((error: any) => {
              const rowNum = error.rowNumber || 0;
              if (!errorsByRow.has(rowNum)) {
                errorsByRow.set(rowNum, { errors: [], rowData: error.rowData || {} });
              }
              errorsByRow.get(rowNum)!.errors.push(error.errorMessage || 'Unknown error');
            });

            // Build preview rows
            const previewRows: any[] = [];
            let currentRowNumber = 2; // Excel rows start at 2 (1 is header)

            // Process successful records
            result.successfulRecords.forEach((record: any, index: number) => {
              const rowNum = currentRowNumber + index;
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

            // Sort by row number
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
              columns: previewRows.length > 0 && previewRows[0].data ? this.getOrderedColumns(previewRows[0].data) : []
            };
            this.showPreviewModal = true;
          } else {
            this.toastService.error(res.message || 'Preview failed');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingAssets = false;
          this.toastService.error('Preview failed');
          this.cdr.markForCheck();
        }
      });
  }

  onImportConfirmed(file: File): void {
    this.loadingAssets = true;
    this.closeImportModal();
    this.cdr.markForCheck();

    const service = this.getService(this._activeTab) as any;

    service.importData(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loadingAssets = false;
          if (res.succeeded) {
            const result = res.data;
            this.importExportService.handleImportResult({
              successCount: result.successCount || 0,
              failureCount: result.failureCount || 0,
              errors: result.errors || []
            });
            this.loadAssets();
          } else {
            this.toastService.error(res.message || 'Import failed');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingAssets = false;
          this.toastService.error('Import failed');
          this.cdr.markForCheck();
        }
      });
  }

  downloadTemplate(): void {
    this.templateGenerationService.generateAssetTemplate(this._activeTab);
  }

  onPreviewConfirmed(validRows: any[]): void {
    this.showPreviewModal = false;
    this.loadingAssets = true;
    this.cdr.markForCheck();

    // TODO: Send the validated/edited rows to the backend for final import
    // For now, we'll just show a success message
    this.toastService.success(`${validRows.length} rows will be imported`);
    this.loadingAssets = false;
    this.loadAssets();
    this.cdr.markForCheck();
  }

  onPreviewCancelled(): void {
    this.showPreviewModal = false;
    this.previewData = null;
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

  private getService(tab: 'ammunition' | 'weapon' | 'explosive'): any {
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

  /**
   * Get ordered columns for preview dialog
   * Matches the exact column order from backend template generation (GenerateImportTemplateAsync)
   * This ensures consistency between downloaded templates and import preview
   */
  private getOrderedColumns(record: any): string[] {
    if (!record) return [];

    const allKeys = Object.keys(record);

    // Define column order based on backend template headers
    // These orders match exactly with the backend GenerateImportTemplateAsync methods
    let priorityOrder: string[] = [];

    if (this._activeTab === 'ammunition') {
      // From AmmunitionService.GenerateImportTemplateAsync (line 882-889)
      priorityOrder = [
        'name', 'itemNo', 'partNo', 'armNumber', 'nsn', 'price', 'minimumQuantity',
        'bulletDiameter', 'bulletDiameterUnit', 'totalWeight', 'isLinked', 'primer',
        'caseType', 'propellant', 'compatibility', 'hazardDivision', 'natureOption',
        'primaryPurpos', 'projectileColor', 'projectailMaterial',
        'unNumber', 'distribution', 'referenceNo', 'classification', 'type', 'notes'
      ];
    } else if (this._activeTab === 'explosive') {
      // From ExplosiveService.GenerateImportTemplateAsync (line 598-603)
      priorityOrder = [
        'name', 'itemNo', 'partNo', 'nsn', 'price', 'minimumQuantity',
        'explosiveType', 'unNumber', 'netExplosiveQuantity', 'netExplosiveQuantityUnit',
        'distribution', 'referenceNo', 'hazardDivision', 'classification', 'type', 'notes'
      ];
    } else if (this._activeTab === 'weapon') {
      // From WeaponService.GenerateImportTemplateAsync (matches backend template order)
      priorityOrder = [
        'name', 'itemNo', 'partNo', 'nsn', 'price', 'minimumQuantity',
        'caliber', 'caliberUnit', 'yearOfManufacture', 'countryOfManufacture', 'model',
        'unNumber', 'distribution', 'referenceNo', 'classification', 'type', 'notes'
      ];
    }

    // Separate keys into priority (matching template) and remaining
    const priorityKeys = priorityOrder.filter(key => allKeys.includes(key));
    const remainingKeys = allKeys.filter(key => !priorityOrder.includes(key));

    // Return priority keys first (matching template order), then remaining keys
    return [...priorityKeys, ...remainingKeys];
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
          header: 'Arm Number',
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
          header: 'Bullet Diameter',
          key: 'bulletDiameter',
          width: 15,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: 'Bullet Diameter Unit',
          key: 'bulletDiameterUnit',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Total Weight',
          key: 'totalWeight',
          width: 15,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: 'Is Linked',
          key: 'isLinked',
          width: 12,
          format: (value: boolean) => value ? 'Yes' : 'No'
        },
        {
          header: 'Primer',
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
          header: 'Propellant',
          key: 'propellant',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Compatibility',
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
          header: 'Nature Option',
          key: 'natureOption',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Primary Purpose',
          key: 'primaryPurpos',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Projectile Color',
          key: 'projectileColor',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Projectile Material',
          key: 'projectailMaterial',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'UN Number',
          key: 'unNumber',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: 'Distribution',
          key: 'distribution',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: 'Reference No',
          key: 'referenceNo',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: 'Classification',
          key: 'classification',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Type',
          key: 'type',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Notes',
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
          header: 'Caliber Unit',
          key: 'caliberUnit',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Year Of Manufacture',
          key: 'yearOfManufacture',
          width: 20,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: 'Country Of Manufacture',
          key: 'countryOfManufacture',
          width: 25,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Model',
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
          header: 'Distribution',
          key: 'distribution',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: 'Reference No',
          key: 'referenceNo',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: 'Classification',
          key: 'classification',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Type',
          key: 'type',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Notes',
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
          header: this.translateService.instant('addAsset.explosiveType'),
          key: 'explosiveType',
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
          header: 'Net Explosive Quantity',
          key: 'netExplosiveQuantity',
          width: 20,
          format: (value: number) => value ? value.toString() : '-'
        },
        {
          header: 'NEQ Unit',
          key: 'netExplosiveQuantityUnit',
          width: 15,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Distribution',
          key: 'distribution',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: 'Reference No',
          key: 'referenceNo',
          width: 15,
          format: (value: string) => value || '-'
        },
        {
          header: 'Classification',
          key: 'classification',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Type',
          key: 'type',
          width: 20,
          format: (value: any) => getLookupDisplayName(value, this.translateService) || '-'
        },
        {
          header: 'Notes',
          key: 'notes',
          width: 30,
          format: (value: string) => value || '-'
        }
      );
    }

    return columns;
  }
}

