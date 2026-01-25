import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, forkJoin, Subject, takeUntil, timer, of } from 'rxjs';
import { map, catchError, skip } from 'rxjs/operators';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { LucideAngularModule, Search, Filter, Edit, Trash2, Eye, Plus, X, ArrowUpDown, ArrowUp, ArrowDown, FilterX, Download, Upload, Image } from 'lucide-angular';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { AssetService as AssetHttpService } from '@services/asset.service';
import { LookupService } from '@services/lookup.service';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { AmmunitionReadDto, AmmunitionCreateDto, LookupDto } from '@models/ammunition.model';
import { WeaponDto, CreateUpdateWeaponDto } from '@models/weapon.model';
import { ExplosiveDto, CreateUpdateExplosiveDto } from '@models/explosive.model';
import { LookupItem } from '@models/lookup.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { ImagePreviewTooltipComponent, ImagePreviewData } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { APIOperationResponse } from '@models/api-response.model';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import {
  Asset,
  AssetType,
  AssetFilterState,
  AssetSortState,
  AssetPaginationState,
  AssetModalState,
  AssetImageState,
  AssetService
} from '@models/asset-list.model';
import {
  mapAmmunitionArrayToAssets,
  mapWeaponArrayToAssets,
  mapExplosiveArrayToAssets
} from '@utils/asset-list.mapper';
import {
  getLookupDisplayName,
  createFilterOptions
} from '@utils/asset-list.utils';
import { unwrapDropdownOption } from '@utils/dropdown.utils';
import {
  createInitialFilterState,
  createInitialSortState,
  createInitialPaginationState,
  createInitialModalState,
  createInitialImageState,
  resetFilterState
} from '@utils/asset-list.state';
import { AssetPropertyAccessor } from '@utils/asset-property.utils';
import { AssetEditModalComponent } from './components/asset-edit-modal/asset-edit-modal.component';
import { AssetFilterBarComponent } from './components/asset-filter-bar/asset-filter-bar.component';
import { AssetTableComponent } from './components/asset-table/asset-table.component';
import { FileUploadService, FileEntityType } from '@services/file-upload.service';
import { AssetListService } from './services/asset-list.service';
import { AssetImageService } from './services/asset-image.service';
import { AssetExportService } from './services/asset-export.service';
import { AssetImportService } from './services/asset-import.service';
import { AssetModalService } from './services/asset-modal.service';
import { AssetFilterService } from './services/asset-filter.service';
import { PaginatedList } from '@models/api-response.model';

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    LucideAngularModule,
    TranslateModule,
    HasPermissionDirective,
    AssetEditModalComponent,
    AssetFilterBarComponent,
    AssetTableComponent
  ],
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetListComponent implements OnInit, OnDestroy {
  readonly Search = Search;
  readonly Filter = Filter;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Eye = Eye;
  readonly Plus = Plus;
  readonly X = X;
  readonly ArrowUpDown = ArrowUpDown;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly FilterX = FilterX;
  readonly Download = Download;
  readonly Upload = Upload;
  readonly Image = Image;

  // State
  assets: Asset[] = [];
  loading = false;
  activeTab: AssetType = 'ammunition';
  totalItems: number = 0;

  // Filter state
  filterState: AssetFilterState = createInitialFilterState();

  // Sort state
  sortState: AssetSortState = createInitialSortState();

  // Pagination state
  paginationState: AssetPaginationState = createInitialPaginationState();

  // Modal state
  modalState: AssetModalState = createInitialModalState();

  // Image state
  imageState: AssetImageState = createInitialImageState();

  // Image preview tooltip reference
  @ViewChild(ImagePreviewTooltipComponent) imagePreviewTooltip!: ImagePreviewTooltipComponent;

  private readonly destroy$ = new Subject<void>();

  // Lookup data
  caseTypeList: LookupItem[] = [];
  hazardDivisionList: LookupItem[] = [];
  compatibilityList: LookupItem[] = [];
  propellantList: LookupItem[] = [];
  units: LookupItem[] = [];
  natureOptions: LookupItem[] = [];
  primaryPurposes: LookupItem[] = [];
  projectileColors: LookupItem[] = [];
  projectailMaterials: LookupItem[] = [];
  classifications: LookupItem[] = [];
  itemTypes: LookupItem[] = [];
  countries: LookupItem[] = [];

  // Enum Options
  readonly explosiveTypeOptions = getExplosiveTypeOptions();

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) =>
    getLookupDisplayName(unwrapDropdownOption(option), this.translateService);

  readonly linkedOptions = [
    { label: 'assetList.editModal.notLinked', value: false },
    { label: 'assetList.editModal.linked', value: true }
  ];

  // Computed properties
  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get totalPages(): number {
    return this.totalItems === 0 ? 1 : Math.ceil(this.totalItems / this.paginationState.rowsPerPage);
  }

  // Filter options - delegated to AssetFilterService
  get caseTypeFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getAmmunitionFilterOptions(
      this.caseTypeList,
      this.hazardDivisionList,
      this.compatibilityList,
      this.propellantList
    ).caseType;
  }

  get hazardDivisionFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getAmmunitionFilterOptions(
      this.caseTypeList,
      this.hazardDivisionList,
      this.compatibilityList,
      this.propellantList
    ).hazardDivision;
  }

  get compatibilityFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getAmmunitionFilterOptions(
      this.caseTypeList,
      this.hazardDivisionList,
      this.compatibilityList,
      this.propellantList
    ).compatibility;
  }

  // Weapon filter options
  get weaponTypeFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getWeaponFilterOptions(
      this.itemTypes,
      this.classifications,
      this.countries
    ).weaponType;
  }

  get weaponClassificationFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getWeaponFilterOptions(
      this.itemTypes,
      this.classifications,
      this.countries
    ).weaponClassification;
  }

  get countryFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getWeaponFilterOptions(
      this.itemTypes,
      this.classifications,
      this.countries
    ).countryOfManufacture;
  }

  // Explosive filter options
  get explosiveTypeFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getExplosiveFilterOptions(
      this.itemTypes,
      this.classifications,
      this.hazardDivisionList,
      this.compatibilityList
    ).explosiveType;
  }

  get explosiveClassificationFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getExplosiveFilterOptions(
      this.itemTypes,
      this.classifications,
      this.hazardDivisionList,
      this.compatibilityList
    ).explosiveClassification;
  }

  get explosiveHazardDivisionFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getExplosiveFilterOptions(
      this.itemTypes,
      this.classifications,
      this.hazardDivisionList,
      this.compatibilityList
    ).explosiveHazardDivision;
  }

  get explosiveCompatibilityFilterOptions(): Array<{ label: string; value: number }> {
    return this.assetFilterService.getExplosiveFilterOptions(
      this.itemTypes,
      this.classifications,
      this.hazardDivisionList,
      this.compatibilityList
    ).explosiveCompatibility;
  }

  get paginatedAssets(): Asset[] {
    // With server-side pagination, assets already contains only the current page items
    return this.assets;
  }

  get filteredAssets(): Asset[] {
    // For export, we still need all filtered items
    // This will be handled differently - export will need to fetch all filtered data
    return this.assets;
  }

  constructor(
    private assetListService: AssetListService,
    private assetService: AssetHttpService,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private lookupService: LookupService,
    private fileUploadService: FileUploadService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private toastService: ToastService,
    private propertyAccessor: AssetPropertyAccessor,
    private cdr: ChangeDetectorRef,
    private assetImageService: AssetImageService,
    private assetExportService: AssetExportService,
    private assetImportService: AssetImportService,
    private assetModalService: AssetModalService,
    private assetFilterService: AssetFilterService
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Hide preview on destroy
    if (this.imagePreviewTooltip) {
      this.imagePreviewTooltip.hide();
    }

    // Clean up all blob URLs to prevent memory leaks
    this.assetImageService.cleanup();
  }

  ngOnInit(): void {
    try {
      this.loadAssets();
      this.loadDropdowns();

      // Subscribe to language changes to reload assets with new localized names
      // Skip the first emission to avoid duplicate call on init
      this.translateService.onLangChange
        .pipe(
          skip(1), // Skip initial emission to prevent duplicate call
          takeUntil(this.destroy$)
        )
        .subscribe(() => {
          // Reload assets to get new localized names
          this.loadAssets();
          // Reload dropdowns to get new localized lookup values
          this.loadDropdowns();
        });


      // Check for viewItemId query parameter to auto-open view modal
      this.route.queryParams
        .pipe(takeUntil(this.destroy$))
        .subscribe(params => {
          const viewItemId = params['viewItemId'];
          if (viewItemId) {
            // Use RxJS timer instead of setTimeout for better RxJS integration
            timer(300)
              .pipe(takeUntil(this.destroy$))
              .subscribe(() => {
                this.onView(viewItemId.toString());
                // Remove query param from URL after opening modal
                this.router.navigate([], {
                  relativeTo: this.route,
                  queryParams: { viewItemId: null },
                  queryParamsHandling: 'merge'
                });
              });
          }
        });
    } catch {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  switchTab(tab: AssetType): void {
    this.activeTab = tab;
    this.initializePropertyAccessor();
    this.paginationState.currentPage = 1;
    this.clearFilters(); // clearFilters() already calls onFilterChange() which calls loadAssets()
    this.cdr.markForCheck();
  }

  private initializePropertyAccessor(): void {
    this.propertyAccessor.initialize(this.units, this.activeTab);
  }

  private loadAssets(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.assetListService.getAssets(
      this.activeTab,
      this.paginationState.currentPage,
      this.paginationState.rowsPerPage,
      this.filterState,
      this.sortState
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PaginatedList<Asset>) => {
          this.assets = response.items || [];
          this.totalItems = response.totalCount || 0;
          this.loadAssetImages();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoad'));
          this.assets = [];
          this.totalItems = 0;
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadAssetImages(): void {
    this.assetImageService.loadAssetImages(this.assets, this.activeTab)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          results.forEach(({ assetId, url }) => {
            const asset = this.assets.find(a => a.id === assetId);
            if (asset && url) {
              asset.imageUrl = url;
            }
          });
          // Create new array reference to trigger OnPush detection in child components
          this.assets = [...this.assets];
          this.cdr.detectChanges();
        },
        error: () => { /* Silently handle image loading errors - images are optional */ }
      });
  }

  private getAssetService(): any {
    switch (this.activeTab) {
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

  navigateToAddAsset() {
    this.router.navigate(['/add-asset'], {
      queryParams: { tab: this.activeTab }
    });
  }

  onView(assetId: string): void {
    const numericId = parseInt(assetId);
    if (isNaN(numericId)) return;

    // Navigate to detail page with tab query param
    this.router.navigate(['/asset-list', numericId], {
      queryParams: { tab: this.activeTab }
    });
  }


  onEdit(assetId: string): void {
    const asset = this.assets.find(a => a.id === assetId);
    if (!asset) return;

    // Reset image state
    this.imageState = createInitialImageState();

    // Fetch full details to populate form
    const numericId = parseInt(assetId);
    const service = this.getAssetService();

    this.loading = true;
    this.cdr.markForCheck();

    service.getById(numericId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any) => {
          this.modalState.selectedAsset = data;

          // Load image for edit first, then open modal
          this.loadEditImage(numericId, () => {
            this.loading = false;
            this.modalState.showEditModal = true;
            this.cdr.markForCheck();
          });
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadEditImage(id: number, callback?: () => void): void {
    const service = this.getAssetService();

    // Get all files to find the latest one
    let entityType: FileEntityType;
    if (this.activeTab === 'ammunition') {
      entityType = FileEntityType.Ammunition;
    } else if (this.activeTab === 'weapon') {
      entityType = FileEntityType.Weapon;
    } else if (this.activeTab === 'explosive') {
      entityType = FileEntityType.Explosive;
    } else {
      if (callback) callback();
      return;
    }

    this.fileUploadService.getFilesByEntity(entityType, id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (files: any[]) => {
          if (files && files.length > 0) {
            // Get main images (there might be multiple with isMain: true)
            const mainImages = files.filter((img: any) => img.isMain);
            let latestImage: any;

            if (mainImages.length > 0) {
              // If multiple main images exist, get the one with highest ID (latest uploaded)
              latestImage = mainImages.reduce((latest: any, current: any) =>
                (current.id > latest.id) ? current : latest
              );
            } else {
              // If no main image, get the image with highest ID (latest uploaded)
              latestImage = files.reduce((latest: any, current: any) =>
                (current.id > latest.id) ? current : latest
              );
            }

            if (latestImage?.id) {
              this.imageState.editImageFileId = latestImage.id;
              // Fetch blob for preview
              service.getFileBlob(latestImage.id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (blob: Blob) => {
                    this.imageState.editImageUrl = URL.createObjectURL(blob);
                    this.assetImageService.addBlobUrl(this.imageState.editImageUrl!);
                    // Create a new object reference to trigger change detection
                    this.imageState = { ...this.imageState };
                    this.cdr.markForCheck();
                    if (callback) callback();
                  },
                  error: () => {
                    // Even if image fails, continue with callback
                    if (callback) callback();
                  }
                });
            } else {
              if (callback) callback();
            }
          } else {
            if (callback) callback();
          }
        },
        error: () => {
          // Even if file fetch fails, continue with callback
          if (callback) callback();
        }
      });
  }

  closeEditModal(): void {
    this.assetModalService.closeEditModal(this.modalState, this.imageState);
    this.imageState = createInitialImageState();
    this.cdr.markForCheck();
  }

  onEditSaved(event: { dto: AmmunitionCreateDto | CreateUpdateWeaponDto | CreateUpdateExplosiveDto; imageFile: File | null; imageFileId: number | null }): void {
    if (!this.modalState.selectedAsset || !('id' in this.modalState.selectedAsset)) {
      return;
    }

    const id = parseInt(String(this.modalState.selectedAsset.id));
    if (isNaN(id)) return;

    const service = this.getAssetService();
    this.loading = true;
    this.cdr.markForCheck();

    service.update(id, event.dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<any>) => {
          if (res.succeeded) {
            // Handle Image Update
            if (event.imageFile) {
              service.updateImage(id, event.imageFile, event.imageFileId)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: () => {
                    this.closeEditModal();
                    this.toastService.success('Asset updated successfully');
                    this.loadAssets();
                  },
                  error: () => {
                    this.closeEditModal();
                    this.toastService.warning('Asset updated but image upload failed');
                    this.loadAssets();
                  }
                });
            } else {
              this.closeEditModal();
              this.toastService.success('Asset updated successfully');
              this.loadAssets();
            }
          } else {
            this.toastService.error(res.message || 'Update failed');
            this.loading = false;
            this.cdr.markForCheck();
          }
        },
        error: (err: any) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Update failed'));
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onDelete(assetId: string): void {
    const asset = this.assets.find(a => a.id === assetId);
    if (asset) {
      this.assetModalService.openDeleteModal(asset, this.modalState);
      this.cdr.markForCheck();
    }
  }

  closeDeleteModal(): void {
    this.assetModalService.closeDeleteModal(this.modalState);
    this.cdr.markForCheck();
  }

  confirmDelete(): void {
    if (!this.modalState.selectedAsset || !('id' in this.modalState.selectedAsset)) {
      return;
    }

    const id = parseInt(String(this.modalState.selectedAsset.id));
    if (isNaN(id)) return;

    const service = this.getAssetService();
    this.loading = true;
    this.cdr.markForCheck();

    service.delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<void>) => {
          if (res.succeeded) {
            this.toastService.success('Deleted successfully');
            this.closeDeleteModal();
            this.loadAssets();
          } else {
            this.toastService.error(res.message || 'Delete failed');
            this.loading = false;
            this.cdr.markForCheck();
          }
        },
        error: (err: any) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Delete failed'));
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadDropdowns(): void {
    forkJoin({
      units: this.lookupService.getUnits(),
      caseTypes: this.lookupService.getCaseTypes(),
      propellants: this.lookupService.getPropellants(),
      compatibilities: this.lookupService.getCompatibilities(),
      hazardDivisions: this.lookupService.getHazardDivisions(),
      natureOptions: this.lookupService.getNatureOptions(),
      primaryPurposes: this.lookupService.getPrimaryPurposes(),
      colors: this.lookupService.getColors(),
      materials: this.lookupService.getProjectailMaterials(),
      classifications: this.lookupService.getLookupItems('Classification'),
      itemTypes: this.lookupService.getLookupItems('ItemType'),
      countries: this.lookupService.getCountries()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.units = data.units;
        this.caseTypeList = data.caseTypes;
        this.propellantList = data.propellants;
        this.compatibilityList = data.compatibilities;
        this.hazardDivisionList = data.hazardDivisions;
        this.natureOptions = data.natureOptions;
        this.primaryPurposes = data.primaryPurposes;
        this.projectileColors = data.colors;
        this.projectailMaterials = data.materials;
        this.classifications = data.classifications;
        this.itemTypes = data.itemTypes;
        this.countries = data.countries;
        this.initializePropertyAccessor();
        this.cdr.markForCheck();
      });
  }

  onImportClick(): void {
    this.openImportModal();
  }

  openImportModal(): void {
    this.modalState.showImportModal = true;
    this.cdr.markForCheck();
  }

  closeImportModal(): void {
    this.modalState.showImportModal = false;
    this.cdr.markForCheck();
  }

  onImportConfirmed(file: File): void {
    this.loading = true;
    this.closeImportModal();
    this.cdr.markForCheck();

    // Get the appropriate service based on active tab
    const service = this.getAssetService() as any;

    service.importData(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.assetImportService.handleImportResponse(res);
          if (res.succeeded) {
            this.loadAssets();
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.assetImportService.handleImportError();
          this.cdr.markForCheck();
        }
      });
  }

  downloadImportTemplate(): void {
    this.assetExportService.downloadImportTemplate(this.activeTab);
  }

  onFilterChange(): void {
    this.paginationState.currentPage = 1;
    this.loadAssets();
  }

  clearFilters(): void {
    this.filterState = resetFilterState(this.filterState);
    this.onFilterChange();
  }

  sortByColumn(column: string): void {
    if (this.sortState.column === column) {
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortState.column = column;
      this.sortState.direction = 'asc';
    }
    this.paginationState.currentPage = 1;
    this.loadAssets();
  }

  // Template Helpers
  getUnitName(unit: LookupDto | LookupItem | number | undefined): string {
    if (!unit) return '';
    if (typeof unit === 'number') {
      const unitItem = this.units.find(u => u.id === unit);
      return unitItem ? getLookupDisplayName(unitItem, this.translateService) : '';
    }
    return getLookupDisplayName(unit, this.translateService);
  }

  getLookupName(lookupId: LookupDto | LookupItem | string | null | undefined): string {
    return getLookupDisplayName(lookupId, this.translateService);
  }

  // Property accessors - Delegated to AssetPropertyAccessor
  getArmNumber = () => this.propertyAccessor.getArmNumber(this.modalState.selectedAsset);
  getCaseType = () => this.propertyAccessor.getCaseType(this.modalState.selectedAsset);
  getPropellant = () => this.propertyAccessor.getPropellant(this.modalState.selectedAsset);
  getCompatibility = () => this.propertyAccessor.getCompatibility(this.modalState.selectedAsset);
  getHazardDivision = () => this.propertyAccessor.getHazardDivision(this.modalState.selectedAsset);
  getPrimer = () => this.propertyAccessor.getPrimer(this.modalState.selectedAsset);
  getTotalWeight = () => this.propertyAccessor.getTotalWeight(this.modalState.selectedAsset);
  getCaliber = () => this.propertyAccessor.getCaliber(this.modalState.selectedAsset);
  getExplosiveTypeName = () => this.propertyAccessor.getExplosiveTypeName(this.modalState.selectedAsset);
  getUnNumber = () => this.propertyAccessor.getUnNumber(this.modalState.selectedAsset);
  getNetExplosiveQuantity = () => this.propertyAccessor.getNetExplosiveQuantity(this.modalState.selectedAsset);
  getAssetName = (asset: Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null) =>
    this.propertyAccessor.getAssetName(asset);

  // Pagination methods
  onRowsPerPageChange(rows: number): void {
    this.paginationState.rowsPerPage = rows;
    this.paginationState.currentPage = 1;
    this.loadAssets();
  }

  onPageChange(page: number): void {
    this.paginationState.currentPage = page;
    this.loadAssets();
  }

  // Error handling
  private showErrorToast(msg: string): void {
    this.toastService.error(msg);
  }

  // Image helpers
  onImageError(asset: Asset): void {
    asset.imageUrl = undefined;
    this.cdr.markForCheck();
  }

  showImagePreview(event: MouseEvent, asset: Asset): void {
    if (!asset.imageUrl || !this.imagePreviewTooltip) {
      return;
    }

    const previewData: ImagePreviewData = {
      imageUrl: asset.imageUrl,
      altText: this.getAssetName(asset)
    };

    this.imagePreviewTooltip.showPreview(event, previewData);
  }

  hideImagePreview(): void {
    if (this.imagePreviewTooltip) {
      this.imagePreviewTooltip.hide();
    }
  }

  keepPreviewVisible(): void {
    if (this.imagePreviewTooltip) {
      this.imagePreviewTooltip.keepVisible();
    }
  }

  /**
   * Export filtered assets to Excel
   * Fetches ALL filtered items (not just current page) for export
   */
  exportToExcel(): void {
    this.loading = true;
    this.cdr.markForCheck();

    // Fetch all filtered items for export
    this.assetListService.getAllFilteredAssetsForExport(
      this.activeTab,
      this.filterState,
      this.sortState
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (allFilteredAssets) => {
          this.assetExportService.exportToExcel(allFilteredAssets, this.activeTab);
          this.loading = false;
          this.cdr.markForCheck();

          this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
            this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
          });
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
          this.toastService.error(this.translateService.instant('assetList.errors.failedToExport'));
        }
      });
  }
}
