import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { LucideAngularModule, ArrowLeft, ArrowRight, X } from 'lucide-angular';
import { InventoryService } from '@services/inventory.service';
import { LookupService } from '@services/lookup.service';
import { AssetService } from '@services/asset.service';
import { LookupItem } from '@models/lookup.model';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto, UpdateInventoryDetailDto, InventoryDto } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { EditInventoryDetailModalComponent } from './components/edit-inventory-detail-modal/edit-inventory-detail-modal.component';
import { EditAssetModalComponent } from '../edit-asset/components/edit-asset-modal/edit-asset-modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';
import { WarehouseInventoryFilterService } from './services/warehouse-inventory-filter.service';
import { WarehouseInventoryFormatterService } from './services/warehouse-inventory-formatter.service';
import { WarehouseInventoryCrudService } from './services/warehouse-inventory-crud.service';
import { WarehouseInventoryExportService } from './services/warehouse-inventory-export.service';
import { InventoryTableComponent } from './components/inventory-table/inventory-table.component';
import { AssetTableComponent } from './components/asset-table/asset-table.component';
import { InventoryFiltersComponent } from './components/inventory-filters/inventory-filters.component';

@Component({
  selector: 'app-warehouse-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    LucideAngularModule,
    TranslateModule,
    CardComponent,
    ConfirmDialogComponent,
    EditInventoryDetailModalComponent,
    EditAssetModalComponent,
    DropdownComponent,
    PaginationComponent,
    RowsPerPageComponent,
    HasPermissionDirective,
    LoadingStateComponent,
    ErrorStateComponent,
    InventoryTableComponent,
    AssetTableComponent,
    InventoryFiltersComponent
  ],
  templateUrl: './warehouse-inventory.component.html',
  styleUrls: ['./warehouse-inventory.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WarehouseInventoryComponent implements OnInit, OnDestroy {
  depoId: number = 0;
  depoName: string = '';
  currentDepot: LookupItem | null = null;
  inventoryDetails: InventoryDetailDto[] = [];
  filteredInventoryDetails: InventoryDetailDto[] = [];
  weaponAssets: AssetDto[] = [];
  filteredWeaponAssets: AssetDto[] = [];
  loading = true;
  error: string | null = null;

  // Tab management
  activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly X = X;

  // Search
  searchControl = new FormControl<string>('', { nonNullable: true });

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  // Modal states
  showEditModal = false;
  showDeleteDialog = false;
  showViewModal = false;
  selectedDetail?: InventoryDetailDto;
  selectedDetailForView?: InventoryDetailDto;
  currentInventory?: InventoryDto;
  
  // Asset modal states
  showEditAssetModal = false;
  showDeleteAssetDialog = false;
  selectedAsset: AssetDto | null = null;
  loadingAsset = false;

  private destroy$ = new Subject<void>();

  constructor(
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private assetService: AssetService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private filterService: WarehouseInventoryFilterService,
    private formatterService: WarehouseInventoryFormatterService,
    private crudService: WarehouseInventoryCrudService,
    private exportService: WarehouseInventoryExportService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Initialize tab from query params first (synchronously read initial value)
    const initialQueryParams = this.route.snapshot.queryParams;
    const tabParam = initialQueryParams['tab'];
    if (tabParam && (tabParam === 'ammunition' || tabParam === 'weapon' || tabParam === 'explosive')) {
      this.activeTab = tabParam;
    }

    // Subscribe to query params changes for tab updates
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const tab = params['tab'];
        if (tab && (tab === 'ammunition' || tab === 'weapon' || tab === 'explosive')) {
          if (this.activeTab !== tab) {
            this.activeTab = tab;
            this.currentPage = 1;
            this.applyFilters();
            this.cdr.markForCheck();
          }
        }
      });

    // Subscribe to route params for depot ID
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params['id'];
      if (id) {
        this.depoId = parseInt(id, 10);
        this.loadInventoryData();
      }
    });

    // Subscribe to language changes to update depot name
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.currentDepot) {
          this.depoName = getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) || `Depot ${this.depoId}`;
          this.cdr.markForCheck();
        }
      });

    // Subscribe to search changes
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        startWith(this.searchControl.value),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.applyFilters();
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInventoryData(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      depot: this.lookupService.getDepots(),
      inventoryDetails: this.inventoryService.getWarehouseInventoryItems(this.depoId),
      weaponAssets: this.assetService.getByDepotId<AssetDto>(this.depoId)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ depot, inventoryDetails, weaponAssets }) => {
          // Find the specific depot
          this.currentDepot = depot.find((d: LookupItem) => d.id === this.depoId) || null;
          this.depoName = getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) || `Depot ${this.depoId}`;

          // Normalize inventory details using filter service
          this.inventoryDetails = this.filterService.normalizeInventoryDetails(inventoryDetails);
          this.weaponAssets = weaponAssets || [];
          this.applyFilters();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = 'Failed to load inventory data';
          this.loading = false;
          this.cdr.markForCheck();
          this.translateService.get(['toast.failedToLoadInventory', 'toast.error']).subscribe(translations => {
            this.toastService.error(translations['toast.failedToLoadInventory'] || 'Failed to load inventory data', translations['toast.error']);
          });
        }
      });
  }


  switchTab(tab: 'ammunition' | 'weapon' | 'explosive'): void {
    if (this.activeTab === tab) {
      return; // Already on this tab, no need to update
    }
    
    this.activeTab = tab;
    this.currentPage = 1;
    this.updateQueryParams(tab);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  /**
   * Update query parameters with current tab
   * Uses merge to preserve other query params (like search, pagination, etc.)
   */
  private updateQueryParams(tab: 'ammunition' | 'weapon' | 'explosive'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: false // Allow browser back/forward to work properly
    });
  }

  /**
   * Apply both tab filter and search filter
   */
  applyFilters(): void {
    // For weapon tab, filter weapon assets
    if (this.activeTab === 'weapon') {
      this.filteredWeaponAssets = this.filterService.filterAssetsBySearch(
        this.weaponAssets,
        this.searchControl.value,
        (asset) => this.formatterService.getAssetItemName(asset)
      );
    } else {
      // For ammunition and explosive tabs, filter inventory items
      let filtered = this.filterService.filterByTab(this.inventoryDetails, this.activeTab);
      filtered = this.filterService.filterInventoryBySearch(
        filtered,
        this.searchControl.value,
        (detail) => this.formatterService.getItemName(detail),
        (detail) => this.formatterService.getItemNo(detail),
        (detail) => this.formatterService.getSupplierName(detail)
      );
      this.filteredInventoryDetails = filtered;
    }

    this.validateCurrentPage();
    this.cdr.markForCheck();
  }


  get totalPages(): number {
    const totalItems = this.activeTab === 'weapon'
      ? this.filteredWeaponAssets.length
      : this.filteredInventoryDetails.length;
    if (totalItems === 0) {
      return 1;
    }
    return Math.ceil(totalItems / this.rowsPerPage);
  }

  get paginatedItems(): InventoryDetailDto[] {
    // Ensure currentPage is valid before slicing
    this.validateCurrentPage();
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.filteredInventoryDetails.slice(startIndex, startIndex + this.rowsPerPage);
  }

  get paginatedAssets(): AssetDto[] {
    // Ensure currentPage is valid before slicing
    this.validateCurrentPage();
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.filteredWeaponAssets.slice(startIndex, startIndex + this.rowsPerPage);
  }

  private validateCurrentPage(): void {
    const maxPages = this.totalPages;
    if (this.currentPage > maxPages && maxPages > 0) {
      this.currentPage = maxPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.cdr.markForCheck();
    }
  }

  onBackToWarehouses(): void {
    this.router.navigate(['/warehouse']);
  }

  /**
   * Check if an item is static (weapon/explosive dummy data)
   */
  isStaticItem(detail: InventoryDetailDto): boolean {
    return this.filterService.isStaticItem(detail);
  }

  onViewItem(detail: InventoryDetailDto): void {
    // For static items (weapons/explosives), show view modal
    if (this.isStaticItem(detail)) {
      this.selectedDetailForView = detail;
      this.showViewModal = true;
      this.cdr.markForCheck();
    } else {
      // For inventory items, navigate to inventory detail page with tab query param
      this.router.navigate(['/warehouse', this.depoId, 'inventory', detail.id], {
        queryParams: { tab: this.activeTab },
        queryParamsHandling: 'merge'
      });
    }
  }

  /**
   * Close view modal
   */
  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedDetailForView = undefined;
    this.cdr.markForCheck();
  }

  onRowsPerPageChange(newSize: number): void {
    this.rowsPerPage = newSize;
    this.currentPage = 1; // Reset to first page
    this.validateCurrentPage();
    this.cdr.markForCheck();
  }

  // Delegate formatting methods to formatter service
  getItemName = (detail: InventoryDetailDto | null | undefined) => this.formatterService.getItemName(detail);
  getItemNo = (detail: InventoryDetailDto) => this.formatterService.getItemNo(detail);
  getSupplierName = (detail: InventoryDetailDto) => this.formatterService.getSupplierName(detail);
  getHccName = (detail: InventoryDetailDto) => this.formatterService.getHccName(detail);
  getAssetItemName = (asset: AssetDto | null | undefined) => this.formatterService.getAssetItemName(asset);
  getAssetItemNo = (asset: AssetDto) => this.formatterService.getAssetItemNo(asset);
  getAssetStatusLabel = (asset: AssetDto) => this.formatterService.getAssetStatusLabel(asset);
  formatDate = (date?: Date | string) => this.formatterService.formatDate(date);
  formatNumber = (num: number) => this.formatterService.formatNumber(num);


  /**
   * Refresh inventory data
   */
  refreshInventory(): void {
    this.loadInventoryData();
    this.cdr.markForCheck();
  }


  /**
   * Navigate to add inventory page
   */
  onAddInventory(): void {
    this.router.navigate(['/warehouse', this.depoId, 'inventory', 'add']);
  }

  /**
   * Navigate to add weapon asset page
   */
  onAddWeaponAsset(): void {
    this.router.navigate(['/warehouse', this.depoId, 'assets', 'add']);
  }

  /**
   * View asset details
   */
  onViewAsset(asset: AssetDto): void {
    this.router.navigate(['/warehouse', this.depoId, 'assets', asset.id], {
      queryParams: { tab: this.activeTab },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Edit asset
   */
  onEditAsset(asset: AssetDto): void {
    // Reload asset to ensure we have latest data
    this.loadingAsset = true;
    this.selectedAsset = asset;
    this.cdr.markForCheck();
    this.crudService.loadAssetForEdit(asset.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedAsset) => {
          this.selectedAsset = updatedAsset || null;
          this.loadingAsset = false;
          this.showEditAssetModal = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingAsset = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Delete asset
   */
  onDeleteAsset(asset: AssetDto): void {
    this.selectedAsset = asset;
    this.showDeleteAssetDialog = true;
    this.cdr.markForCheck();
  }

  /**
   * Handle edit asset modal closed
   */
  onEditAssetModalClosed(): void {
    this.showEditAssetModal = false;
    this.selectedAsset = null;
    // Reload weapon assets after edit
    this.loadInventoryData();
    this.cdr.markForCheck();
  }

  /**
   * Handle edit asset modal saved
   */
  onEditAssetModalSaved(): void {
    // Data will be reloaded in onEditAssetModalClosed
  }

  /**
   * Handle delete asset confirmation
   */
  onDeleteAssetConfirm(): void {
    if (!this.selectedAsset) return;

    this.showDeleteAssetDialog = false;
    const assetToDelete = this.selectedAsset;
    this.selectedAsset = null;
    this.cdr.markForCheck();

    this.crudService.deleteAsset(assetToDelete.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.success) {
            this.loadInventoryData();
          } else {
            this.translateService.get(['toast.error', 'warehouseInventory.failedToDeleteAsset']).subscribe(translations => {
              this.toastService.error(
                result.error || translations['warehouseInventory.failedToDeleteAsset'] || 'Failed to delete asset',
                translations['toast.error']
              );
            });
          }
        },
        error: (error) => {
          this.translateService.get(['toast.error', 'warehouseInventory.failedToDeleteAsset']).subscribe(translations => {
            this.toastService.error(
              translations['warehouseInventory.failedToDeleteAsset'] || 'Failed to delete asset',
              translations['toast.error']
            );
          });
        }
      });
  }

  /**
   * Handle delete asset cancellation
   */
  onDeleteAssetCancel(): void {
    this.showDeleteAssetDialog = false;
    this.selectedAsset = null;
    this.cdr.markForCheck();
  }

  /**
   * Get delete asset message
   */
  getDeleteAssetMessage(): string {
    return this.formatterService.getDeleteAssetMessage(this.selectedAsset);
  }

  /**
   * Open edit modal for inventory detail
   */
  onEditItem(detail: InventoryDetailDto): void {
    this.selectedDetail = detail;

    // Load the full inventory record for this detail
    this.inventoryService.getById(detail.inventoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inventory) => {
          this.currentInventory = inventory || undefined;
          this.showEditModal = true;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.translateService.get('toast.failedToLoadDetails').subscribe(msg => {
            this.toastService.error(msg);
          });
        }
      });
  }

  /**
   * Open delete confirmation dialog
   */
  onDeleteItem(detail: InventoryDetailDto): void {
    this.selectedDetail = detail;
    this.showDeleteDialog = true;
    this.cdr.markForCheck();
  }

  /**
   * Handle edit modal save
   */
  onEditSave(updateDetailDto: UpdateInventoryDetailDto): void {
    if (!this.currentInventory || !this.selectedDetail) return;

    // Store references before clearing
    const detailToEdit = this.selectedDetail;
    const inventoryToUpdate = this.currentInventory;

    // Close modal immediately for better UX
    this.showEditModal = false;
    this.selectedDetail = undefined;
    this.currentInventory = undefined;
    this.cdr.markForCheck();

    this.crudService.editInventoryDetail(detailToEdit, inventoryToUpdate, updateDetailDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.success && result.updatedInventory) {
            // Reload inventory data
            this.loadInventoryData();
          } else {
            this.translateService.get(['toast.failedToUpdate', 'toast.error']).subscribe(translations => {
              this.toastService.error(result.error || translations['toast.failedToUpdate'], translations['toast.error']);
            });
          }
        },
        error: (error) => {
          this.translateService.get(['toast.failedToUpdate', 'toast.error']).subscribe(translations => {
            const errorMsg = error.error?.message || translations['toast.failedToUpdate'];
            this.toastService.error(errorMsg, translations['toast.error']);
          });
        }
      });
  }

  /**
   * Handle delete confirmation
   */
  onDeleteConfirm(): void {
    if (!this.selectedDetail) return;

    this.showDeleteDialog = false;
    const detailToDelete = this.selectedDetail;
    this.selectedDetail = undefined;
    this.cdr.markForCheck();

    this.crudService.deleteInventoryDetail(detailToDelete)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.success) {
            this.loadInventoryData();
          } else {
            this.translateService.get(['toast.failedToDelete', 'toast.error']).subscribe(translations => {
              this.toastService.error(result.error || translations['toast.failedToDelete'], translations['toast.error']);
            });
          }
        },
        error: (error) => {
          this.translateService.get(['toast.failedToDelete', 'toast.error']).subscribe(translations => {
            this.toastService.error(translations['toast.failedToDelete'], translations['toast.error']);
          });
        }
      });
  }

  /**
   * Close edit modal
   */
  onEditModalClose(): void {
    this.showEditModal = false;
    this.selectedDetail = undefined;
    this.currentInventory = undefined;
    this.cdr.markForCheck();
  }

  /**
   * Close delete dialog
   */
  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.selectedDetail = undefined;
    this.cdr.markForCheck();
  }

  /**
   * Export filtered inventory to Excel
   */
  exportToExcel(): void {
    this.exportService.exportInventoryToExcel(
      this.filteredInventoryDetails,
      this.depoName,
      this.activeTab,
      this.getItemName,
      this.formatDate
    );
  }
}
