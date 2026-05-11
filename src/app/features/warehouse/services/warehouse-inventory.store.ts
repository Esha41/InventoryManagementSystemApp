import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { ArrowLeft, ArrowRight } from 'lucide-angular';
import { defaultPageSize } from '@constants/app.constants';
import { LookupItem } from '@models/lookup.model';
import {
  InventoryDetailDto,
  InventoryDto
} from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { BatchAssetFilter, BatchSummaryDto, BatchAssetItemCountDto } from '@models/batch.model';
import { PreviewData } from '@components/import-preview-dialog/import-preview-dialog.component';
import { WarehouseInventoryService } from './warehouse-inventory.service';
import { WarehouseInventoryViewModelService } from './warehouse-inventory-view-model.service';
import { WarehouseInventoryTableSortColumn } from '../pages/inventory/components/inventory-table/inventory-table.component';
import { BatchTableSortColumn } from '../pages/inventory/components/batch-table/batch-table.component';

export type WarehouseInventoryTab = 'ammunition' | 'explosive' | 'batch';
export type WarehouseInventorySortDir = 'asc' | 'desc';

/**
 * Signal-based state container for the warehouse inventory page.
 *
 * Provided at component level so injected `DestroyRef` tracks the hosting
 * component's lifecycle. All state is kept as `signal()`; public access
 * is readonly — mutations go through named methods on this class.
 */
@Injectable()
export class WarehouseInventoryStore {
  readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly warehouseInventory = inject(WarehouseInventoryService);
  private readonly viewModel = inject(WarehouseInventoryViewModelService);

  // ---------- Writable state signals ----------
  private readonly _depoId = signal(0);
  private readonly _depoName = signal('');
  private readonly _currentDepot = signal<LookupItem | null>(null);

  private readonly _inventoryDetails = signal<InventoryDetailDto[]>([]);
  private readonly _filteredInventoryDetails = signal<InventoryDetailDto[]>([]);
  private readonly _loading = signal(true);
  private readonly _error = signal<string | null>(null);
  private readonly _totalItems = signal(0);
  private readonly _activeTab = signal<WarehouseInventoryTab>('ammunition');

  private readonly _batches = signal<BatchSummaryDto[]>([]);
  private readonly _filteredBatches = signal<BatchSummaryDto[]>([]);
  private readonly _expandedBatchId = signal<number | null>(null);
  private readonly _expandedBatchAssets = signal<AssetDto[]>([]);
  private readonly _loadingBatchAssets = signal(false);
  private readonly _expandedBatchAssetsPage = signal(1);
  private readonly _expandedBatchAssetsPageSize = signal(defaultPageSize);
  private readonly _expandedBatchAssetsTotalPages = signal(1);
  private readonly _expandedBatchAssetTotalCount = signal(0);
  private readonly _expandedBatchAssetItemCounts = signal<BatchAssetItemCountDto[]>([]);
  private readonly _expandedBatchAssetsDetailItemId = signal<number | null>(null);
  private readonly _lastAppliedBatchFilter = signal<BatchAssetFilter | undefined>(undefined);

  private readonly _currentPage = signal(1);
  private readonly _rowsPerPage = signal(defaultPageSize);
  private readonly _inventorySortColumn = signal<WarehouseInventoryTableSortColumn>('itemName');
  private readonly _inventorySortDirection = signal<WarehouseInventorySortDir>('asc');
  private readonly _batchSortColumn = signal<BatchTableSortColumn>('batchNumber');
  private readonly _batchSortDirection = signal<WarehouseInventorySortDir>('asc');

  private readonly _suppliers = signal<LookupItem[]>([]);
  private readonly _manufacturers = signal<LookupItem[]>([]);
  private readonly _primaryPurposes = signal<LookupItem[]>([]);
  private readonly _weaponItems = signal<LookupItem[]>([]);
  private readonly _invoiceFilter = signal<string | null>(null);

  private readonly _showImportModal = signal(false);
  private readonly _showPreviewModal = signal(false);
  private readonly _previewData = signal<PreviewData | null>(null);
  private readonly _pendingImportFile = signal<File | null>(null);
  private readonly _isPreviewInProgress = signal(false);
  private readonly _isImportInProgress = signal(false);
  private readonly _batchExcelImportMode = signal(false);
  private readonly _batchImportTargetId = signal<number | null>(null);

