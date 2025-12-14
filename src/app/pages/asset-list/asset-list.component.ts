import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, forkJoin, Subject, takeUntil, timer } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { LucideAngularModule, Search, Filter, Edit, Trash2, Eye, Plus, X, ArrowUpDown, ArrowUp, ArrowDown, FilterX } from 'lucide-angular';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { LookupService } from '@services/lookup.service';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { AmmunitionReadDto, AmmunitionCreateDto, LookupDto } from '@models/ammunition.model';
import { WeaponDto, CreateUpdateWeaponDto } from '@models/weapon.model';
import { ExplosiveDto, CreateUpdateExplosiveDto } from '@models/explosive.model';
import { LookupItem } from '@models/lookup.model';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent } from '@components/index';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { APIOperationResponse } from '@models/api-response.model';
import { getWeaponTypeOptions, getActionTypeOptions } from '@utils/weapon.utils';
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
  createFilterOptions,
  filterAssets,
  sortAssets,
  paginateAssets,
  calculateTotalPages,
  validateCurrentPage
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
import { AssetViewModalComponent } from './components/asset-view-modal/asset-view-modal.component';
import { AssetEditModalComponent } from './components/asset-edit-modal/asset-edit-modal.component';

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
    DropdownComponent,
    HasPermissionDirective,
    PaginationComponent,
    RowsPerPageComponent,
    LoadingStateComponent,
    AssetViewModalComponent,
    AssetEditModalComponent
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

  // State
  assets: Asset[] = [];
  loading = false;
  activeTab: AssetType = 'ammunition';
  
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

  // Enum Options
  readonly weaponTypeOptions = getWeaponTypeOptions();
  readonly actionTypeOptions = getActionTypeOptions();
  readonly explosiveTypeOptions = getExplosiveTypeOptions();

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) =>
    getLookupDisplayName(unwrapDropdownOption(option), this.translateService);
  
  readonly linkedOptions = [
    { label: 'assetList.editModal.notLinked', value: false },
    { label: 'assetList.editModal.linked', value: true }
  ];

  private blobUrls: Set<string> = new Set();

  // Computed properties
  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get totalPages(): number {
    return calculateTotalPages(this.filteredAssets.length, this.paginationState.rowsPerPage);
  }

  get caseTypeFilterOptions(): Array<{ label: string; value: number }> {
    return createFilterOptions(this.caseTypeList, this.translateService);
  }

  get hazardDivisionFilterOptions(): Array<{ label: string; value: number }> {
    return createFilterOptions(this.hazardDivisionList, this.translateService);
  }

  get compatibilityFilterOptions(): Array<{ label: string; value: number }> {
    return createFilterOptions(this.compatibilityList, this.translateService);
  }

  get paginatedAssets(): Asset[] {
    const filtered = filterAssets(this.assets, this.filterState, this.activeTab);
    const sorted = sortAssets(filtered, this.sortState);
    return paginateAssets(sorted, this.paginationState.currentPage, this.paginationState.rowsPerPage);
  }

  get filteredAssets(): Asset[] {
    return filterAssets(this.assets, this.filterState, this.activeTab);
  }

  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private lookupService: LookupService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private toastService: ToastService,
    private propertyAccessor: AssetPropertyAccessor,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up all blob URLs to prevent memory leaks
    this.blobUrls.forEach((url: string) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Error revoking blob URL:', e);
      }
    });
    this.blobUrls.clear();
  }

  ngOnInit(): void {
    try {
      this.loadAssets();
      this.loadDropdowns();

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
    } catch (error) {
      console.error('Error initializing asset list component:', error);
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  switchTab(tab: AssetType): void {
    this.activeTab = tab;
    this.initializePropertyAccessor();
    this.clearFilters();
    this.loadAssets();
    this.cdr.markForCheck();
  }

  private initializePropertyAccessor(): void {
    this.propertyAccessor.initialize(this.units, this.activeTab);
  }

  private loadAssets(): void {
    this.loading = true;
    this.cdr.markForCheck();

    try {
      if (this.activeTab === 'ammunition') {
        this.loadAmmunition();
      } else if (this.activeTab === 'weapon') {
        this.loadWeapons();
      } else if (this.activeTab === 'explosive') {
        this.loadExplosives();
      } else {
        this.activeTab = 'ammunition';
        this.loadAmmunition();
      }
    } catch (error) {
      console.error('Error in loadAssets:', error);
      this.loading = false;
      this.assets = [];
      this.cdr.markForCheck();
    }
  }

  private loadAmmunition(): void {
    this.ammunitionService.getAll<AmmunitionReadDto>()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          try {
            this.assets = mapAmmunitionArrayToAssets(items || [], this.translateService);
            this.finishLoading();
          } catch (error) {
            console.error('Error mapping ammunition data:', error);
            this.assets = [];
            this.loading = false;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Failed to load ammunitions:', err);
          this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoad'));
          this.assets = [];
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadWeapons(): void {
    this.weaponService.getAll<WeaponDto>()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          try {
            this.assets = mapWeaponArrayToAssets(items || []);
            this.finishLoading();
          } catch (error) {
            console.error('Error mapping weapon data:', error);
            this.assets = [];
            this.loading = false;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Failed to load weapons:', err);
          this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoad'));
          this.assets = [];
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadExplosives(): void {
    this.explosiveService.getAll<ExplosiveDto>()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          try {
            this.assets = mapExplosiveArrayToAssets(items || []);
            this.finishLoading();
          } catch (error) {
            console.error('Error mapping explosive data:', error);
            this.assets = [];
            this.loading = false;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Failed to load explosives:', err);
          this.showErrorToast(this.translateService.instant('assetList.errors.failedToLoad'));
          this.assets = [];
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private finishLoading(): void {
    this.paginationState.currentPage = 1;
    this.loadAssetImages();
    this.loading = false;
    this.paginationState.currentPage = validateCurrentPage(
      this.paginationState.currentPage,
      calculateTotalPages(this.assets.length, this.paginationState.rowsPerPage)
    );
    this.cdr.markForCheck();
  }

  private loadAssetImages(): void {
    const ids = this.assets
      .map(asset => parseInt(asset.id))
      .filter(id => !isNaN(id) && id > 0);
    
    if (ids.length === 0) return;

    const imageService$ = this.getAssetService().loadAssetImages(ids);

    imageService$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (imageMap) => {
          this.assets.forEach(asset => {
            const id = parseInt(asset.id);
            if (imageMap.has(id)) {
              const url = imageMap.get(id);
              if (url) {
                asset.imageUrl = url;
                this.blobUrls.add(url);
              }
            }
          });
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Failed to load images:', err)
      });
  }

  private getAssetService(): AssetService<AmmunitionReadDto | WeaponDto | ExplosiveDto, AmmunitionCreateDto | CreateUpdateWeaponDto | CreateUpdateExplosiveDto> {
    switch (this.activeTab) {
      case 'ammunition':
        return this.ammunitionService as AssetService<AmmunitionReadDto, AmmunitionCreateDto>;
      case 'weapon':
        return this.weaponService as AssetService<WeaponDto, CreateUpdateWeaponDto>;
      case 'explosive':
        return this.explosiveService as AssetService<ExplosiveDto, CreateUpdateExplosiveDto>;
      default:
        return this.ammunitionService as AssetService<AmmunitionReadDto, AmmunitionCreateDto>;
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

    const service = this.getAssetService();
    this.loading = true;
    this.cdr.markForCheck();
    
    service.getById(numericId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.modalState.selectedAsset = data;
          this.modalState.showViewModal = true;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load asset details', err);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  closeViewModal(): void {
    this.modalState.showViewModal = false;
    this.modalState.selectedAsset = null;
    this.cdr.markForCheck();
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
        next: (data) => {
          this.loading = false;
          this.modalState.selectedAsset = data;
          
          // Load image for edit
          this.loadEditImage(numericId);
          this.modalState.showEditModal = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load asset for edit', err);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadEditImage(id: number): void {
    const service = this.getAssetService();
    
    service.getFileInfo(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (info) => {
          if (info) {
            this.imageState.editImageFileId = info.id;
            // Fetch blob for preview
            service.getFileBlob(info.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (blob: Blob) => {
                  this.imageState.editImageUrl = URL.createObjectURL(blob);
                  this.blobUrls.add(this.imageState.editImageUrl!);
                  this.cdr.markForCheck();
                },
                error: (err) => console.error('Failed to load image blob', err)
              });
          }
        },
        error: (err) => console.error('Failed to load file info', err)
      });
  }

  closeEditModal(): void {
    this.modalState.showEditModal = false;
    this.modalState.selectedAsset = null;
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
        next: (res) => {
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
        error: (err) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Update failed'));
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onDelete(assetId: string): void {
    const asset = this.assets.find(a => a.id === assetId);
    this.modalState.selectedAsset = asset || null;
    this.modalState.showDeleteModal = true;
    this.cdr.markForCheck();
  }

  closeDeleteModal(): void {
    this.modalState.showDeleteModal = false;
    this.modalState.selectedAsset = null;
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
        next: (res) => {
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
        error: (err) => {
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
      materials: this.lookupService.getProjectailMaterials()
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
        this.initializePropertyAccessor();
        this.cdr.markForCheck();
      });
  }

  onFilterChange(): void {
    this.paginationState.currentPage = 1;
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
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
  getWeaponTypeName = () => this.propertyAccessor.getWeaponTypeName(this.modalState.selectedAsset);
  getCaliber = () => this.propertyAccessor.getCaliber(this.modalState.selectedAsset);
  getActionTypeName = () => this.propertyAccessor.getActionTypeName(this.modalState.selectedAsset);
  getBarrelLength = () => this.propertyAccessor.getBarrelLength(this.modalState.selectedAsset);
  getCapacity = () => this.propertyAccessor.getCapacity(this.modalState.selectedAsset);
  getOverallLength = () => this.propertyAccessor.getOverallLength(this.modalState.selectedAsset);
  getWeight = () => this.propertyAccessor.getWeight(this.modalState.selectedAsset);
  getExplosiveTypeName = () => this.propertyAccessor.getExplosiveTypeName(this.modalState.selectedAsset);
  getUnNumber = () => this.propertyAccessor.getUnNumber(this.modalState.selectedAsset);
  getNetExplosiveQuantity = () => this.propertyAccessor.getNetExplosiveQuantity(this.modalState.selectedAsset);
  getAssetName = (asset: Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null) => 
    this.propertyAccessor.getAssetName(asset);

  // Pagination methods
  onRowsPerPageChange(rows: number): void {
    this.paginationState.rowsPerPage = rows;
    this.paginationState.currentPage = 1;
    this.cdr.markForCheck();
  }

  onPageChange(page: number): void {
    this.paginationState.currentPage = page;
    this.cdr.markForCheck();
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
}
