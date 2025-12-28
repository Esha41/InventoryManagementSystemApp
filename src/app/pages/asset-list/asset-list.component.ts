import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, forkJoin, Subject, takeUntil, timer, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { LucideAngularModule, Search, Filter, Edit, Trash2, Eye, Plus, X, ArrowUpDown, ArrowUp, ArrowDown, FilterX, Download, Upload } from 'lucide-angular';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { LookupService } from '@services/lookup.service';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { AmmunitionReadDto, AmmunitionCreateDto, LookupDto } from '@models/ammunition.model';
import { WeaponDto, CreateUpdateWeaponDto } from '@models/weapon.model';
import { ExplosiveDto, CreateUpdateExplosiveDto } from '@models/explosive.model';
import { LookupItem } from '@models/lookup.model';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent } from '@components/index';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
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
import { ImportDialogComponent } from '@components/import-dialog/import-dialog.component';

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
    AssetEditModalComponent,
    ImportDialogComponent
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
    private cdr: ChangeDetectorRef,
    private excelExportService: ExcelExportService
  ) { }

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

      // Subscribe to language changes to reload assets with new localized names
      this.translateService.onLangChange
        .pipe(takeUntil(this.destroy$))
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
    // Extract image IDs from response and fetch as blobs for all asset types
    this.loadImagesFromResponse();
  }

  private loadImagesFromResponse(): void {
    const imageRequests = this.assets
      .map(asset => {
        const originalData = asset.originalData as any;
        if (!originalData?.images || originalData.images.length === 0) {
          return null;
        }

        // Get main image or first image
        const image = originalData.images.find((img: any) => img.isMain) || originalData.images[0];
        if (!image?.id) {
          return null;
        }

        // Get the appropriate service based on active tab
        let fileBlob$: Observable<Blob>;
        if (this.activeTab === 'ammunition') {
          fileBlob$ = this.ammunitionService.getFileBlob(image.id);
        } else if (this.activeTab === 'weapon') {
          fileBlob$ = this.weaponService.getFileBlob(image.id);
        } else if (this.activeTab === 'explosive') {
          fileBlob$ = this.explosiveService.getFileBlob(image.id);
        } else {
          return null;
        }

        return fileBlob$.pipe(
          map((blob: Blob) => {
            if (blob.type && blob.type.startsWith('image/')) {
              const blobUrl = URL.createObjectURL(blob);
              return { assetId: asset.id, url: blobUrl };
            }
            return { assetId: asset.id, url: null };
          }),
          catchError((err) => {
            console.error(`Failed to load image for asset ${asset.id}:`, err);
            return of({ assetId: asset.id, url: null });
          })
        );
      })
      .filter((req): req is Observable<{ assetId: string; url: string | null }> => req !== null);

    if (imageRequests.length === 0) return;

    forkJoin(imageRequests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          results.forEach(({ assetId, url }) => {
            const asset = this.assets.find(a => a.id === assetId);
            if (asset && url) {
              asset.imageUrl = url;
              this.blobUrls.add(url);
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
          if (res.succeeded) {
            const result = res.data;
            if (result.errors && result.errors.length > 0) {
              let msg = `Imported ${result.successCount} items. ${result.failureCount} failed.`;

              // If only 1-2 errors, show the first reason
              if (result.failureCount <= 2 && result.errors[0]?.errorMessage) {
                // Clean up the message a bit if it's too long
                let reason = result.errors[0].errorMessage;

                // Extract inner exception if present for cleaner message
                if (reason.includes("(Inner:")) {
                  const parts = reason.split("(Inner:");
                  if (parts.length > 1) {
                    reason = parts[1].replace(")", "").trim();
                  }
                }

                if (reason.length > 300) reason = reason.substring(0, 300) + '...';
                msg += ` Reason: ${reason}`;
              }
              else {
                // Check for common issues in bulk
                const hasDuplicates = result.errors.some((e: any) =>
                  e.errorMessage?.toLowerCase().includes('duplicate') ||
                  e.errorMessage?.toLowerCase().includes('already exists')
                );
                if (hasDuplicates) msg += " (Duplicates found)";
                else msg += " Check console for details.";
              }

              this.toastService.warning(msg);
              console.warn('Import Validation Errors:', result.errors);
            } else {
              this.toastService.success(`Imported ${result.successCount} items successfully.`);
            }
            this.loadAssets();
          } else {
            this.toastService.error(res.message || 'Import failed');
          }
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.loading = false;
          this.toastService.error('Import failed');
          console.error(err);
          this.cdr.markForCheck();
        }
      });
  }

  downloadImportTemplate(): void {
    let headers: ExcelColumn[] = [];
    let sampleData: any[] = [];

    if (this.activeTab === 'ammunition') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Arm Number', key: 'armNumber' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'Bullet Diameter', key: 'bulletDiameter' },
        { header: 'Is Linked', key: 'isLinked' },
        { header: 'Primer', key: 'primer' },
        { header: 'Total Weight', key: 'totalWeight' },
        { header: 'NSN', key: 'nsn' }
      ];

      sampleData = [
        {
          name: '6.5×55mm Swedish',
          itemNo: 'AMM-111',
          partNo: 'P-655-SWE',
          armNumber: 'ARM-111',
          price: 4.8,
          minimumQuantity: 100,
          bulletDiameter: 6.5,
          isLinked: false,
          primer: 'Boxer',
          totalWeight: 25.1,
          nsn: '1305-01-612-4419'
        },
        {
          name: '7.62×51mm NATO',
          itemNo: 'AMM-112',
          partNo: 'P-762-NATO',
          armNumber: 'ARM-112',
          price: 5.2,
          minimumQuantity: 200,
          bulletDiameter: 7.62,
          isLinked: true,
          primer: 'Berdan',
          totalWeight: 25.4,
          nsn: '1305-01-234-5678'
        }
      ];
    } else if (this.activeTab === 'weapon') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'NSN', key: 'nsn' },
        { header: 'Weapon Type', key: 'weaponType' },
        { header: 'Caliber', key: 'caliber' },
        { header: 'Action Type', key: 'actionType' },
        { header: 'Barrel Length', key: 'barrelLength' },
        { header: 'Overall Length', key: 'overallLength' },
        { header: 'Weight', key: 'weight' },
        { header: 'Capacity', key: 'capacity' }
      ];

      sampleData = [
        {
          name: 'M4 Carbine',
          itemNo: 'WPN-001',
          partNo: 'M4-5.56',
          price: 850.00,
          minimumQuantity: 10,
          nsn: '1005-01-231-0973',
          weaponType: 'Rifle',
          caliber: '5.56×45mm NATO',
          actionType: 'SemiAutomatic',
          barrelLength: 14.5,
          overallLength: 33,
          weight: 6.9,
          capacity: 30
        }
      ];
    } else if (this.activeTab === 'explosive') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'NSN', key: 'nsn' },
        { header: 'Explosive Type', key: 'explosiveType' },
        { header: 'UN Number', key: 'unNumber' },
        { header: 'Net Explosive Quantity', key: 'netExplosiveQuantity' },
        { header: 'Total Weight', key: 'totalWeight' }
      ];

      sampleData = [
        {
          name: 'C-4 Plastic Explosive',
          itemNo: 'EXP-001',
          partNo: 'C4-1.25',
          price: 125.00,
          minimumQuantity: 5,
          nsn: '1375-00-122-2956',
          explosiveType: 'PlasticExplosive',
          unNumber: 'UN0056',
          netExplosiveQuantity: 1.25,
          totalWeight: 1.5
        }
      ];
    }

    this.excelExportService.exportToExcel({
      fileName: `${this.activeTab}_import_template`,
      columns: headers,
      data: sampleData,
      sheetName: 'Import Template',
      includeTimestamp: false
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

  /**
   * Export filtered assets to Excel
   */
  exportToExcel(): void {
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

    // Add tab-specific columns
    if (this.activeTab === 'ammunition') {
      columns.push(
        {
          header: this.translateService.instant('assetList.table.caseType'),
          key: 'caseType',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('assetList.table.hazardDivision'),
          key: 'hazardDivision',
          width: 20,
          format: (value: string | LookupDto) => {
            if (!value) return '-';
            if (typeof value === 'string') return value;
            return getLookupDisplayName(value, this.translateService) || '-';
          }
        }
      );
    } else if (this.activeTab === 'weapon') {
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
    } else if (this.activeTab === 'explosive') {
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

    // Add common columns
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

    const fileName = `Asset_List_${this.activeTab.charAt(0).toUpperCase() + this.activeTab.slice(1)}`;

    this.excelExportService.exportToExcel({
      fileName: fileName,
      sheetName: this.activeTab.charAt(0).toUpperCase() + this.activeTab.slice(1),
      columns: columns,
      data: this.filteredAssets,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }
}
