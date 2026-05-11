import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Optional, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { Asset } from '@models/asset-list.model';
import { createInitialImageState } from '@utils/asset-list.state';
import { AssetPropertyAccessor } from '@utils/asset-property.utils';
import { AssetEditModalComponent } from './components/asset-edit-modal/asset-edit-modal.component';
import { AssetFilterBarComponent } from './components/asset-filter-bar/asset-filter-bar.component';
import { AssetTableComponent } from './components/asset-table/asset-table.component';
import { AssetListHeaderComponent } from './components/asset-list-header/asset-list-header.component';
import { AssetListFacade } from './services/asset-list.facade';
import { AssetListCrudHandlerService, EditSaveEvent } from './services/asset-list-crud-handler.service';
import { AssetModalService } from './services/asset-modal.service';
import { TranslationService } from '@services/translation.service';
import { ImportDialogComponent } from '@components/import-dialog/import-dialog.component';
import { ImportPreviewDialogComponent, PreviewData } from '@components/import-preview-dialog/import-preview-dialog.component';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { ImportExportService } from '@admin/services/import-export.service';
import { ToastService } from '@services/toast.service';
import { IImportableService } from '@core/interfaces/importable-service.interface';
import { APIOperationResponse } from '@models/api-response.model';
import { ImportResult } from '@models/import-result.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { mapImportResultToPreviewData } from '@core/utils/asset-master-import-preview.utils';
import { AssetType } from '@models/asset-list.model';
import { LookupItem } from '@models/lookup.model';