  private readonly _showEditModal = signal(false);
  private readonly _showDeleteDialog = signal(false);
  private readonly _selectedDetail = signal<InventoryDetailDto | undefined>(undefined);
  private readonly _currentInventory = signal<InventoryDto | undefined>(undefined);
  private readonly _showEditAssetModal = signal(false);
  private readonly _showDeleteAssetDialog = signal(false);
  private readonly _selectedAsset = signal<AssetDto | null>(null);
  private readonly _loadingAsset = signal(false);
  private readonly _showDeleteBatchDialog = signal(false);
  private readonly _selectedBatch = signal<BatchSummaryDto | null>(null);

  /** Large batch async delete (Hangfire) progress banner */
  private readonly _largeBatchDeletionActive = signal(false);
  private readonly _largeBatchDeletionPercent = signal(0);
  private readonly _largeBatchDeletionMessage = signal('');

  // Language tracked reactively for `isRTL` / localized depot name refresh.
  private readonly _currentLang = signal<string>('en');

  // ---------- Readonly public signals ----------
  readonly depoId: Signal<number> = this._depoId.asReadonly();
  readonly depoName: Signal<string> = this._depoName.asReadonly();
  readonly currentDepot: Signal<LookupItem | null> = this._currentDepot.asReadonly();
  readonly inventoryDetails: Signal<InventoryDetailDto[]> = this._inventoryDetails.asReadonly();
  readonly filteredInventoryDetails: Signal<InventoryDetailDto[]> = this._filteredInventoryDetails.asReadonly();
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  readonly error: Signal<string | null> = this._error.asReadonly();
  readonly totalItems: Signal<number> = this._totalItems.asReadonly();
  readonly activeTab: Signal<WarehouseInventoryTab> = this._activeTab.asReadonly();
  readonly batches: Signal<BatchSummaryDto[]> = this._batches.asReadonly();
  readonly filteredBatches: Signal<BatchSummaryDto[]> = this._filteredBatches.asReadonly();
  readonly expandedBatchId: Signal<number | null> = this._expandedBatchId.asReadonly();
  readonly expandedBatchAssets: Signal<AssetDto[]> = this._expandedBatchAssets.asReadonly();
  readonly loadingBatchAssets: Signal<boolean> = this._loadingBatchAssets.asReadonly();
  readonly expandedBatchAssetsPage: Signal<number> = this._expandedBatchAssetsPage.asReadonly();
  readonly expandedBatchAssetsPageSize: Signal<number> = this._expandedBatchAssetsPageSize.asReadonly();
  readonly expandedBatchAssetsTotalPages: Signal<number> = this._expandedBatchAssetsTotalPages.asReadonly();
  readonly expandedBatchAssetTotalCount: Signal<number> = this._expandedBatchAssetTotalCount.asReadonly();
  readonly expandedBatchAssetItemCounts: Signal<BatchAssetItemCountDto[]> = this._expandedBatchAssetItemCounts.asReadonly();
  readonly expandedBatchAssetsDetailItemId: Signal<number | null> = this._expandedBatchAssetsDetailItemId.asReadonly();
  readonly lastAppliedBatchFilter: Signal<BatchAssetFilter | undefined> = this._lastAppliedBatchFilter.asReadonly();
  readonly currentPage: Signal<number> = this._currentPage.asReadonly();
  readonly rowsPerPage: Signal<number> = this._rowsPerPage.asReadonly();
  readonly inventorySortColumn: Signal<WarehouseInventoryTableSortColumn> = this._inventorySortColumn.asReadonly();
  readonly inventorySortDirection: Signal<WarehouseInventorySortDir> = this._inventorySortDirection.asReadonly();
  readonly batchSortColumn: Signal<BatchTableSortColumn> = this._batchSortColumn.asReadonly();
  readonly batchSortDirection: Signal<WarehouseInventorySortDir> = this._batchSortDirection.asReadonly();
  readonly suppliers: Signal<LookupItem[]> = this._suppliers.asReadonly();
  readonly manufacturers: Signal<LookupItem[]> = this._manufacturers.asReadonly();
  readonly primaryPurposes: Signal<LookupItem[]> = this._primaryPurposes.asReadonly();
  readonly weaponItems: Signal<LookupItem[]> = this._weaponItems.asReadonly();
  readonly invoiceFilter: Signal<string | null> = this._invoiceFilter.asReadonly();
  readonly showImportModal: Signal<boolean> = this._showImportModal.asReadonly();
  readonly showPreviewModal: Signal<boolean> = this._showPreviewModal.asReadonly();
  readonly previewData: Signal<PreviewData | null> = this._previewData.asReadonly();
  readonly pendingImportFile: Signal<File | null> = this._pendingImportFile.asReadonly();
  readonly isPreviewInProgress: Signal<boolean> = this._isPreviewInProgress.asReadonly();
  readonly isImportInProgress: Signal<boolean> = this._isImportInProgress.asReadonly();
  readonly batchExcelImportMode: Signal<boolean> = this._batchExcelImportMode.asReadonly();
  readonly batchImportTargetId: Signal<number | null> = this._batchImportTargetId.asReadonly();
  readonly showEditModal: Signal<boolean> = this._showEditModal.asReadonly();
  readonly showDeleteDialog: Signal<boolean> = this._showDeleteDialog.asReadonly();
  readonly selectedDetail: Signal<InventoryDetailDto | undefined> = this._selectedDetail.asReadonly();
  readonly currentInventory: Signal<InventoryDto | undefined> = this._currentInventory.asReadonly();
  readonly showEditAssetModal: Signal<boolean> = this._showEditAssetModal.asReadonly();
  readonly showDeleteAssetDialog: Signal<boolean> = this._showDeleteAssetDialog.asReadonly();
  readonly selectedAsset: Signal<AssetDto | null> = this._selectedAsset.asReadonly();
  readonly loadingAsset: Signal<boolean> = this._loadingAsset.asReadonly();
  readonly showDeleteBatchDialog: Signal<boolean> = this._showDeleteBatchDialog.asReadonly();
  readonly selectedBatch: Signal<BatchSummaryDto | null> = this._selectedBatch.asReadonly();
  readonly largeBatchDeletionActive: Signal<boolean> = this._largeBatchDeletionActive.asReadonly();
  readonly largeBatchDeletionPercent: Signal<number> = this._largeBatchDeletionPercent.asReadonly();
  readonly largeBatchDeletionMessage: Signal<string> = this._largeBatchDeletionMessage.asReadonly();
  readonly currentLang: Signal<string> = this._currentLang.asReadonly();

