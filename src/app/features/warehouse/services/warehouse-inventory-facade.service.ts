import { DestroyRef, Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge, timer } from 'rxjs';
import { finalize, switchMap, takeWhile, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';
import { InventoryDetailDto, ItemType, UpdateInventoryDetailDto, UpdateInventoryDto } from '@models/inventory.model';
import { AssetBulkDeletionScope, AssetDto } from '@models/asset.model';
import { AssetService } from '@assets/services/asset.service';
import { BatchSummaryDto, BatchAssetFilter } from '@models/batch.model';
import { WarehouseInventoryStore, WarehouseInventoryTab } from './warehouse-inventory.store';
import { WarehouseInventoryService } from './warehouse-inventory.service';
import { WarehouseInventoryDataService } from './warehouse-inventory-data.service';
import { WarehouseInventoryImportService } from './warehouse-inventory-import.service';
import { WarehouseInventoryFilterService } from '../pages/inventory/services/warehouse-inventory-filter.service';
import { WarehouseInventoryCrudService } from '../pages/inventory/services/warehouse-inventory-crud.service';
import { WarehouseInventoryExportService } from '../pages/inventory/services/warehouse-inventory-export.service';
import { WarehouseInventoryTableSortColumn } from '../pages/inventory/components/inventory-table/inventory-table.component';
import { BatchTableSortColumn } from '../pages/inventory/components/batch-table/batch-table.component';

/** Orchestrator for the warehouse inventory page. Component-scoped so injected
 * `DestroyRef` tracks the host. Owns no state — see {@link WarehouseInventoryStore}. */
@Injectable()
export class WarehouseInventoryFacadeService {
  private static readonly ASYNC_BATCH_DELETE_THRESHOLD = 500;

  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(WarehouseInventoryStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly toastService = inject(ToastService);
  private readonly filterService = inject(WarehouseInventoryFilterService);
  private readonly inventoryCore = inject(WarehouseInventoryService);
  private readonly dataService = inject(WarehouseInventoryDataService);
  private readonly importFlow = inject(WarehouseInventoryImportService);
  private readonly crudService = inject(WarehouseInventoryCrudService);
  private readonly exportService = inject(WarehouseInventoryExportService);
  private readonly assetService = inject(AssetService);

  initialize(): void {
    this.bootstrapFromInitialQuery();
    this.bindQueryParamChanges();
    this.bindRouteParamChanges();
    this.bindLanguageChanges();
    this.bindFilterControlChanges();
  }

  switchTab(tab: WarehouseInventoryTab): void {
    if (this.store.activeTab() === tab) return;
    this.store.setActiveTab(tab);
    this.store.setCurrentPage(1);
    this.store.setInvoiceFilter(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
    this.updatePageInUrl();
    this.loadTabContent();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.store.totalPages()) return;
    this.store.setCurrentPage(page);
    this.updatePageInUrl();
    if (this.store.activeTab() !== 'batch') this.loadTabContent();
  }

  onRowsPerPageChange(newSize: number): void {
    this.store.setRowsPerPage(newSize);
    this.store.setCurrentPage(1);
    this.updatePageInUrl();
    if (this.store.activeTab() !== 'batch') this.loadTabContent();
  }

  onSearch(): void {
    this.store.setInvoiceFilter(null);
    this.store.setCurrentPage(1);
    this.applyFilters();
  }

  onClearInventoryFilters(): void {
    this.store.clearAllFilters();
    this.updatePageInUrl();
    if (this.store.activeTab() !== 'batch') this.loadTabContent();
    else this.loadServerSideBatches();
  }

  onApplyBatchFilters(): void {
    if (this.store.activeTab() !== 'batch') return;
    this.store.setCurrentPage(1);
    this.updatePageInUrl();
    this.loadServerSideBatches();
  }

  onApplyAdditionalColumnFilters(): void {
    if (this.store.activeTab() === 'batch') return;
    this.store.applyColumnFilters();
    this.store.setInvoiceFilter(null);
    this.store.setCurrentPage(1);
    this.updatePageInUrl();
    this.loadTabContent();
  }

  searchByInvoice(invoiceNumber: string): void {
    this.store.setInvoiceFilter(invoiceNumber);
    this.store.searchControl.setValue('');
    this.store.setCurrentPage(1);
    this.applyFilters();
  }

  onInventorySort(column: WarehouseInventoryTableSortColumn): void {
    const dir = this.store.inventorySortColumn() === column
      ? (this.store.inventorySortDirection() === 'asc' ? 'desc' : 'asc')
      : this.inventoryCore.resolveInventoryDefaultDirection(column);
    this.store.setInventorySort(column, dir);
    this.store.setCurrentPage(1);
    this.updatePageInUrl();
    if (this.store.activeTab() !== 'batch') this.loadTabContent();
  }

  onBatchSort(column: BatchTableSortColumn): void {
    const dir = this.store.batchSortColumn() === column
      ? (this.store.batchSortDirection() === 'asc' ? 'desc' : 'asc')
      : this.inventoryCore.resolveBatchDefaultDirection(column);
    this.store.setBatchSort(column, dir);
  }

  refreshInventory(): void { this.loadTabContent(); }

  onBackToWarehouses(): void { this.router.navigate(['/warehouse']); }

  /**
   * Open master catalog details (same full-page view as workflow approval item links).
   * Back button uses {@link AssetDetailsComponent} `returnTo` query param.
   */
  onOpenItemMasterDetails(detail: InventoryDetailDto): void {
    const link = this.getItemMasterRouterLink(detail);
    if (!link) {
      this.toastService.warning(
        this.translateService.instant('warehouseInventory.itemMasterUnavailable') ||
          'Catalog item is unavailable for this row.'
      );
      return;
    }
    this.router.navigate([...link.commands], { queryParams: link.queryParams });
  }

  /**
   * Build the same catalog URL as {@link onOpenItemMasterDetails} for use with `<a routerLink>`
   * (supports open in new tab via ctrl/middle-click).
   */
  getItemMasterRouterLink(detail: InventoryDetailDto): {
    commands: readonly (string | number)[];
    queryParams: Record<string, string>;
  } | null {
    const masterId = detail.itemId ?? detail.item?.id;
    if (!masterId) {
      return null;
    }
    const tab = this.resolveAssetTabForCatalogDetails(detail);
    return {
      commands: ['/assets/asset-list', masterId] as const,
      queryParams: { tab, returnTo: this.router.url }
    };
  }

  onViewItem(detail: InventoryDetailDto): void {
    const tab = this.store.activeTab();
    const queryParams: Record<string, string | number> = { tab };
    const page = this.store.currentPage();
    if (page > 1) {
      queryParams['page'] = page;
    }
    this.router.navigate(['/warehouse', this.store.depoId(), 'inventory', detail.id], { queryParams });
  }

  onAddInventory(): void {
    const queryParams: Record<string, string | number> = { tab: this.store.activeTab() };
    if (this.store.currentPage() > 1) queryParams['page'] = this.store.currentPage();
    this.router.navigate(['/warehouse', this.store.depoId(), 'inventory', 'add'],
      { queryParams, queryParamsHandling: 'merge' });
  }

  onAddWeaponAsset(): void {
    const page = this.store.currentPage();
    this.router.navigate(['/warehouse', this.store.depoId(), 'assets', 'add'],
      { queryParams: page > 1 ? { page } : undefined });
  }

  onEditBatch(batch: BatchSummaryDto): void {
    this.router.navigate(['/warehouse', this.store.depoId(), 'batches', batch.id, 'edit']);
  }

  onViewAsset(asset: AssetDto): void {
    this.router.navigate(['/warehouse', this.store.depoId(), 'assets', asset.id],
      { queryParams: { tab: this.store.activeTab() }, queryParamsHandling: 'merge' });
  }

  onBatchRowClick(batch: BatchSummaryDto): void {
    if (this.store.expandedBatchId() === batch.id) { this.store.collapseExpandedBatch(); return; }
    this.store.setExpandedBatchId(batch.id);
    this.store.resetExpandedBatchAssetState();
    this.fetchExpandedBatchAssets();
  }

  onExpandedBatchAssetsPageChange(page: number): void {
    this.store.setExpandedBatchAssetsPage(page);
    this.fetchExpandedBatchAssets();
  }

  onExpandedBatchAssetsPageSizeChange(size: number): void {
    this.store.setExpandedBatchAssetsPageSize(size);
    this.store.setExpandedBatchAssetsPage(1);
    this.fetchExpandedBatchAssets();
  }

  onExpandedBatchAssetsDetailItemChange(itemId: number | null): void {
    this.store.setExpandedBatchAssetsDetailItemId(itemId);
    this.store.setExpandedBatchAssetsPage(1);
    this.fetchExpandedBatchAssets();
  }

  onEditItem(detail: InventoryDetailDto): void {
    this.dataService.loadInventoryById(detail.inventoryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: inv => {
          this.store.setCurrentInventory(inv || undefined);
          const latest = inv?.inventoryDetails?.find(d => d.id === detail.id);
          this.store.setSelectedDetail(latest || detail);
          this.store.setEditModalOpen(true);
        },
        error: () => {
          this.toastService.error(this.translateService.instant('toast.failedToLoadDetails'));
        }
      });
  }

  onDeleteItem(detail: InventoryDetailDto): void {
    this.store.setSelectedDetail(detail);
    this.store.setDeleteDialogOpen(true);
  }

  onEditSave(data: { detail: UpdateInventoryDetailDto; inventory: UpdateInventoryDto; files?: File[]; removedFileIds?: number[] }): void {
    const inventory = this.store.currentInventory();
    const detail = this.store.selectedDetail();
    if (!inventory || !detail) return;
    this.store.closeEditDetail();
    this.crudService.editInventoryDetailFlow(
      detail, inventory, data.detail, data.inventory, data.files, data.removedFileIds,
      this.store, () => this.refreshInventory()
    );
  }

  onDeleteConfirm(): void {
    const detail = this.store.selectedDetail();
    if (!detail) return;
    this.store.closeDeleteDetail();
    this.crudService.deleteInventoryDetailFlow(detail, this.store, () => this.refreshInventory());
  }

  onEditModalClose(): void { this.store.closeEditDetail(); }
  onDeleteCancel(): void { this.store.closeDeleteDetail(); }
  onEditAsset(asset: AssetDto): void { this.crudService.loadAssetForEditFlow(asset, this.store); }
  onDeleteAsset(asset: AssetDto): void { this.store.setSelectedAsset(asset); this.store.setDeleteAssetDialogOpen(true); }
  onEditAssetModalClosed(): void { this.store.closeEditAsset(); this.refreshInventory(); }
  onDeleteAssetCancel(): void { this.store.closeDeleteAsset(); }

  onDeleteAssetConfirm(): void {
    const toDelete = this.store.selectedAsset();
    if (!toDelete) return;
    this.store.closeDeleteAsset();
    this.crudService.deleteAssetFlow(toDelete.id, this.store, () => this.refreshInventory());
  }

  onDeleteBatch(batch: BatchSummaryDto): void { this.store.setSelectedBatch(batch); this.store.setDeleteBatchDialogOpen(true); }
  onDeleteBatchCancel(): void { this.store.closeDeleteBatch(); }

  onDeleteBatchConfirm(): void {
    const batch = this.store.selectedBatch();
    if (!batch) return;
    this.store.closeDeleteBatch();

    const assetCount = batch.quantity ?? 0;
    if (assetCount >= WarehouseInventoryFacadeService.ASYNC_BATCH_DELETE_THRESHOLD) {
      this.runAsyncBatchDeletion(batch);
      return;
    }

    this.dataService.deleteBatch(batch.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.store.expandedBatchId() === batch.id) this.store.collapseExpandedBatch();
          this.store.removeBatchById(batch.id, bs => this.applyBatchSearch(bs));
          this.toastService.success(
            this.translateService.instant('warehouseInventory.batchDeleted'),
            this.translateService.instant('toast.success')
          );
        },
        error: err => {
          const fallback = this.translateService.instant('warehouseInventory.failedToDeleteBatch');
          const msg = ErrorHandler.extractAndTranslateErrorMessage(err, fallback, this.translateService);
          this.toastService.error(msg, this.translateService.instant('toast.error'));
        }
      });
  }

  exportDepotToExcel(): void { this.exportService.exportDepotFlow(this.store); }
  onExportBatchAssetsExcel(batch: BatchSummaryDto): void { this.exportService.exportBatchAssetsFlow(batch, this.store, this.getLang()); }
  downloadWarehouseTemplate(): void { this.importFlow.downloadTemplateFlow(this.store, this.getLang()); }
  onWarehouseImportPreview(file: File): void { this.importFlow.previewFlow(file, this.store, this.getLang()); }

  onWarehouseImportClick(): void {
    if (!this.store.depoId()) { this.toastService.warning('Depot not loaded'); return; }
    this.store.resetImportState(false);
    this.store.setImportModalOpen(true);
  }

  onImportBatchAssetsExcel(batch: BatchSummaryDto): void {
    if (!this.store.depoId()) { this.toastService.warning('Depot not loaded'); return; }
    this.store.setBatchExcelImportMode(true);
    this.store.setBatchImportTargetId(batch.id);
    this.store.setPendingImportFile(null);
    this.store.setPreviewData(null);
    this.store.setImportModalOpen(true);
  }

  onImportDialogClose(): void {
    this.store.setPendingImportFile(null);
    this.store.setImportModalOpen(false);
    this.store.setBatchExcelImportMode(false);
    this.store.setBatchImportTargetId(null);
  }

  onWarehouseImportDirect(file: File): void {
    if (!this.store.depoId()) return;
    if (this.store.isImportInProgress()) { this.toastService.warning('Import is already in progress. Please wait...'); return; }
    this.store.beginImport();
    this.store.setImportModalOpen(false);
    this.importFlow.executeFlow(file, this.store, this.getLang(), { clearPending: false }, () => this.refreshInventory());
  }

  onWarehousePreviewConfirmed(): void {
    this.store.setPreviewModalOpen(false);
    this.store.setPreviewData(null);
    const file = this.store.pendingImportFile();
    if (!file || !this.store.depoId()) {
      this.toastService.error('Import file not found. Please try uploading again.');
      this.store.setBatchExcelImportMode(false);
      this.store.setBatchImportTargetId(null);
      return;
    }
    if (this.store.isImportInProgress()) { this.toastService.warning('Import is already in progress. Please wait...'); return; }
    this.store.beginImport();
    this.importFlow.executeFlow(file, this.store, this.getLang(), { clearPending: true }, () => this.refreshInventory());
  }

  onWarehousePreviewCancelled(): void { this.store.cancelPreview(); }

  private runAsyncBatchDeletion(batch: BatchSummaryDto): void {
    this.store.beginLargeBatchDeletion(
      this.translateService.instant('warehouseInventory.batchDeleteQueuedLarge')
    );

    this.assetService
      .startBulkDelete({
        scope: AssetBulkDeletionScope.Batch,
        batchId: batch.id
      })
      .pipe(
        switchMap((start) =>
          timer(0, 1200).pipe(
            switchMap(() => this.assetService.getBulkDeleteStatus(start.jobId)),
            tap((status) => {
              const detail =
                status.message?.trim() ||
                `${status.processedCount.toLocaleString()} / ${status.totalCandidates.toLocaleString()}`;
              this.store.updateLargeBatchDeletionProgress(status.progressPercent, detail);
            }),
            takeWhile(
              (s) => s.status !== 'Completed' && s.status !== 'Failed',
              true
            )
          )
        ),
        finalize(() => this.store.endLargeBatchDeletion()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (final) => {
          if (final.status !== 'Completed' && final.status !== 'Failed') {
            return;
          }
          if (final.status === 'Failed') {
            const msg =
              final.message?.trim() ||
              this.translateService.instant('warehouseInventory.batchDeleteJobFailed');
            this.toastService.error(msg, this.translateService.instant('toast.error'));
            return;
          }
          if (this.store.expandedBatchId() === batch.id) {
            this.store.collapseExpandedBatch();
          }
          this.store.removeBatchById(batch.id, (bs) => this.applyBatchSearch(bs));
          this.toastService.success(
            this.translateService.instant('warehouseInventory.batchDeleted'),
            this.translateService.instant('toast.success')
          );
        },
        error: (err: unknown) => {
          const fallback = this.translateService.instant('warehouseInventory.failedToDeleteBatch');
          const msg = ErrorHandler.extractAndTranslateErrorMessage(
            err,
            fallback,
            this.translateService
          );
          this.toastService.error(msg, this.translateService.instant('toast.error'));
        }
      });
  }

  private bootstrapFromInitialQuery(): void {
    const tabParam = this.route.snapshot.queryParams['tab'];
    if (tabParam === 'ammunition' || tabParam === 'explosive' || tabParam === 'batch') this.store.setActiveTab(tabParam);
    else if (tabParam === 'weapon') this.store.setActiveTab('batch');
    const page = this.route.snapshot.queryParamMap.get('page');
    if (page) {
      const parsed = parseInt(page, 10);
      if (!isNaN(parsed) && parsed >= 1) this.store.setCurrentPage(parsed);
    }
  }

  private bindQueryParamChanges(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const effectiveTab: WarehouseInventoryTab | undefined = params['tab'] === 'weapon' ? 'batch' : params['tab'];
      if (effectiveTab && (effectiveTab === 'ammunition' || effectiveTab === 'explosive' || effectiveTab === 'batch')
        && this.store.activeTab() !== effectiveTab) {
        this.store.setActiveTab(effectiveTab);
        this.store.setCurrentPage(1);
        this.applyFilters();
      }
      const page = params['page'];
      if (!page) return;
      const parsed = parseInt(page, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed !== this.store.currentPage()) {
        this.store.setCurrentPage(parsed);
        if (this.store.activeTab() !== 'batch') this.loadTabContent();
      }
    });
  }

  private bindRouteParamChanges(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params['id'];
      if (!id) return;
      this.store.setDepoId(parseInt(id, 10));
      this.loadDepotAndAssets();
    });
  }

  private bindLanguageChanges(): void {
    this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const depot = this.store.currentDepot();
      if (!depot) return;
      this.store.setDepoName(getLocalizedName(depot, getCurrentLang(this.translateService)) || `Depot ${this.store.depoId()}`);
    });
  }

  private bindFilterControlChanges(): void {
    merge(
      this.store.supplierFilterControl.valueChanges,
      this.store.manufacturerFilterControl.valueChanges,
      this.store.primaryPurposeFilterControl.valueChanges,
      this.store.caliberFilterControl.valueChanges
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.store.activeTab() === 'batch') return;
      this.store.setCurrentPage(1);
      this.updatePageInUrl();
      this.loadTabContent();
    });
  }

  private updatePageInUrl(): void {
    const page = this.store.currentPage();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : null, tab: this.store.activeTab() },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private applyFilters(): void {
    this.store.setCurrentPage(1);
    if (this.store.activeTab() === 'batch') this.store.replaceFilteredBatches(this.applyBatchSearch(this.store.batches()));
    else this.loadTabContent();
  }

  private applyBatchSearch(batches: BatchSummaryDto[]): BatchSummaryDto[] {
    return this.inventoryCore.applyBatchSearch(batches, this.store.searchControl.value ?? '');
  }

  private validateCurrentPage(): void {
    const max = this.store.totalPages();
    if (this.store.currentPage() > max && max > 0) this.store.setCurrentPage(max);
    if (this.store.currentPage() < 1) this.store.setCurrentPage(1);
  }

  private loadDepotAndAssets(): void {
    this.store.setLoading(true);
    this.store.setError(null);
    this.dataService.loadDepotContext()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ depots, suppliers, manufacturers, primaryPurposes, weaponItems, calibersAmmunition, calibersWeapon }) => {
          this.store.setLookups({
            suppliers: suppliers ?? [],
            manufacturers: manufacturers ?? [],
            primaryPurposes: primaryPurposes ?? [],
            weaponItems: weaponItems ?? [],
            calibersAmmunition: calibersAmmunition ?? [],
            calibersWeapon: calibersWeapon ?? []
          });
          const depot = depots.find(d => d.id === this.store.depoId()) || null;
          this.store.setCurrentDepot(depot);
          this.store.setDepoName(depot
            ? getLocalizedName(depot, getCurrentLang(this.translateService)) || `Depot ${this.store.depoId()}`
            : '');
          if (!depot) { this.store.setError('accessDenied'); this.store.setLoading(false); return; }
          this.loadTabContent();
          this.store.setLoading(false);
        },
        error: () => {
          this.store.setError('Failed to load depot data');
          this.store.setLoading(false);
          this.translateService.get(['toast.failedToLoadInventory', 'toast.error'])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(t => this.toastService.error(
              t['toast.failedToLoadInventory'] || 'Failed to load data', t['toast.error']
            ));
        }
      });
  }

  private loadTabContent(): void {
    if (this.store.activeTab() === 'batch') this.loadServerSideBatches();
    else this.loadServerSideInventory();
  }

  private loadServerSideBatches(): void {
    this.store.setLoading(true);
    this.store.setExpandedBatchId(null);
    this.store.clearExpandedBatchAssets();
    this.store.resetExpandedBatchAssetState();
    const filters = this.inventoryCore.buildBatchAssetFilter({
      itemIds: this.store.batchItemFilterControl.value ?? [],
      supplierIds: this.store.batchSupplierFilterControl.value ?? [],
      manufacturerIds: this.store.batchManufacturerFilterControl.value ?? [],
      primaryPurposeIds: this.store.batchPrimaryPurposeFilterControl.value ?? [],
      caliberId: this.store.batchCaliberFilterControl.value
    });
    this.dataService.loadBatchSummaries(this.store.depoId(), filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: batches => {
          const list = batches || [];
          const filtered = this.applyBatchSearch(list);
          this.store.setBatchData({ batches: list, filteredBatches: filtered, totalItems: filtered.length, lastAppliedFilter: filters });
          this.validateCurrentPage();
          this.updatePageInUrl();
          this.store.setLoading(false);
        },
        error: () => { this.store.setError('Failed to load batch data'); this.store.setLoading(false); }
      });
  }

  private loadServerSideInventory(): void {
    this.store.setLoading(true);
    const request = this.inventoryCore.buildPagedRequest({
      activeTab: this.store.activeTab(),
      currentPage: this.store.currentPage(),
      rowsPerPage: this.store.rowsPerPage(),
      searchTerm: this.store.searchControl.value ?? '',
      invoiceFilter: this.store.invoiceFilter(),
      supplierId: this.store.supplierFilterControl.value,
      manufacturerId: this.store.manufacturerFilterControl.value,
      primaryPurposeId: this.store.primaryPurposeFilterControl.value,
      caliberId: this.store.caliberFilterControl.value,
      columnFilters: this.store.appliedColumnFilters(),
      sortColumn: this.store.inventorySortColumn(),
      sortDirection: this.store.inventorySortDirection(),
      language: getCurrentLang(this.translateService)
    });
    this.dataService.loadInventoryPage(this.store.depoId(), request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          const items = response.items || [];
          this.store.setInventoryPage({
            items,
            filtered: this.filterService.normalizeInventoryDetails(items),
            totalCount: response.totalCount
          });
          this.validateCurrentPage();
          this.updatePageInUrl();
          this.store.setLoading(false);
        },
        error: () => { this.store.setError('Failed to load inventory data'); this.store.setLoading(false); }
      });
  }

  /**
   * When an item detail accordion is open, scope the asset list to that catalog item so pagination
   * is not tied to global asset Id order (otherwise page 1 can omit an item that still has a non-zero count).
   */
  private expandedBatchFetchFilters(): BatchAssetFilter | undefined {
    const base = this.store.lastAppliedBatchFilter();
    const detailItemId = this.store.expandedBatchAssetsDetailItemId();
    if (detailItemId == null) return base;
    if (base?.itemIds?.length && !base.itemIds.includes(detailItemId)) {
      return { ...base, itemIds: [-1] };
    }
    return { ...(base ?? {}), itemIds: [detailItemId] };
  }

  private fetchExpandedBatchAssets(): void {
    const batchId = this.store.expandedBatchId();
    if (batchId == null) return;
    this.store.setLoadingBatchAssets(true);
    const detailItemId = this.store.expandedBatchAssetsDetailItemId();
    const filters = this.expandedBatchFetchFilters();
    this.dataService.loadExpandedBatchAssets({
      batchId,
      filters,
      includeAllAssets: false,
      assetsPage: this.store.expandedBatchAssetsPage(),
      assetsPageSize: this.store.expandedBatchAssetsPageSize()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: full => {
          this.store.setExpandedBatchAssets({
            assets: full?.assets ?? [],
            totalCount: full?.assetCount ?? 0,
            totalPages: full?.assetsTotalPages ?? 1,
            page: full?.assetsPageIndex ?? 1,
            pageSize: full?.assetsPageSize,
            assetItemCounts: full?.assetItemCounts ?? [],
            preserveAssetItemCounts: detailItemId != null
          });
          this.store.setLoadingBatchAssets(false);
        },
        error: () => {
          this.store.setLoadingBatchAssets(false);
          this.store.setExpandedBatchId(null);
          this.store.clearExpandedBatchAssets();
          this.store.resetExpandedBatchAssetState();
        }
      });
  }

  /** Maps warehouse row + tab to asset-details `tab` query (same contract as workflow approval). */
  private resolveAssetTabForCatalogDetails(detail: InventoryDetailDto): 'ammunition' | 'weapon' | 'explosive' {
    const fromItem = this.filterService.normalizeItemType(detail.item?.itemType);
    if (fromItem === ItemType.Ammunition) return 'ammunition';
    if (fromItem === ItemType.Weapon) return 'weapon';
    if (fromItem === ItemType.Explosive) return 'explosive';
    const wt = this.store.activeTab();
    if (wt === 'batch') return 'weapon';
    if (wt === 'explosive') return 'explosive';
    return 'ammunition';
  }

  private getLang(): string {
    return this.translateService.currentLang || this.translateService.defaultLang || 'en';
  }
}