@Component({
  selector: 'app-asset-list',
  standalone: true,
  providers: [AssetListFacade],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ConfirmDialogComponent,
    TranslateModule,
    AssetEditModalComponent,
    AssetFilterBarComponent,
    AssetTableComponent,
    AssetListHeaderComponent,
    ImportDialogComponent,
    ImportPreviewDialogComponent
  ],
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetListComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly destroy$ = new Subject<void>();

  showImportModal = false;
  showPreviewModal = false;
  previewData: PreviewData | null = null;
  pendingImportFile: File | null = null;
  isPreviewInProgress = false;
  isImportInProgress = false;

  constructor(
    readonly facade: AssetListFacade,
    private readonly crudHandler: AssetListCrudHandlerService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly translationService: TranslationService,
    private readonly assetModalService: AssetModalService,
    private readonly ammunitionService: AmmunitionService,
    private readonly weaponService: WeaponService,
    private readonly explosiveService: ExplosiveService,
    private readonly importExportService: ImportExportService,
    private readonly toastService: ToastService,
    private readonly propertyAccessor: AssetPropertyAccessor,
    private readonly cdr: ChangeDetectorRef,
    @Optional() @Inject(ONBOARDING_TOUR) private readonly onboardingTourService: IOnboardingTourProvider | null
  ) {}

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get totalPages(): number {
    return this.facade.totalPages;
  }

  get lookups() {
    return this.facade.lookups;
  }

  get activeTab() { return this.facade.activeTab; }
  get ammunitionViewMode() { return this.facade.ammunitionViewMode; }
  get explosivesViewMode() { return this.facade.explosivesViewMode; }
  get weaponsViewMode() { return this.facade.weaponsViewMode; }
  get filterState() { return this.facade.filterState; }
  get filterOptions() { return this.facade.filterOptions; }
  get assets() { return this.facade.assets; }
  get loading() { return this.facade.loading; }
  get sortState() { return this.facade.sortState; }
  get paginationState() { return this.facade.paginationState; }
  get totalItems() { return this.facade.totalItems; }
  get modalState() { return this.facade.modalState; }
  get units() { return this.facade.units; }
  get imageState() { return this.facade.imageState; }

  get caseTypeList() { return this.facade.lookups?.caseTypes ?? []; }
  get propellantList() { return this.facade.lookups?.propellants ?? []; }
  get compatibilityList() { return this.facade.lookups?.compatibilities ?? []; }
  get hazardDivisionList() { return this.facade.lookups?.hazardDivisions ?? []; }
  get natureOptions() { return this.facade.lookups?.natureOptions ?? []; }
  get primaryPurposes() { return this.facade.lookups?.primaryPurposes ?? []; }
  get projectileColors() { return this.facade.lookups?.colors ?? []; }
  get projectailMaterials() { return this.facade.lookups?.materials ?? []; }
  get classifications() { return this.facade.lookups?.classifications ?? []; }
  get itemTypes() { return this.facade.lookups?.itemTypes ?? []; }
  get countries() { return this.facade.lookups?.countries ?? []; }
  get calibersWeapon(): LookupItem[] {
    return this.facade.lookups?.calibersWeapon ?? [];
  }
  get calibersAmmunition(): LookupItem[] {
    return this.facade.lookups?.calibersAmmunition ?? [];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.facade.destroy();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.onboardingTourService?.checkAndStartPageTour('asset-list'), 300);
  }

  ngOnInit(): void {
    this.facade.init({
      onViewItemId: (id) => {
        this.onView(id);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { viewItemId: null },
          queryParamsHandling: 'merge'
        });
      }
    });

    combineLatest([
      this.facade.assets$,
      this.facade.loading$,
      this.facade.filterState$,
      this.facade.modalState$,
      this.facade.imageState$,
      this.facade.units$,
      this.facade.activeTab$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.propertyAccessor.initialize(this.facade.units, this.facade.activeTab);
        this.cdr.markForCheck();
      });
  }

  switchTab(tab: import('@models/asset-list.model').AssetType): void {
    this.facade.switchTab(tab);
  }

  switchAmmunitionViewMode(mode: 'available' | 'deleted'): void {
    this.facade.switchViewMode(mode, 'ammunition');
  }

  switchExplosivesViewMode(mode: 'available' | 'deleted'): void {
    this.facade.switchViewMode(mode, 'explosive');
  }

  switchWeaponsViewMode(mode: 'available' | 'deleted'): void {
    this.facade.switchViewMode(mode, 'weapon');
  }

  onFilterChange(): void {
    this.facade.onFilterChange();
  }

  onSearchCleared(): void {
    this.facade.clearSearchTerm();
    this.cdr.markForCheck();
  }

  clearFilters(): void {
    this.facade.clearFilters();
  }

  sortByColumn(column: string): void {
    this.facade.sortByColumn(column);
  }

  onPageChange(page: number): void {
    this.facade.onPageChange(page);
  }

  onRowsPerPageChange(rows: number): void {
    this.facade.onRowsPerPageChange(rows);
  }

  navigateToAddAsset(): void {
    const queryParams: Record<string, string | number> = { tab: this.facade.activeTab };
    if (this.facade.paginationState.currentPage > 1) {
      queryParams['page'] = this.facade.paginationState.currentPage;
    }
    this.router.navigate(['/assets/add-asset'], { queryParams });
  }

  onView(assetId: string): void {
    const numericId = parseInt(assetId, 10);
    if (isNaN(numericId)) return;
    const queryParams: Record<string, string | number> = {
      tab: this.facade.activeTab,
      page: this.facade.paginationState.currentPage
    };
    if (this.facade.activeTab === 'ammunition' && this.facade.ammunitionViewMode === 'deleted') {
      queryParams['includeDeleted'] = 'true';
      queryParams['ammunitionView'] = 'deleted';
    }
    if (this.facade.activeTab === 'explosive' && this.facade.explosivesViewMode === 'deleted') {
      queryParams['includeDeleted'] = 'true';
      queryParams['explosivesView'] = 'deleted';
    }
    if (this.facade.activeTab === 'weapon' && this.facade.weaponsViewMode === 'deleted') {
      queryParams['includeDeleted'] = 'true';
      queryParams['weaponsView'] = 'deleted';
    }
    this.router.navigate(['/assets/asset-list', numericId], { queryParams });
  }

  onEdit(assetId: string): void {
    this.facade.setImageState(createInitialImageState());
    this.crudHandler.openEdit(
      assetId,
      this.facade.assets,
      this.facade.activeTab,
      this.facade.modalState,
      this.destroy$,
      () => this.cdr.markForCheck(),
      (v) => this.facade.setLoading(v),
      (s) => this.facade.setImageState(s),
      (s) => this.facade.setModalState(s),
      () => this.facade.loadAssets()
    );
  }

  closeEditModal(): void {
    this.assetModalService.closeEditModal(this.facade.modalState, this.facade.imageState);
    this.facade.setModalState({ ...this.facade.modalState });
    this.facade.setImageState(createInitialImageState());
    this.cdr.markForCheck();
  }

  onEditSaved(event: EditSaveEvent): void {
    this.crudHandler.saveEdit(
      event,
      this.facade.modalState,
      this.facade.activeTab,
      this.destroy$,
      () => this.closeEditModal(),
      (v) => this.facade.setLoading(v),
      () => this.facade.loadAssets(),
      () => this.cdr.markForCheck()
    );
  }

  onDelete(assetId: string): void {
    const asset = this.facade.assets.find((a) => a.id === assetId);
    if (asset) {
      this.assetModalService.openDeleteModal(asset, this.facade.modalState);
      this.facade.setModalState({ ...this.facade.modalState });
      this.cdr.markForCheck();
    }
  }

  onPermanentDelete(assetId: string): void {
    const asset = this.facade.assets.find((a) => a.id === assetId);
    if (asset) {
      this.assetModalService.openPermanentDeleteModal(asset, this.facade.modalState);
      this.facade.setModalState({ ...this.facade.modalState });
      this.cdr.markForCheck();
    }
  }

  onRestore(assetId: string): void {
    const asset = this.facade.assets.find((a) => a.id === assetId);
    if (asset) {
      this.assetModalService.openRestoreModal(asset, this.facade.modalState);
      this.facade.setModalState({ ...this.facade.modalState });
      this.cdr.markForCheck();
    }
  }

  closeDeleteModal(): void {
    this.assetModalService.closeDeleteModal(this.facade.modalState);
    this.cdr.markForCheck();
  }

  closePermanentDeleteModal(): void {
    this.assetModalService.closePermanentDeleteModal(this.facade.modalState);
    this.cdr.markForCheck();
  }

  closeRestoreModal(): void {
    this.assetModalService.closeRestoreModal(this.facade.modalState);
    this.cdr.markForCheck();
  }

  confirmDelete(): void {
    this.crudHandler.confirmDelete(
      this.facade.modalState,
      this.facade.activeTab,
      this.destroy$,
      () => this.closeDeleteModal(),
      (v) => this.facade.setLoading(v),
      () => this.facade.loadAssets(),
      () => this.cdr.markForCheck()
    );
  }

  confirmPermanentDelete(): void {
    this.crudHandler.confirmPermanentDelete(
      this.facade.modalState,
      this.facade.activeTab,
      this.destroy$,
      () => this.closePermanentDeleteModal(),
      (v) => this.facade.setLoading(v),
      () => this.facade.loadAssets(),
      () => this.cdr.markForCheck()
    );
  }

  confirmRestore(): void {
    this.crudHandler.confirmRestore(
      this.facade.modalState,
      this.facade.activeTab,
      this.destroy$,
      () => this.closeRestoreModal(),
      (v) => this.facade.setLoading(v),
      () => this.facade.loadAssets(),
      () => this.cdr.markForCheck()
    );
  }

  readonly getAssetName = (asset: Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null): string =>
    this.propertyAccessor.getAssetName(asset) ?? '';

  exportToExcel(): void {
    this.facade.exportToExcel();
  }

  onImportToolbarClick(): void {
    this.pendingImportFile = null;
    this.previewData = null;
    this.showImportModal = true;
    this.cdr.markForCheck();
  }

  closeImportModal(): void {
    this.pendingImportFile = null;
    this.showImportModal = false;
    this.cdr.markForCheck();
  }

  downloadImportTemplateFromApi(): void {
    const service = this.getAssetImportService(this.facade.activeTab);
    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    service
      .generateImportTemplate(lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const date = new Date().toISOString().split('T')[0];
          link.download = `Import_Template_${this.facade.activeTab}_${lang}_${date}.xlsx`;
          link.click();
          window.URL.revokeObjectURL(url);
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Failed to download template'));
          this.cdr.markForCheck();
        }
      });
  }

  onImportPreview(file: File): void {
    if (this.isPreviewInProgress) {
      this.toastService.warning('Preview is already in progress. Please wait...');
      return;
    }
    this.previewData = null;
    this.showPreviewModal = false;
    this.isPreviewInProgress = true;
    this.facade.setLoading(true);
    this.closeImportModal();
    this.pendingImportFile = file;
    this.cdr.markForCheck();

    const service = this.getAssetImportService(this.facade.activeTab);
    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    service
      .importPreview(file, lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isPreviewInProgress = false;
          this.facade.setLoading(false);

          if (!res?.succeeded || !res.data) {
            this.previewData = null;
            this.toastService.error(res?.message || 'Preview failed');
            this.cdr.markForCheck();
            return;
          }

          const preview = mapImportResultToPreviewData(res.data);
          if (preview) {
            this.previewData = preview;
            this.showPreviewModal = true;
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.isPreviewInProgress = false;
          this.facade.setLoading(false);
          this.previewData = null;
          this.toastService.error(`Preview failed: ${ErrorHandler.extractErrorMessage(error, 'Unknown error')}`);
          this.cdr.markForCheck();
        }
      });
  }

  onImportDirect(file: File): void {
    if (this.isImportInProgress) {
      this.toastService.warning('Import is already in progress. Please wait...');
      return;
    }
    this.isImportInProgress = true;
    this.facade.setLoading(true);
    this.closeImportModal();
    this.cdr.markForCheck();

    const service = this.getAssetImportService(this.facade.activeTab);
    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    service
      .importData(file, lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isImportInProgress = false;
          this.facade.setLoading(false);
          if (res?.succeeded && res.data) {
            const result = res.data;
            this.importExportService.handleImportResult({
              successCount: result.successCount ?? result.successfulRecords?.length ?? 0,
              failureCount: result.errors?.length ?? 0,
              errors: result.errors || []
            });
            this.facade.loadAssets();
          } else {
            this.toastService.error(res?.message || 'Import failed');
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.isImportInProgress = false;
          this.facade.setLoading(false);
          this.toastService.error(`Import failed: ${ErrorHandler.extractErrorMessage(error, 'Unknown error')}`);
          this.cdr.markForCheck();
        }
      });
  }

  onPreviewConfirmed(_validRows: unknown[]): void {
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

    this.isImportInProgress = true;
    this.facade.setLoading(true);
    const file = this.pendingImportFile;
    const service = this.getAssetImportService(this.facade.activeTab);
    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';

    service
      .importData(file, lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isImportInProgress = false;
          this.facade.setLoading(false);
          this.pendingImportFile = null;
          if (res?.succeeded && res.data) {
            const result = res.data;
            this.importExportService.handleImportResult({
              successCount: result.successCount ?? result.successfulRecords?.length ?? 0,
              failureCount: result.errors?.length ?? 0,
              errors: result.errors || []
            });
            this.facade.loadAssets();
          } else {
            this.toastService.error(res?.message || 'Import failed');
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.isImportInProgress = false;
          this.facade.setLoading(false);
          this.pendingImportFile = null;
          this.toastService.error(`Import failed: ${ErrorHandler.extractErrorMessage(error, 'Unknown error')}`);
          this.cdr.markForCheck();
        }
      });
  }

  onPreviewCancelled(): void {
    this.showPreviewModal = false;
    this.previewData = null;
    this.pendingImportFile = null;
    this.isPreviewInProgress = false;
    this.cdr.markForCheck();
  }

  private getAssetImportService(tab: AssetType): IImportableService {
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
}