  // ---------- Form controls (bindable by child components) ----------
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly supplierFilterControl = new FormControl<number | null>(null);
  readonly manufacturerFilterControl = new FormControl<number | null>(null);
  readonly primaryPurposeFilterControl = new FormControl<number | null>(null);
  readonly batchItemFilterControl = new FormControl<number[]>([], { nonNullable: true });
  readonly batchSupplierFilterControl = new FormControl<number[]>([], { nonNullable: true });
  readonly batchManufacturerFilterControl = new FormControl<number[]>([], { nonNullable: true });
  readonly batchPrimaryPurposeFilterControl = new FormControl<number[]>([], { nonNullable: true });

  // ---------- Computed (derived) signals ----------
  readonly totalPages = computed(() =>
    this.warehouseInventory.getTotalPages(this._totalItems(), this._rowsPerPage())
  );
  readonly paginatedItems: Signal<InventoryDetailDto[]> = this._filteredInventoryDetails.asReadonly();
  readonly paginatedBatches = computed(() =>
    this.viewModel.getPaginatedBatches({
      activeTab: this._activeTab(),
      filteredBatches: this._filteredBatches(),
      currentPage: this._currentPage(),
      rowsPerPage: this._rowsPerPage(),
      sortColumn: this._batchSortColumn(),
      sortDirection: this._batchSortDirection(),
      warehouseInventoryService: this.warehouseInventory
    })
  );
  readonly previewImportAssetType = computed(() =>
    this.viewModel.getPreviewImportAssetType(this._activeTab(), this._batchExcelImportMode())
  );
  readonly isRTL = computed(() => this._currentLang() === 'ar');
  readonly backIcon = computed(() => (this.isRTL() ? ArrowRight : ArrowLeft));

