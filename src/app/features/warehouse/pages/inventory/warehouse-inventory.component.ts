import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { LucideAngularModule, ArrowLeft, ArrowRight, X, Eye, Edit, Trash2 } from 'lucide-angular';
import { InventoryService } from '@services/inventory.service';
import { LookupService } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto, UpdateInventoryDetailDto, UpdateInventoryDto, InventoryDto, ItemType } from '@models/inventory.model';
import { FilterData } from '@models/pagination.model';
import { AssetDto } from '@models/asset.model';
import { BatchDto, BatchSummaryDto } from '@models/batch.model';
import { BatchService } from '@services/batch.service';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { EditInventoryDetailModalComponent } from './components/edit-inventory-detail-modal/edit-inventory-detail-modal.component';
import { EditAssetModalComponent } from '@assets/pages/edit/components/edit-asset-modal/edit-asset-modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';
import { WarehouseInventoryFilterService } from './services/warehouse-inventory-filter.service';
import { WarehouseInventoryFormatterService } from './services/warehouse-inventory-formatter.service';
import { WarehouseInventoryCrudService } from './services/warehouse-inventory-crud.service';
import { WarehouseInventoryExportService } from './services/warehouse-inventory-export.service';
import { InventoryTableComponent } from './components/inventory-table/inventory-table.component';
import { BatchTableComponent } from './components/batch-table/batch-table.component';
import { InventoryFiltersComponent } from './components/inventory-filters/inventory-filters.component';
import { trackById } from '@utils/trackby.utils';
import { ErrorHandler } from '@utils/error-handler.utils';

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
    PaginationComponent,
    RowsPerPageComponent,
    HasPermissionDirective,
    LoadingStateComponent,
    ErrorStateComponent,
    InventoryTableComponent,
    BatchTableComponent,
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
  // filteredInventoryDetails will now act as the data source for the table
  // For server-side pagination, it holds the current page items
  filteredInventoryDetails: InventoryDetailDto[] = [];
  loading = true;
  error: string | null = null;
  totalItems = 0; // Total count for server-side pagination

  // Tab management
  activeTab: 'ammunition' | 'explosive' | 'batch' = 'ammunition';

  // Batch data (lightweight list with quantity only)
  batches: BatchSummaryDto[] = [];
  filteredBatches: BatchSummaryDto[] = [];

  // Expanded batch: when user clicks a row, we fetch assets for that batch
  expandedBatchId: number | null = null;
  expandedBatchAssets: AssetDto[] = [];
  loadingBatchAssets = false;

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly X = X;
  readonly Eye = Eye;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly trackById = trackById;

  // Search
  searchControl = new FormControl<string>('', { nonNullable: true });
  invoiceFilter: string | null = null; // Track specific invoice filter

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  // Modal states
  showEditModal = false;
  showDeleteDialog = false;
  selectedDetail?: InventoryDetailDto;
  currentInventory?: InventoryDto;

  // Asset modal states
  showEditAssetModal = false;
  showDeleteAssetDialog = false;
  selectedAsset: AssetDto | null = null;
  loadingAsset = false;

  // Batch delete
  showDeleteBatchDialog = false;
  selectedBatch: BatchSummaryDto | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private batchService: BatchService,
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
    // Initialize tab and page from query params first (synchronously read initial value)
    const initialQueryParams = this.route.snapshot.queryParams;
    const tabParam = initialQueryParams['tab'];
    if (tabParam && (tabParam === 'ammunition' || tabParam === 'explosive' || tabParam === 'batch')) {
      this.activeTab = tabParam;
    } else if (tabParam === 'weapon') {
      this.activeTab = 'batch';
    }
    this.syncPageFromQueryParams();

    // Subscribe to query params changes for tab and page updates
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const tab = params['tab'];
        const effectiveTab = tab === 'weapon' ? 'batch' : tab;
        if (effectiveTab && (effectiveTab === 'ammunition' || effectiveTab === 'explosive' || effectiveTab === 'batch')) {
          if (this.activeTab !== effectiveTab) {
            this.activeTab = effectiveTab;
            this.currentPage = 1;
            this.applyFilters();
            this.cdr.markForCheck();
          }
        }
        const page = params['page'];
        if (page) {
          const parsed = parseInt(page, 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed !== this.currentPage) {
            this.currentPage = parsed;
            if (this.activeTab !== 'batch') {
              this.loadTabContent();
            }
            this.cdr.markForCheck();
          }
        }
      });

    // Subscribe to route params for depot ID
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params['id'];
      if (id) {
        this.depoId = parseInt(id, 10);
        this.loadDepotAndAssets(); // Initial load of depot info and assets
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
  }

  onSearch(): void {
    // Clear invoice filter when doing general search
    this.invoiceFilter = null;
    this.currentPage = 1; // Reset to first page
    this.applyFilters();
    this.cdr.markForCheck();
  }

  searchByInvoice(invoiceNumber: string): void {
    // Set invoice filter specifically and clear general search
    this.invoiceFilter = invoiceNumber;
    this.searchControl.setValue('');
    this.currentPage = 1; // Reset to first page
    this.applyFilters();
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Read page from URL query params (Angular best practice: URL reflects state) */
  private syncPageFromQueryParams(): void {
    const page = this.route.snapshot.queryParamMap.get('page');
    if (page) {
      const parsed = parseInt(page, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        this.currentPage = parsed;
      }
    }
  }

  /** Update URL with current page (preserves other query params) */
  private updatePageInUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: this.currentPage > 1 ? this.currentPage : null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private loadDepotAndAssets(): void {
    this.loading = true;
    this.error = null;

    // Only load depot info initially. Data will be loaded based on active tab.
    this.lookupService.getDepots()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots) => {
          this.currentDepot = depots.find((d: LookupItem) => d.id === this.depoId) || null;
          this.depoName = this.currentDepot
            ? getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) || `Depot ${this.depoId}`
            : '';

          if (!this.currentDepot) {
            this.error = 'accessDenied';
            this.loading = false;
            this.cdr.markForCheck();
            return;
          }

          // Initial tab load
          this.loadTabContent();

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = 'Failed to load depot data';
          this.loading = false;
          this.cdr.markForCheck();
          this.translateService.get(['toast.failedToLoadInventory', 'toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(translations['toast.failedToLoadInventory'] || 'Failed to load data', translations['toast.error']);
          });
        }
      });
  }

  private loadTabContent(): void {
    if (this.activeTab === 'batch') {
      this.loadServerSideBatches();
    } else {
      this.loadServerSideInventory();
    }
  }

  private loadServerSideBatches(): void {
    this.loading = true;
    this.expandedBatchId = null;
    this.expandedBatchAssets = [];
    this.cdr.markForCheck();

    this.batchService.getSummary(this.depoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (batches) => {
          this.batches = batches || [];
          this.filteredBatches = this.applyBatchSearch(this.batches);
          this.totalItems = this.filteredBatches.length;
          this.validateCurrentPage();
          this.updatePageInUrl();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Failed to load batch data';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private applyBatchSearch(batches: BatchSummaryDto[]): BatchSummaryDto[] {
    const term = this.searchControl.value?.trim()?.toLowerCase();
    if (!term) return batches;
    return batches.filter(b =>
      b.batchNumber?.toLowerCase().includes(term)
    );
  }

  private loadServerSideInventory(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const request = this.buildPagedRequest();

    this.inventoryService.getInventoryDetailsPaginated(this.depoId, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.inventoryDetails = response.items || [];
          this.filteredInventoryDetails = this.filterService.normalizeInventoryDetails(this.inventoryDetails);
          this.totalItems = response.totalCount;
          this.validateCurrentPage();
          this.updatePageInUrl();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = 'Failed to load inventory data';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  buildPagedRequest() {
    const searchTerm = this.searchControl.value?.trim();
    let filterData: FilterData | undefined;

    if (this.activeTab === 'batch') {
      const filters: any[] = [];
      if (searchTerm) {
        filters.push({
          logic: 'or',
          filters: [
            { field: 'BatchNumber', operator: 'contains', value: searchTerm }
          ]
        });
      }
      if (filters.length > 0) {
        filterData = { logic: 'and', filters };
      }
    } else {
      // Filter for Inventory (Ammo/Explosive)
      // 1. Determine ItemType based on activeTab
      let itemType = ItemType.Ammunition;
      if (this.activeTab === 'explosive') itemType = ItemType.Explosive;

      const filters: any[] = [
        { field: 'Item.ItemType', operator: 'eq', value: itemType.toString() }
      ];

      // If filtering by specific invoice number, use exact match
      if (this.invoiceFilter) {
        filters.push({
          field: 'Inventory.InvoiceNumber',
          operator: 'eq',
          value: this.invoiceFilter
        });
      } else if (searchTerm) {
        // Add search term filters if provided (general search)
        filters.push({
          logic: 'or',
          filters: [
            { field: 'Item.Name', operator: 'contains', value: searchTerm },
            { field: 'Item.ItemNo', operator: 'contains', value: searchTerm },
            { field: 'BatchNo', operator: 'contains', value: searchTerm },
            { field: 'Supplier.NameEn', operator: 'contains', value: searchTerm },
            { field: 'Supplier.NameAr', operator: 'contains', value: searchTerm },
            { field: 'Inventory.InvoiceNumber', operator: 'contains', value: searchTerm }
          ]
        });
      }

      filterData = {
        logic: 'and',
        filters
      };
    }

    return {
      page: this.currentPage,
      pageSize: this.rowsPerPage,
      filter: filterData
    };
  }


  switchTab(tab: 'ammunition' | 'explosive' | 'batch'): void {
    if (this.activeTab === tab) {
      return; // Already on this tab, no need to update
    }

    this.activeTab = tab;
    this.currentPage = 1;
    this.invoiceFilter = null; // Clear invoice filter when switching tabs
    this.updateQueryParams(tab);
    this.updatePageInUrl();

    // Always load content (which handles switching strategy)
    this.loadTabContent();
    this.cdr.markForCheck();
  }

  /**
   * Update query parameters with current tab and page
   * Uses merge to preserve other query params (like search, etc.)
   */
  private updateQueryParams(tab: 'ammunition' | 'explosive' | 'batch', includePage = false): void {
    const queryParams: Record<string, string | number | null> = { tab };
    if (includePage && this.currentPage > 1) {
      queryParams['page'] = this.currentPage;
    } else if (includePage) {
      queryParams['page'] = null;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: !includePage
    });
  }

  /**
   * Apply both tab filter and search filter
   */
  applyFilters(): void {
    this.currentPage = 1;
    if (this.activeTab === 'batch') {
      this.filteredBatches = this.applyBatchSearch(this.batches);
      this.totalItems = this.filteredBatches.length;
    } else {
      this.loadTabContent();
    }
    this.cdr.markForCheck();
  }


  get totalPages(): number {
    // Unified logic for server-side pagination
    return this.totalItems === 0 ? 1 : Math.ceil(this.totalItems / this.rowsPerPage);
  }

  get paginatedItems(): InventoryDetailDto[] {
    return this.filteredInventoryDetails;
  }

  get paginatedBatches(): BatchSummaryDto[] {
    if (this.activeTab !== 'batch') return [];
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.filteredBatches.slice(start, start + this.rowsPerPage);
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
      this.updatePageInUrl();
      if (this.activeTab !== 'batch') {
        this.loadTabContent();
      }
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

  isItemExpired(item: InventoryDetailDto): boolean {
    if (!item.expiryDate) return false;
    const expiry = new Date(item.expiryDate);
    return expiry < new Date();
  }

  onViewItem(detail: InventoryDetailDto): void {
    // For static items (weapons/explosives), navigate to item detail page
    if (this.isStaticItem(detail) && detail.item) {
      // Navigate to asset-list detail page with tab query param
      this.router.navigate(['/asset-list', detail.item.id], {
        queryParams: { tab: this.activeTab }
      });
    } else {
      // For inventory items, navigate to inventory detail page with tab query param
      this.router.navigate(['/warehouse', this.depoId, 'inventory', detail.id], {
        queryParams: { tab: this.activeTab },
        queryParamsHandling: 'merge'
      });
    }
  }


  onRowsPerPageChange(newSize: number): void {
    this.rowsPerPage = newSize;
    this.currentPage = 1;
    this.updatePageInUrl();
    if (this.activeTab !== 'batch') {
      this.loadTabContent();
    }
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
    this.loadTabContent();
    this.cdr.markForCheck();
  }


  /**
   * Navigate to add inventory page
   */
  onAddInventory(): void {
    const queryParams: Record<string, string | number> = { tab: this.activeTab };
    if (this.currentPage > 1) {
      queryParams['page'] = this.currentPage;
    }
    this.router.navigate(['/warehouse', this.depoId, 'inventory', 'add'], {
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Navigate to add weapon asset page
   */
  onAddWeaponAsset(): void {
    const queryParams = this.currentPage > 1 ? { page: this.currentPage } : {};
    this.router.navigate(['/warehouse', this.depoId, 'assets', 'add'], {
      queryParams: Object.keys(queryParams).length ? queryParams : undefined
    });
  }

  onBatchRowClick(batch: BatchSummaryDto): void {
    if (this.expandedBatchId === batch.id) {
      this.expandedBatchId = null;
      this.expandedBatchAssets = [];
      this.cdr.markForCheck();
      return;
    }
    this.expandedBatchId = batch.id;
    this.loadingBatchAssets = true;
    this.expandedBatchAssets = [];
    this.cdr.markForCheck();

    this.batchService.getById(batch.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (fullBatch) => {
          this.expandedBatchAssets = fullBatch?.assets ?? [];
          this.loadingBatchAssets = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingBatchAssets = false;
          this.expandedBatchId = null;
          this.cdr.markForCheck();
        }
      });
  }

  onEditBatch(batch: BatchSummaryDto): void {
    this.router.navigate(['/warehouse', this.depoId, 'batches', batch.id, 'edit']);
  }

  onDeleteBatch(batch: BatchSummaryDto): void {
    this.selectedBatch = batch;
    this.showDeleteBatchDialog = true;
    this.cdr.markForCheck();
  }

  onDeleteBatchConfirm(): void {
    if (!this.selectedBatch) return;

    this.showDeleteBatchDialog = false;
    const batchToDelete = this.selectedBatch;
    this.selectedBatch = null;
    this.cdr.markForCheck();

    this.batchService.delete(batchToDelete.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.expandedBatchId === batchToDelete.id) {
            this.expandedBatchId = null;
            this.expandedBatchAssets = [];
          }
          this.batches = this.batches.filter(b => b.id !== batchToDelete.id);
          this.filteredBatches = this.applyBatchSearch(this.batches);
          this.totalItems = this.filteredBatches.length;
          this.translateService.get('warehouseInventory.batchDeleted').pipe(takeUntil(this.destroy$)).subscribe(msg =>
            this.toastService.success(msg, this.translateService.instant('toast.success'))
          );
          this.cdr.markForCheck();
        },
        error: () => {
          this.toastService.error(
            this.translateService.instant('warehouseInventory.failedToDeleteBatch'),
            this.translateService.instant('toast.error')
          );
          this.cdr.markForCheck();
        }
      });
  }

  onDeleteBatchCancel(): void {
    this.showDeleteBatchDialog = false;
    this.selectedBatch = null;
    this.cdr.markForCheck();
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
    this.loadDepotAndAssets();
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
            this.loadDepotAndAssets();
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
    // Load the full inventory record for this detail
    this.inventoryService.getById(detail.inventoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inventory) => {
          this.currentInventory = inventory || undefined;

          // Find the updated detail from the loaded inventory to ensure we have the latest data
          if (inventory && inventory.inventoryDetails) {
            const updatedDetail = inventory.inventoryDetails.find(d => d.id === detail.id);
            this.selectedDetail = updatedDetail || detail; // Fallback to original if not found
          } else {
            this.selectedDetail = detail;
          }

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
  onEditSave(data: { detail: UpdateInventoryDetailDto; inventory: UpdateInventoryDto }): void {
    if (!this.currentInventory || !this.selectedDetail) return;

    // Store references before clearing
    const detailToEdit = this.selectedDetail;
    const inventoryToUpdate = this.currentInventory;

    // Close modal immediately for better UX
    this.showEditModal = false;
    this.selectedDetail = undefined;
    this.currentInventory = undefined;
    this.cdr.markForCheck();

    this.crudService.editInventoryDetail(detailToEdit, inventoryToUpdate, data.detail, data.inventory)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.success && result.updatedInventory) {
            // Reload inventory data
            this.refreshInventory();
          } else {
            this.translateService.get(['toast.failedToUpdate', 'toast.error']).subscribe(translations => {
              this.toastService.error(result.error || translations['toast.failedToUpdate'], translations['toast.error']);
            });
          }
        },
        error: (error) => {
          this.translateService.get(['toast.failedToUpdate', 'toast.error']).subscribe(translations => {
            const errorMsg = ErrorHandler.extractAndTranslateErrorMessage(error, translations['toast.failedToUpdate'], this.translateService);
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
            this.refreshInventory();
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
    if (this.activeTab === 'batch') {
      return;
    }
    this.exportService.exportInventoryToExcel(
      this.filteredInventoryDetails,
      this.depoName,
      this.activeTab,
      this.getItemName,
      this.formatDate
    );
  }
}
