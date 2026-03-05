import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { LucideAngularModule } from 'lucide-angular';
import { ImagePreviewTooltipComponent } from '@components/index';
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
import { AssetExportService } from './services/asset-export.service';
import { TranslationService } from '@services/translation.service';

@Component({
  selector: 'app-asset-list',
  standalone: true,
  providers: [AssetListFacade],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ConfirmDialogComponent,
    LucideAngularModule,
    TranslateModule,
    AssetEditModalComponent,
    AssetFilterBarComponent,
    AssetTableComponent,
    AssetListHeaderComponent
  ],
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetListComponent implements OnInit, OnDestroy {
  @ViewChild(ImagePreviewTooltipComponent) imagePreviewTooltip!: ImagePreviewTooltipComponent;

  private readonly destroy$ = new Subject<void>();

  constructor(
    readonly facade: AssetListFacade,
    private readonly crudHandler: AssetListCrudHandlerService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly translationService: TranslationService,
    private readonly assetModalService: AssetModalService,
    private readonly assetExportService: AssetExportService,
    private readonly propertyAccessor: AssetPropertyAccessor,
    private readonly cdr: ChangeDetectorRef
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.imagePreviewTooltip) this.imagePreviewTooltip.hide();
    this.facade.destroy();
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
    this.router.navigate(['/add-asset'], { queryParams });
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
    this.router.navigate(['/asset-list', numericId], { queryParams });
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

  onImageError(asset: Asset): void {
    asset.imageUrl = undefined;
    this.cdr.markForCheck();
  }

  showImagePreview(event: MouseEvent, asset: Asset): void {
    if (!asset.imageUrl || !this.imagePreviewTooltip) return;
    this.imagePreviewTooltip.showPreview(event, {
      imageUrl: asset.imageUrl,
      altText: this.getAssetName(asset)
    });
  }

  hideImagePreview(): void {
    this.imagePreviewTooltip?.hide();
  }

  readonly getAssetName = (asset: Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null): string =>
    this.propertyAccessor.getAssetName(asset) ?? '';

  exportToExcel(): void {
    this.facade.exportToExcel();
  }

  downloadImportTemplate(): void {
    this.assetExportService.downloadImportTemplate(this.facade.activeTab);
  }
}