  constructor() {
    this._currentLang.set(this.translate.currentLang || this.translate.defaultLang || 'en');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => this._currentLang.set(e.lang));
  }

  // ---------- Depot / lookups ----------
  setDepoId(id: number): void { this._depoId.set(id); }
  setDepoName(name: string): void { this._depoName.set(name); }
  setCurrentDepot(depot: LookupItem | null): void { this._currentDepot.set(depot); }
  setLookups(input: {
    suppliers?: LookupItem[];
    manufacturers?: LookupItem[];
    primaryPurposes?: LookupItem[];
    weaponItems?: LookupItem[];
  }): void {
    if (input.suppliers !== undefined) this._suppliers.set(input.suppliers);
    if (input.manufacturers !== undefined) this._manufacturers.set(input.manufacturers);
    if (input.primaryPurposes !== undefined) this._primaryPurposes.set(input.primaryPurposes);
    if (input.weaponItems !== undefined) this._weaponItems.set(input.weaponItems);
  }

  // ---------- Loading / error ----------
  setLoading(loading: boolean): void { this._loading.set(loading); }
  setError(error: string | null): void { this._error.set(error); }

  // ---------- Tab / paging / sort ----------
  setActiveTab(tab: WarehouseInventoryTab): void { this._activeTab.set(tab); }
  setCurrentPage(page: number): void { this._currentPage.set(page); }
  setRowsPerPage(size: number): void { this._rowsPerPage.set(size); }
  setInvoiceFilter(value: string | null): void { this._invoiceFilter.set(value); }

  setInventorySort(column: WarehouseInventoryTableSortColumn, direction: WarehouseInventorySortDir): void {
    this._inventorySortColumn.set(column);
    this._inventorySortDirection.set(direction);
  }
  setBatchSort(column: BatchTableSortColumn, direction: WarehouseInventorySortDir): void {
    this._batchSortColumn.set(column);
    this._batchSortDirection.set(direction);
  }

  // ---------- Inventory page data ----------
  setInventoryPage(input: { items: InventoryDetailDto[]; filtered: InventoryDetailDto[]; totalCount: number }): void {
    this._inventoryDetails.set(input.items);
    this._filteredInventoryDetails.set(input.filtered);
    this._totalItems.set(input.totalCount);
  }

  // ---------- Batch list data ----------
  setBatchData(input: {
    batches: BatchSummaryDto[];
    filteredBatches: BatchSummaryDto[];
    totalItems: number;
    lastAppliedFilter?: BatchAssetFilter;
  }): void {
    this._batches.set(input.batches);
    this._filteredBatches.set(input.filteredBatches);
    this._totalItems.set(input.totalItems);
    this._lastAppliedBatchFilter.set(input.lastAppliedFilter);
  }
  replaceFilteredBatches(filteredBatches: BatchSummaryDto[]): void {
    this._filteredBatches.set(filteredBatches);
    this._totalItems.set(filteredBatches.length);
  }
  removeBatchById(batchId: number, applySearch: (batches: BatchSummaryDto[]) => BatchSummaryDto[]): void {
    const next = this._batches().filter(b => b.id !== batchId);
    const filtered = applySearch(next);
    this._batches.set(next);
    this._filteredBatches.set(filtered);
    this._totalItems.set(filtered.length);
  }

  // ---------- Expanded batch assets ----------
  setExpandedBatchId(id: number | null): void { this._expandedBatchId.set(id); }
  clearExpandedBatchAssets(): void { this._expandedBatchAssets.set([]); }
  setLoadingBatchAssets(loading: boolean): void { this._loadingBatchAssets.set(loading); }
  setExpandedBatchAssets(input: {
    assets: AssetDto[];
    totalCount: number;
    totalPages: number;
    page: number;
    pageSize?: number;
    assetItemCounts?: BatchAssetItemCountDto[];
    /** When true, keep existing per-item totals (e.g. detail row uses item-scoped asset fetch). */
    preserveAssetItemCounts?: boolean;
  }): void {
    this._expandedBatchAssets.set(input.assets);
    this._expandedBatchAssetTotalCount.set(input.totalCount);
    this._expandedBatchAssetsTotalPages.set(input.totalPages);
    this._expandedBatchAssetsPage.set(input.page);
    if (input.pageSize != null) this._expandedBatchAssetsPageSize.set(input.pageSize);
    if (!input.preserveAssetItemCounts) {
      this._expandedBatchAssetItemCounts.set(input.assetItemCounts ?? []);
    }
  }
  setExpandedBatchAssetsDetailItemId(itemId: number | null): void {
    this._expandedBatchAssetsDetailItemId.set(itemId);
  }
  setExpandedBatchAssetsPage(page: number): void { this._expandedBatchAssetsPage.set(page); }
  setExpandedBatchAssetsPageSize(size: number): void { this._expandedBatchAssetsPageSize.set(size); }
  resetExpandedBatchAssetState(): void {
    this._expandedBatchAssetsPage.set(1);
    this._expandedBatchAssetsPageSize.set(defaultPageSize);
    this._expandedBatchAssetsTotalPages.set(1);
    this._expandedBatchAssetTotalCount.set(0);
    this._expandedBatchAssetItemCounts.set([]);
    this._expandedBatchAssetsDetailItemId.set(null);
  }

  // ---------- Import UI ----------
  setImportModalOpen(open: boolean): void { this._showImportModal.set(open); }
  setPreviewModalOpen(open: boolean): void { this._showPreviewModal.set(open); }
  setPreviewData(data: PreviewData | null): void { this._previewData.set(data); }
  setPendingImportFile(file: File | null): void { this._pendingImportFile.set(file); }
  setPreviewInProgress(value: boolean): void { this._isPreviewInProgress.set(value); }
  setImportInProgress(value: boolean): void { this._isImportInProgress.set(value); }
  setBatchExcelImportMode(value: boolean): void { this._batchExcelImportMode.set(value); }
  setBatchImportTargetId(id: number | null): void { this._batchImportTargetId.set(id); }
  resetImportState(batchMode: boolean): void {
    this._batchExcelImportMode.set(batchMode);
    this._batchImportTargetId.set(null);
    this._pendingImportFile.set(null);
    this._previewData.set(null);
  }

  // ---------- Inventory detail edit / delete modals ----------
  setEditModalOpen(open: boolean): void { this._showEditModal.set(open); }
  setSelectedDetail(detail: InventoryDetailDto | undefined): void { this._selectedDetail.set(detail); }
  setCurrentInventory(inventory: InventoryDto | undefined): void { this._currentInventory.set(inventory); }
  setDeleteDialogOpen(open: boolean): void { this._showDeleteDialog.set(open); }

  // ---------- Asset edit / delete modals ----------
  setEditAssetModalOpen(open: boolean): void { this._showEditAssetModal.set(open); }
  setSelectedAsset(asset: AssetDto | null): void { this._selectedAsset.set(asset); }
  setLoadingAsset(loading: boolean): void { this._loadingAsset.set(loading); }
  setDeleteAssetDialogOpen(open: boolean): void { this._showDeleteAssetDialog.set(open); }

  // ---------- Batch delete modal ----------
  setDeleteBatchDialogOpen(open: boolean): void { this._showDeleteBatchDialog.set(open); }
  setSelectedBatch(batch: BatchSummaryDto | null): void { this._selectedBatch.set(batch); }

  beginLargeBatchDeletion(message: string): void {
    this._largeBatchDeletionActive.set(true);
    this._largeBatchDeletionPercent.set(0);
    this._largeBatchDeletionMessage.set(message);
  }

  updateLargeBatchDeletionProgress(percent: number, message?: string): void {
    this._largeBatchDeletionPercent.set(Math.max(0, Math.min(100, Math.round(percent))));
    if (message != null && message !== '') {
      this._largeBatchDeletionMessage.set(message);
    }
  }

  endLargeBatchDeletion(): void {
    this._largeBatchDeletionActive.set(false);
    this._largeBatchDeletionPercent.set(0);
    this._largeBatchDeletionMessage.set('');
  }

  // ---------- Composite transitions ----------
  closeEditDetail(): void {
    this._showEditModal.set(false);
    this._selectedDetail.set(undefined);
    this._currentInventory.set(undefined);
  }
  closeDeleteDetail(): void {
    this._showDeleteDialog.set(false);
    this._selectedDetail.set(undefined);
  }
  closeEditAsset(): void { this._showEditAssetModal.set(false); this._selectedAsset.set(null); }
  closeDeleteAsset(): void { this._showDeleteAssetDialog.set(false); this._selectedAsset.set(null); }
  closeDeleteBatch(): void { this._showDeleteBatchDialog.set(false); this._selectedBatch.set(null); }
  collapseExpandedBatch(): void {
    this._expandedBatchId.set(null);
    this._expandedBatchAssets.set([]);
    this.resetExpandedBatchAssetState();
  }
  clearAllFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.supplierFilterControl.setValue(null, { emitEvent: false });
    this.manufacturerFilterControl.setValue(null, { emitEvent: false });
    this.primaryPurposeFilterControl.setValue(null, { emitEvent: false });
    this.batchItemFilterControl.setValue([], { emitEvent: false });
    this.batchSupplierFilterControl.setValue([], { emitEvent: false });
    this.batchManufacturerFilterControl.setValue([], { emitEvent: false });
    this.batchPrimaryPurposeFilterControl.setValue([], { emitEvent: false });
    this._invoiceFilter.set(null);
    this._currentPage.set(1);
  }
  cancelPreview(): void {
    this._showPreviewModal.set(false);
    this._previewData.set(null);
    this._pendingImportFile.set(null);
    this._isPreviewInProgress.set(false);
    this._batchExcelImportMode.set(false);
    this._batchImportTargetId.set(null);
  }
  beginImport(): void {
    this._isImportInProgress.set(true);
    this._loading.set(true);
  }
}
