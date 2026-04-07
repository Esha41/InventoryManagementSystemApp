import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin, merge, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { debounceTime, startWith } from 'rxjs/operators';
import { LucideAngularModule, ArrowLeft, ArrowRight, X, Eye, Edit, Trash2, Download, Upload, FileText } from 'lucide-angular';
import { InventoryService } from '@services/inventory.service';
import { AssetService } from '@services/asset.service';
import { LookupService } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto, UpdateInventoryDetailDto, UpdateInventoryDto, InventoryDto, ItemType } from '@models/inventory.model';
import { FilterData } from '@models/pagination.model';
import { AssetDto } from '@models/asset.model';
import { BatchDto, BatchSummaryDto, BatchAssetFilter } from '@models/batch.model';
import { BatchService } from '@services/batch.service';
import { WeaponService } from '@services/weapon.service';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { EditInventoryDetailModalComponent } from './components/edit-inventory-detail-modal/edit-inventory-detail-modal.component';
import { EditAssetModalComponent } from '@assets/pages/edit/components/edit-asset-modal/edit-asset-modal.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';
import { WarehouseInventoryFilterService } from './services/warehouse-inventory-filter.service';
import { WarehouseInventoryFormatterService } from './services/warehouse-inventory-formatter.service';
import { WarehouseInventoryCrudService } from './services/warehouse-inventory-crud.service';
import { WarehouseInventoryExportService } from './services/warehouse-inventory-export.service';
import { InventoryTableComponent, WarehouseInventoryTableSortColumn } from './components/inventory-table/inventory-table.component';
import { BatchTableComponent, BatchTableSortColumn } from './components/batch-table/batch-table.component';
import { InventoryFiltersComponent } from './components/inventory-filters/inventory-filters.component';
import { trackById } from '@utils/trackby.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ImportDialogComponent } from '@components/import-dialog/import-dialog.component';
import { ImportPreviewDialogComponent, PreviewData } from '@components/import-preview-dialog/import-preview-dialog.component';
import { ImportExportService } from '@services/import-export.service';
import { APIOperationResponse } from '@models/api-response.model';
import { ImportResult } from '@models/import-result.model';
import { mapImportResultToPreviewData } from '@core/utils/asset-master-import-preview.utils';
import { IImportableService } from '@core/interfaces/importable-service.interface';
import {
  WAREHOUSE_DEPOT_EXPORT_PERMISSIONS,
  WAREHOUSE_DEPOT_INVENTORY_IMPORT_PERMISSIONS,
  WAREHOUSE_DEPOT_ASSET_IMPORT_PERMISSIONS
} from '@core/constants/asset-import-export-permissions';

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
    InventoryFiltersComponent,
    ImportDialogComponent,
    ImportPreviewDialogComponent
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
  expandedBatchAssetsPage = 1;
  expandedBatchAssetsPageSize = 50;
  expandedBatchAssetsTotalPages = 1;
  expandedBatchAssetTotalCount = 0;
  expandedBatchAssetsAllLoaded = false;
  /** Snapshot of filters last applied to the batch summary API (Apply / initial load / clear). Expand batch uses this so it matches the table. */
  lastAppliedBatchFilter: BatchAssetFilter | undefined;
  readonly batchAssetsPageSizeOptions = [50, 100, 200, 500];

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;

  /** Server-side sort for ammunition / explosives table */
  inventorySortColumn: WarehouseInventoryTableSortColumn = 'itemName';
  inventorySortDirection: 'asc' | 'desc' = 'asc';

  /** Client-side sort for weapon batches (full list loaded) */
  batchSortColumn: BatchTableSortColumn = 'batchNumber';
  batchSortDirection: 'asc' | 'desc' = 'asc';

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly X = X;
  readonly Eye = Eye;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Download = Download;
  readonly Upload = Upload;
  readonly FileText = FileText;
  readonly trackById = trackById;

  readonly warehouseExportPerms = [...WAREHOUSE_DEPOT_EXPORT_PERMISSIONS];
  readonly warehouseInventoryImportPerms = [...WAREHOUSE_DEPOT_INVENTORY_IMPORT_PERMISSIONS];
  readonly warehouseAssetImportPerms = [...WAREHOUSE_DEPOT_ASSET_IMPORT_PERMISSIONS];

  showImportModal = false;
  showPreviewModal = false;
  previewData: PreviewData | null = null;
  pendingImportFile: File | null = null;
  isPreviewInProgress = false;
  isImportInProgress = false;

  /** When true, import/preview uses POST /Batch/{id}/assets/import*. */
  batchExcelImportMode = false;
  batchImportTargetId: number | null = null;

  // Search
  searchControl = new FormControl<string>('', { nonNullable: true });
  supplierFilterControl = new FormControl<number | null>(null);
  manufacturerFilterControl = new FormControl<number | null>(null);
  primaryPurposeFilterControl = new FormControl<number | null>(null);
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];
  primaryPurposes: LookupItem[] = [];
  weaponItems: LookupItem[] = [];
  invoiceFilter: string | null = null; // Track specific invoice filter

  // Batch multi-select filter controls
  batchItemFilterControl = new FormControl<number[]>([], { nonNullable: true });
  batchSupplierFilterControl = new FormControl<number[]>([], { nonNullable: true });
  batchManufacturerFilterControl = new FormControl<number[]>([], { nonNullable: true });
  batchPrimaryPurposeFilterControl = new FormControl<number[]>([], { nonNullable: true });

  readonly supplierLookupLabel = (option: DropdownOption<LookupItem> | LookupItem | null) => {
    const item = this.unwrapLookupOption(option);
    return item ? getLocalizedName(item, getCurrentLang(this.translateService)) || '' : '';
  };

  readonly manufacturerLookupLabel = (option: DropdownOption<LookupItem> | LookupItem | null) => {
    const item = this.unwrapLookupOption(option);
    return item ? getLocalizedName(item, getCurrentLang(this.translateService)) || '' : '';
  };

  readonly primaryPurposeLookupLabel = (option: DropdownOption<LookupItem> | LookupItem | null) => {
    const item = this.unwrapLookupOption(option);
    return item ? getLocalizedName(item, getCurrentLang(this.translateService)) || '' : '';
  };

  readonly batchLookupLabel = (option: DropdownOption<LookupItem> | LookupItem | null) => {
    const item = this.unwrapLookupOption(option);
    return item ? getLocalizedName(item, getCurrentLang(this.translateService)) || '' : '';
  };

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  get previewImportAssetType(): 'ammunition' | 'weapon' | 'explosive' | 'batch' {
    if (this.batchExcelImportMode) return 'batch';
    if (this.activeTab === 'explosive') return 'explosive';
    if (this.activeTab === 'batch') return 'weapon';
    return 'ammunition';
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
    private assetService: AssetService,
    private lookupService: LookupService,
    private batchService: BatchService,
    private weaponService: WeaponService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private filterService: WarehouseInventoryFilterService,
    private formatterService: WarehouseInventoryFormatterService,
    private crudService: WarehouseInventoryCrudService,
    private exportService: WarehouseInventoryExportService,
    private importExportService: ImportExportService,
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

    merge(
      this.supplierFilterControl.valueChanges,
      this.manufacturerFilterControl.valueChanges,
      this.primaryPurposeFilterControl.valueChanges
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.activeTab === 'batch') {
          return;
        }
        this.currentPage = 1;
        this.updatePageInUrl();
        this.loadTabContent();
        this.cdr.markForCheck();
      });

  }

  /** User clicks "Apply filters" — loads batch summary from API with current multi-select filters (no auto-call on change). */
  onApplyBatchFilters(): void {
    if (this.activeTab !== 'batch') {
      return;
    }
    this.currentPage = 1;
    this.updatePageInUrl();
    this.loadServerSideBatches();
    this.cdr.markForCheck();
  }

  onSearch(): void {
    // Clear invoice filter when doing general search
    this.invoiceFilter = null;
    this.currentPage = 1; // Reset to first page
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onClearInventoryFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.supplierFilterControl.setValue(null, { emitEvent: false });
    this.manufacturerFilterControl.setValue(null, { emitEvent: false });
    this.primaryPurposeFilterControl.setValue(null, { emitEvent: false });
    this.batchItemFilterControl.setValue([], { emitEvent: false });
    this.batchSupplierFilterControl.setValue([], { emitEvent: false });
    this.batchManufacturerFilterControl.setValue([], { emitEvent: false });
    this.batchPrimaryPurposeFilterControl.setValue([], { emitEvent: false });
    this.invoiceFilter = null;
    this.currentPage = 1;
    this.updatePageInUrl();
    if (this.activeTab !== 'batch') {
      this.loadTabContent();
    } else {
      this.loadServerSideBatches();
    }
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
      queryParams: { 
        page: this.currentPage > 1 ? this.currentPage : null,
        tab: this.activeTab
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private loadDepotAndAssets(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      depots: this.lookupService.getDepots(),
      suppliers: this.lookupService.getSuppliers().pipe(catchError(() => of([] as LookupItem[]))),
      manufacturers: this.lookupService.getManufacturers().pipe(catchError(() => of([] as LookupItem[]))),
      primaryPurposes: this.lookupService.getPrimaryPurposes().pipe(catchError(() => of([] as LookupItem[]))),
      weapons: this.weaponService.getAll().pipe(catchError(() => of([] as any[])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ depots, suppliers, manufacturers, primaryPurposes, weapons }) => {
          this.suppliers = suppliers ?? [];
          this.manufacturers = manufacturers ?? [];
          this.primaryPurposes = primaryPurposes ?? [];
          this.weaponItems = (weapons ?? []).map((w: any) => ({
            id: w.id,
            nameEn: w.nameEn ?? w.name ?? '',
            nameAr: w.nameAr ?? '',
          } as LookupItem));
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
        error: () => {
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

  private buildBatchAssetFilter(): BatchAssetFilter | undefined {
    const f: BatchAssetFilter = {};
    const items = this.batchItemFilterControl.value;
    const suppliers = this.batchSupplierFilterControl.value;
    const manufacturers = this.batchManufacturerFilterControl.value;
    const purposes = this.batchPrimaryPurposeFilterControl.value;
    if (items?.length) f.itemIds = items;
    if (suppliers?.length) f.supplierIds = suppliers;
    if (manufacturers?.length) f.manufacturerIds = manufacturers;
    if (purposes?.length) f.primaryPurposeIds = purposes;
    return f.itemIds || f.supplierIds || f.manufacturerIds || f.primaryPurposeIds ? f : undefined;
  }

  private loadServerSideBatches(): void {
    this.loading = true;
    this.expandedBatchId = null;
    this.expandedBatchAssets = [];
    this.resetExpandedBatchAssetState();
    this.cdr.markForCheck();

    const filters = this.buildBatchAssetFilter();
    this.batchService.getSummary(this.depoId, filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (batches) => {
          this.lastAppliedBatchFilter = filters;
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
    const searchTermRaw = this.searchControl.value ?? '';
    const searchTerm = searchTermRaw.trim();
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
      let itemType = ItemType.Ammunition;
      if (this.activeTab === 'explosive') itemType = ItemType.Explosive;

      const filters: any[] = [
        { field: 'Item.ItemType', operator: 'eq', value: itemType.toString() }
      ];

      const supplierId = this.supplierFilterControl.value;
      if (supplierId != null) {
        filters.push({ field: 'SupplierId', operator: 'eq', value: String(supplierId) });
      }
      const manufacturerId = this.manufacturerFilterControl.value;
      if (manufacturerId != null) {
        filters.push({ field: 'ManufacturerId', operator: 'eq', value: String(manufacturerId) });
      }
      const primaryPurposeId = this.primaryPurposeFilterControl.value;
      if (primaryPurposeId != null) {
        filters.push({ field: 'PrimaryPurposId', operator: 'eq', value: String(primaryPurposeId) });
      }

      // If filtering by specific invoice number, use exact match
      if (this.invoiceFilter) {
        filters.push({
          field: 'Inventory.InvoiceNumber',
          operator: 'eq',
          value: this.invoiceFilter
        });
      } else if (searchTerm) {
        const orFilters: any[] = [
          { field: 'Item.Name', operator: 'contains', value: searchTerm },
          { field: 'Item.ItemNo', operator: 'contains', value: searchTerm },
          { field: 'BatchNo', operator: 'contains', value: searchTerm },
          { field: 'Lot', operator: 'contains', value: searchTerm },
          { field: 'Supplier.NameEn', operator: 'contains', value: searchTerm },
          { field: 'Supplier.NameAr', operator: 'contains', value: searchTerm },
          { field: 'Inventory.InvoiceNumber', operator: 'contains', value: searchTerm }
        ];

        filters.push({
          logic: 'or',
          filters: orFilters
        });
      }

      const sortField = this.resolveInventoryBackendSortField(this.inventorySortColumn);
      const sortDirection = this.inventorySortDirection === 'asc' ? 1 : 2;

      filterData = {
        logic: 'and',
        filters,
        sortField,
        sortDirection
      };
    }

    return {
      page: this.currentPage,
      pageSize: this.rowsPerPage,
      filter: filterData
    };
  }

  private resolveInventoryBackendSortField(column: WarehouseInventoryTableSortColumn): string {
    const lang = getCurrentLang(this.translateService);
    const supplierField = lang === 'ar' ? 'Supplier.NameAr' : 'Supplier.NameEn';
    const manufacturerField = lang === 'ar' ? 'Manufacturer.NameAr' : 'Manufacturer.NameEn';
    const map: Record<WarehouseInventoryTableSortColumn, string> = {
      itemName: 'Item.Name',
      supplier: supplierField,
      manufacturer: manufacturerField,
      lot: 'Lot',
      quantity: 'ItemQuantity',
      readyForIssue: 'ReadyForIssue',
      expiryDate: 'ExpiryDate',
      invoiceNumber: 'Inventory.InvoiceNumber'
    };
    return map[column];
  }

  private defaultDirectionForInventoryColumn(column: WarehouseInventoryTableSortColumn): 'asc' | 'desc' {
    switch (column) {
      case 'quantity':
      case 'readyForIssue':
        return 'desc';
      case 'expiryDate':
        return 'asc';
      default:
        return 'asc';
    }
  }

  onInventorySort(column: WarehouseInventoryTableSortColumn): void {
    if (this.inventorySortColumn === column) {
      this.inventorySortDirection = this.inventorySortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.inventorySortColumn = column;
      this.inventorySortDirection = this.defaultDirectionForInventoryColumn(column);
    }
    this.currentPage = 1;
    this.updatePageInUrl();
    if (this.activeTab !== 'batch') {
      this.loadTabContent();
    }
    this.cdr.markForCheck();
  }

  private defaultDirectionForBatchColumn(column: BatchTableSortColumn): 'asc' | 'desc' {
    return column === 'quantity' ? 'desc' : 'asc';
  }

  onBatchSort(column: BatchTableSortColumn): void {
    if (this.batchSortColumn === column) {
      this.batchSortDirection = this.batchSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.batchSortColumn = column;
      this.batchSortDirection = this.defaultDirectionForBatchColumn(column);
    }
    this.cdr.markForCheck();
  }

  private sortBatches(batches: BatchSummaryDto[]): BatchSummaryDto[] {
    const list = [...batches];
    const mul = this.batchSortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (this.batchSortColumn === 'quantity') {
        return mul * (a.quantity - b.quantity);
      }
      return mul * (a.batchNumber || '').localeCompare(b.batchNumber || '', undefined, { numeric: true, sensitivity: 'base' });
    });
    return list;
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
    const sorted = this.sortBatches(this.filteredBatches);
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return sorted.slice(start, start + this.rowsPerPage);
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
  getManufacturerName = (detail: InventoryDetailDto) => this.formatterService.getManufacturerName(detail);
  getPrimaryPurposeName = (detail: InventoryDetailDto) => this.formatterService.getPrimaryPurposeName(detail);
  getHccName = (detail: InventoryDetailDto) => this.formatterService.getHccName(detail);
  getAssetItemName = (asset: AssetDto | null | undefined) => this.formatterService.getAssetItemName(asset);
  getAssetDepartmentLabel = (asset: AssetDto) => this.formatterService.getAssetDepartmentLabel(asset);
  getAssetCustodianLabel = (asset: AssetDto) => this.formatterService.getAssetCustodianLabel(asset);
  getAssetSupplierLabel = (asset: AssetDto) => this.formatterService.getAssetSupplierLabel(asset);
  getAssetManufacturerLabel = (asset: AssetDto) => this.formatterService.getAssetManufacturerLabel(asset);
  getAssetPrimaryPurposeLabel = (asset: AssetDto) => this.formatterService.getAssetPrimaryPurposeLabel(asset);
  formatAssetPurchasePrice = (price?: number | null) => this.formatterService.formatAssetPurchasePrice(price);
  truncateAssetNotes = (asset: AssetDto) => this.formatterService.truncateText(asset.notes, 80);
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
      this.resetExpandedBatchAssetState();
      this.cdr.markForCheck();
      return;
    }
    this.expandedBatchId = batch.id;
    this.resetExpandedBatchAssetState();
    this.fetchExpandedBatchAssets();
  }

  private resetExpandedBatchAssetState(): void {
    this.expandedBatchAssetsPage = 1;
    this.expandedBatchAssetsPageSize = 50;
    this.expandedBatchAssetsTotalPages = 1;
    this.expandedBatchAssetTotalCount = 0;
    this.expandedBatchAssetsAllLoaded = false;
  }

  /**
   * Loads assets for the currently expanded batch using server pagination (or include-all when enabled).
   */
  private fetchExpandedBatchAssets(options?: { showLoading?: boolean }): void {
    const showLoading = options?.showLoading !== false;
    if (this.expandedBatchId == null) return;
    if (showLoading) {
      this.loadingBatchAssets = true;
      this.cdr.markForCheck();
    }
    const id = this.expandedBatchId;
    const filters = this.lastAppliedBatchFilter;
    const request$ = this.expandedBatchAssetsAllLoaded
      ? this.batchService.getById(id, { includeAllAssets: true, filters })
      : this.batchService.getById(id, {
          assetsPage: this.expandedBatchAssetsPage,
          assetsPageSize: this.expandedBatchAssetsPageSize,
          filters
        });
    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (fullBatch) => {
        this.expandedBatchAssets = fullBatch?.assets ?? [];
        this.expandedBatchAssetTotalCount = fullBatch?.assetCount ?? 0;
        this.expandedBatchAssetsTotalPages = fullBatch?.assetsTotalPages ?? 1;
        this.expandedBatchAssetsPage = fullBatch?.assetsPageIndex ?? 1;
        if (!this.expandedBatchAssetsAllLoaded && fullBatch?.assetsPageSize != null) {
          this.expandedBatchAssetsPageSize = fullBatch.assetsPageSize;
        }
        this.loadingBatchAssets = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingBatchAssets = false;
        this.expandedBatchId = null;
        this.expandedBatchAssets = [];
        this.resetExpandedBatchAssetState();
        this.cdr.markForCheck();
      }
    });
  }

  onExpandedBatchAssetsPageChange(page: number): void {
    this.expandedBatchAssetsPage = page;
    this.fetchExpandedBatchAssets();
  }

  onExpandedBatchAssetsPageSizeChange(size: number): void {
    this.expandedBatchAssetsPageSize = size;
    this.expandedBatchAssetsPage = 1;
    this.fetchExpandedBatchAssets();
  }

  onExpandedBatchAssetsLoadAll(): void {
    this.expandedBatchAssetsAllLoaded = true;
    this.expandedBatchAssetsPage = 1;
    this.fetchExpandedBatchAssets();
  }

  onExpandedBatchAssetsUsePagination(): void {
    this.expandedBatchAssetsAllLoaded = false;
    this.expandedBatchAssetsPage = 1;
    this.fetchExpandedBatchAssets();
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
            this.resetExpandedBatchAssetState();
          }
          this.batches = this.batches.filter(b => b.id !== batchToDelete.id);
          this.filteredBatches = this.applyBatchSearch(this.batches);
          this.totalItems = this.filteredBatches.length;
          this.translateService.get('warehouseInventory.batchDeleted').pipe(takeUntil(this.destroy$)).subscribe(msg =>
            this.toastService.success(msg, this.translateService.instant('toast.success'))
          );
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          const fallback = this.translateService.instant('warehouseInventory.failedToDeleteBatch');
          const msg = ErrorHandler.extractAndTranslateErrorMessage(err, fallback, this.translateService);
          this.toastService.error(msg, this.translateService.instant('toast.error'));
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
  onEditSave(data: { detail: UpdateInventoryDetailDto; inventory: UpdateInventoryDto; files?: File[]; removedFileIds?: number[] }): void {
    if (!this.currentInventory || !this.selectedDetail) return;

    // Store references before clearing
    const detailToEdit = this.selectedDetail;
    const inventoryToUpdate = this.currentInventory;

    // Close modal immediately for better UX
    this.showEditModal = false;
    this.selectedDetail = undefined;
    this.currentInventory = undefined;
    this.cdr.markForCheck();

    this.crudService.editInventoryDetail(detailToEdit, inventoryToUpdate, data.detail, data.inventory, data.files, data.removedFileIds)
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
            const errorMsg = ErrorHandler.extractAndTranslateErrorMessage(error, translations['toast.failedToDelete'], this.translateService);
            this.toastService.error(errorMsg, translations['toast.error']);
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
   * Export current tab (inventory lines, batch summaries, or weapon assets when a batch is expanded is not used — export is list-level).
   */
  exportDepotToExcel(): void {
    if (this.activeTab === 'batch') {
      this.exportService.exportBatchSummariesToExcel(this.filteredBatches, this.depoName);
      return;
    }
    this.exportService.exportInventoryToExcel(
      this.filteredInventoryDetails,
      this.depoName,
      this.activeTab,
      this.getItemName,
      this.formatDate,
      this.activeTab === 'ammunition' || this.activeTab === 'explosive'
        ? this.getPrimaryPurposeName
        : undefined
    );
  }

  private unwrapLookupOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (option == null) {
      return null;
    }
    if (typeof option === 'object' && option !== null && 'value' in option) {
      return (option as DropdownOption<T>).value as T;
    }
    return option as T;
  }

  onWarehouseImportClick(): void {
    if (!this.depoId) {
      this.toastService.warning('Depot not loaded');
      return;
    }
    this.batchExcelImportMode = false;
    this.batchImportTargetId = null;
    this.pendingImportFile = null;
    this.previewData = null;
    this.showImportModal = true;
    this.cdr.markForCheck();
  }

  onExportBatchAssetsExcel(batch: BatchSummaryDto): void {
    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    this.batchService.exportAssetsExcel(batch.id, lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const nameSafe = (batch.batchNumber || `batch_${batch.id}`).replace(/[^\w.-]+/g, '_');
          const fileName = `${nameSafe}_BatchAssets_${new Date().toISOString().slice(0, 10)}.xlsx`;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          window.URL.revokeObjectURL(url);
          this.translateService.get(['common.exportSuccess', 'toast.success']).pipe(takeUntil(this.destroy$))
            .subscribe(t => this.toastService.success(t['common.exportSuccess'], t['toast.success']));
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Export failed'));
          this.cdr.markForCheck();
        }
      });
  }

  onImportBatchAssetsExcel(batch: BatchSummaryDto): void {
    if (!this.depoId) {
      this.toastService.warning('Depot not loaded');
      return;
    }
    this.batchExcelImportMode = true;
    this.batchImportTargetId = batch.id;
    this.pendingImportFile = null;
    this.previewData = null;
    this.showImportModal = true;
    this.cdr.markForCheck();
  }

  /** User dismissed import dialog — clear batch-scoped import context too. */
  onImportDialogClose(): void {
    this.pendingImportFile = null;
    this.showImportModal = false;
    this.batchExcelImportMode = false;
    this.batchImportTargetId = null;
    this.cdr.markForCheck();
  }

  private hideImportModal(): void {
    this.showImportModal = false;
    this.cdr.markForCheck();
  }

  private clearBatchImportContext(): void {
    this.batchExcelImportMode = false;
    this.batchImportTargetId = null;
  }

  downloadWarehouseTemplate(): void {
    if (!this.depoId) {
      this.toastService.warning('Depot not loaded');
      return;
    }
    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const service = this.getWarehouseImportService();
    service
      .generateImportTemplate(lang, this.depoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const fileName =
            this.activeTab === 'batch'
              ? `Weapon_Asset_Import_Template_Depot_${this.depoId}.xlsx`
              : `Inventory_Import_Template_Depot_${this.depoId}.xlsx`;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          window.URL.revokeObjectURL(url);
          this.toastService.success('Template downloaded successfully');
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Failed to download template'));
          this.cdr.markForCheck();
        }
      });
  }

  onWarehouseImportPreview(file: File): void {
    if (!this.depoId) return;
    if (this.isPreviewInProgress) {
      this.toastService.warning('Preview is already in progress. Please wait...');
      return;
    }
    const useBatchExcel =
      this.batchExcelImportMode && this.batchImportTargetId != null && this.activeTab === 'batch';
    const batchImportId = this.batchImportTargetId;

    this.previewData = null;
    this.showPreviewModal = false;
    this.isPreviewInProgress = true;
    this.loading = true;
    this.hideImportModal();
    this.pendingImportFile = file;
    this.cdr.markForCheck();

    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const preview$ = useBatchExcel && batchImportId != null
      ? this.batchService.importBatchAssetsPreview(file, lang, batchImportId)
      : this.getWarehouseImportService().importPreview(file, lang, this.depoId);

    preview$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isPreviewInProgress = false;
          this.loading = false;

          if (!res?.succeeded || !res.data) {
            this.previewData = null;
            this.toastService.error(res?.message || 'Preview failed');
            this.clearBatchImportContext();
            this.cdr.markForCheck();
            return;
          }

          const preview = mapImportResultToPreviewData(
            res.data,
            useBatchExcel && batchImportId != null
              ? { excludeColumns: ['assetId', 'itemId'], batchImportActions: true }
              : undefined
          );
          if (preview) {
            this.previewData = preview;
            this.showPreviewModal = true;
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.isPreviewInProgress = false;
          this.loading = false;
          this.previewData = null;
          this.clearBatchImportContext();
          this.toastService.error(`Preview failed: ${ErrorHandler.extractErrorMessage(error, 'Unknown error')}`);
          this.cdr.markForCheck();
        }
      });
  }

  onWarehouseImportDirect(file: File): void {
    if (!this.depoId) return;
    if (this.isImportInProgress) {
      this.toastService.warning('Import is already in progress. Please wait...');
      return;
    }
    const useBatchExcel =
      this.batchExcelImportMode && this.batchImportTargetId != null && this.activeTab === 'batch';
    const batchImportId = this.batchImportTargetId;

    this.isImportInProgress = true;
    this.loading = true;
    this.hideImportModal();
    this.cdr.markForCheck();

    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const import$ = useBatchExcel && batchImportId != null
      ? this.batchService.importBatchAssets(file, lang, batchImportId)
      : this.getWarehouseImportService().importData(file, lang, this.depoId);

    import$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isImportInProgress = false;
          this.loading = false;
          this.clearBatchImportContext();
          if (res?.succeeded && res.data) {
            const result = res.data;
            this.importExportService.handleImportResult({
              successCount: result.successCount ?? result.successfulRecords?.length ?? 0,
              failureCount: result.errors?.length ?? 0,
              errors: result.errors || [],
              message: res?.message
            });
            this.loadTabContent();
          } else {
            this.toastService.error(res?.message || 'Import failed');
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.isImportInProgress = false;
          this.loading = false;
          this.clearBatchImportContext();
          this.toastService.error(`Import failed: ${ErrorHandler.extractErrorMessage(error, 'Unknown error')}`);
          this.cdr.markForCheck();
        }
      });
  }

  onWarehousePreviewConfirmed(_rows: unknown[]): void {
    this.showPreviewModal = false;
    this.previewData = null;
    if (!this.pendingImportFile || !this.depoId) {
      this.toastService.error('Import file not found. Please try uploading again.');
      this.clearBatchImportContext();
      this.cdr.markForCheck();
      return;
    }
    if (this.isImportInProgress) {
      this.toastService.warning('Import is already in progress. Please wait...');
      this.cdr.markForCheck();
      return;
    }

    const useBatchExcel =
      this.batchExcelImportMode && this.batchImportTargetId != null && this.activeTab === 'batch';
    const batchImportId = this.batchImportTargetId;

    this.isImportInProgress = true;
    this.loading = true;
    const file = this.pendingImportFile;
    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const import$ = useBatchExcel && batchImportId != null
      ? this.batchService.importBatchAssets(file, lang, batchImportId)
      : this.getWarehouseImportService().importData(file, lang, this.depoId);

    import$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isImportInProgress = false;
          this.loading = false;
          this.pendingImportFile = null;
          this.clearBatchImportContext();
          if (res?.succeeded && res.data) {
            const result = res.data;
            this.importExportService.handleImportResult({
              successCount: result.successCount ?? result.successfulRecords?.length ?? 0,
              failureCount: result.errors?.length ?? 0,
              errors: result.errors || [],
              message: res?.message
            });
            this.loadTabContent();
          } else {
            this.toastService.error(res?.message || 'Import failed');
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.isImportInProgress = false;
          this.loading = false;
          this.pendingImportFile = null;
          this.clearBatchImportContext();
          this.toastService.error(`Import failed: ${ErrorHandler.extractErrorMessage(error, 'Unknown error')}`);
          this.cdr.markForCheck();
        }
      });
  }

  onWarehousePreviewCancelled(): void {
    this.showPreviewModal = false;
    this.previewData = null;
    this.pendingImportFile = null;
    this.isPreviewInProgress = false;
    this.clearBatchImportContext();
    this.cdr.markForCheck();
  }

  private getWarehouseImportService(): IImportableService {
    return this.activeTab === 'batch' ? this.assetService : this.inventoryService;
  }
}
