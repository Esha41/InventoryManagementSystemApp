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
  ) {}

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
        error: (err: any) => {
          console.error('Error loading assets:', err);
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
        error: (err: any) => {
          this.loadingAssets = false;
          this.toastService.error('Import failed');
          console.error(err);
          this.cdr.markForCheck();
        }
      });
  }

  downloadTemplate(): void {
    this.templateGenerationService.generateAssetTemplate(this._activeTab);
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
      },
      {
        header: this.translateService.instant('assetList.table.nsn'),
        key: 'nsn',
        width: 15,
        format: (value: string) => value || '-'
      }
    ];
    
    if (this._activeTab === 'ammunition') {
      columns.push(
        {
          header: this.translateService.instant('assetList.table.caseType'),
          key: 'caseType',
          width: 20,
          format: (value: string | any) => {
            if (!value) return '-';
            if (typeof value === 'string') return value;
            return getLookupDisplayName(value, this.translateService) || '-';
          }
        },
        {
          header: this.translateService.instant('assetList.table.hazardDivision'),
          key: 'hazardDivision',
          width: 20,
          format: (value: string | any) => {
            if (!value) return '-';
            if (typeof value === 'string') return value;
            return getLookupDisplayName(value, this.translateService) || '-';
          }
        }
      );
    } else if (this._activeTab === 'weapon') {
      columns.push(
        {
          header: this.translateService.instant('addAsset.weaponType'),
          key: 'weaponType',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('addAsset.caliber'),
          key: 'caliber',
          width: 15,
          format: (value: string) => value || '-'
        }
      );
    } else if (this._activeTab === 'explosive') {
      columns.push(
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
        }
      );
    }
    
    columns.push(
      {
        header: this.translateService.instant('assetList.table.price'),
        key: 'price',
        width: 15,
        format: (value: number) => value ? value.toString() : '-'
      },
      {
        header: this.translateService.instant('assetList.table.minimumQuantity'),
        key: 'minimumQuantity',
        width: 18,
        format: (value: number) => value ? value.toString() : '-'
      }
    );
    
    return columns;
  }
}

