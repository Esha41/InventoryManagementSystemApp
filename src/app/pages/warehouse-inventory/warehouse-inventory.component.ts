import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin, switchMap, timer } from 'rxjs';
import { debounceTime, startWith, map, combineLatest } from 'rxjs/operators';
import { LucideAngularModule, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ChevronDown, Edit2, Trash2, Eye, X, Search, Download } from 'lucide-angular';
import { InventoryService } from '@services/inventory.service';
import { LookupService } from '@services/lookup.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { AssetService } from '@services/asset.service';
import { LookupItem } from '@models/lookup.model';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto, UpdateInventoryDetailDto, UpdateInventoryDto, InventoryDto, BaseItemDto, ItemType } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { DepotDto } from '@models/depot.model';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { EditInventoryDetailModalComponent } from './components/edit-inventory-detail-modal/edit-inventory-detail-modal.component';
import { EditAssetModalComponent } from '../edit-asset/components/edit-asset-modal/edit-asset-modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { WarehouseInventoryFilterService } from './services/warehouse-inventory-filter.service';
import { WarehouseInventoryFormatterService } from './services/warehouse-inventory-formatter.service';

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
    ErrorStateComponent
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
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly ChevronDown = ChevronDown;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly Eye = Eye;
  readonly X = X;
  readonly Search = Search;
  readonly Download = Download;

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
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private assetService: AssetService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private excelExportService: ExcelExportService,
    private filterService: WarehouseInventoryFilterService,
    private formatterService: WarehouseInventoryFormatterService,
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
  private applyFilters(): void {
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
    this.assetService.getById<AssetDto>(asset.id)
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

    this.assetService.delete(this.selectedAsset.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.translateService.get(['toast.success', 'warehouseInventory.assetDeleted']).subscribe(translations => {
            this.toastService.success(
              translations['warehouseInventory.assetDeleted'] || 'Asset deleted successfully',
              translations['toast.success']
            );
          });
          this.showDeleteAssetDialog = false;
          this.selectedAsset = null;
          this.loadInventoryData(); // Reload data
        },
        error: (error) => {
          console.error('Error deleting asset:', error);
          this.translateService.get(['toast.error', 'warehouseInventory.failedToDeleteAsset']).subscribe(translations => {
            this.toastService.error(
              translations['warehouseInventory.failedToDeleteAsset'] || 'Failed to delete asset',
              translations['toast.error']
            );
          });
          this.showDeleteAssetDialog = false;
          this.cdr.markForCheck();
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

    // Update the inventory with modified detail
    const updateInventoryDto: UpdateInventoryDto = {
      depoId: this.currentInventory.depoId,
      invoiceNumber: this.currentInventory.invoiceNumber,
      invoiceDate: this.currentInventory.invoiceDate,
      recievedDate: this.currentInventory.recievedDate,
      notes: this.currentInventory.notes,
      inventoryDetails: (this.currentInventory.inventoryDetails || []).map((d: InventoryDetailDto) =>
        d.id === this.selectedDetail!.id ? updateDetailDto : {
          id: d.id,
          itemId: d.itemId,
          lot: d.lot,
          supplierId: d.supplierId,
          manufacturerId: d.manufacturerId,
          countryId: d.countryId,
          originalQuantity: d.originalQuantity,
          batchNo: d.batchNo,
          expiryDate: d.expiryDate,
          readyForIssue: d.readyForIssue ?? true
        }
      )
    };

    // Store the detail ID before we clear it
    const detailIdToUpdate = this.selectedDetail?.id;

    this.inventoryService.update(this.currentInventory.id, updateInventoryDto)
      .pipe(
        takeUntil(this.destroy$),
        // Use the update response to optimistically update the UI
        switchMap((updatedInventory: InventoryDto) => {
          // Close modal immediately for better UX
          this.showEditModal = false;
          const tempSelectedDetail = this.selectedDetail;
          this.selectedDetail = undefined;
          this.currentInventory = undefined;
          this.cdr.markForCheck();

          // Show success message
          this.translateService.get(['toast.inventoryUpdated', 'toast.success']).subscribe(translations => {
            this.toastService.success(translations['toast.inventoryUpdated'], translations['toast.success']);
          });

          // Update the specific detail in the local array optimistically
          if (updatedInventory.inventoryDetails && detailIdToUpdate) {
            const updatedDetail = updatedInventory.inventoryDetails.find(
              d => d.id === detailIdToUpdate
            );
            if (updatedDetail && tempSelectedDetail) {
              const index = this.inventoryDetails.findIndex(d => d.id === detailIdToUpdate);
              if (index !== -1) {
                // Merge the updated detail with existing data to preserve computed fields
                this.inventoryDetails[index] = {
                  ...this.inventoryDetails[index],
                  ...updatedDetail,
                  // Preserve computed fields that might not be in the update response
                  currentQuantity: this.inventoryDetails[index].currentQuantity,
                  usedQuantity: this.inventoryDetails[index].usedQuantity,
                  reservedQuantityByOrdersOnProcessing: this.inventoryDetails[index].reservedQuantityByOrdersOnProcessing,
                  remainingQuantity: this.inventoryDetails[index].remainingQuantity
                };
                this.applyFilters();
              }
            }
          }

          // Wait a bit to ensure backend transaction is committed, then reload fresh data
          return timer(500).pipe(
            switchMap(() => {
              this.loading = true;
              return forkJoin({
                depot: this.lookupService.getDepots(),
                inventoryDetails: this.inventoryService.getWarehouseInventoryItems(this.depoId)
              });
            })
          );
        })
      )
      .subscribe({
        next: ({ depot, inventoryDetails }) => {
          // Find the specific depot
          this.currentDepot = depot.find((d: LookupItem) => d.id === this.depoId) || null;
          this.depoName = this.currentDepot
            ? getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) || `Depot ${this.depoId}`
            : `Depot ${this.depoId}`;

          // Update inventory details with fresh data using filter service
          this.inventoryDetails = this.filterService.normalizeInventoryDetails(inventoryDetails);
          this.applyFilters();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.loading = false;
          this.cdr.markForCheck();
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

    // For simplicity, we'll remove the item from the inventory
    // In a real scenario, you might want to delete the entire inventory if it's the last item
    // or just mark the detail as deleted

    this.inventoryService.getById(this.selectedDetail.inventoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inventory) => {
          if (!inventory) {
            this.translateService.get(['toast.inventoryNotFound', 'toast.error']).subscribe(translations => {
              this.toastService.error(translations['toast.inventoryNotFound'], translations['toast.error']);
            });
            this.showDeleteDialog = false;
            this.cdr.markForCheck();
            return;
          }

          // Filter out the detail to delete
          const remainingDetails = inventory.inventoryDetails?.filter(d => d.id !== this.selectedDetail!.id) || [];

          if (remainingDetails.length === 0) {
            // If no details left, delete the entire inventory
            this.inventoryService.delete(inventory.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.translateService.get(['toast.inventoryDeleted', 'toast.success']).subscribe(translations => {
                    this.toastService.success(translations['toast.inventoryDeleted'], translations['toast.success']);
                  });
                  this.showDeleteDialog = false;
                  this.selectedDetail = undefined;
                  this.cdr.markForCheck();
                  this.loadInventoryData();
                },
                error: (error) => {
                  this.translateService.get(['toast.failedToDelete', 'toast.error']).subscribe(translations => {
                    this.toastService.error(translations['toast.failedToDelete'], translations['toast.error']);
                  });
                  this.showDeleteDialog = false;
                  this.cdr.markForCheck();
                }
              });
          } else {
            // Update inventory without this detail
            const updateDto: UpdateInventoryDto = {
              depoId: inventory.depoId,
              invoiceNumber: inventory.invoiceNumber || undefined,
              invoiceDate: inventory.invoiceDate,
              recievedDate: inventory.recievedDate,
              notes: inventory.notes,
              inventoryDetails: remainingDetails.map(d => ({
                id: d.id,
                itemId: d.itemId,
                lot: d.lot,
                supplierId: d.supplierId,
                manufacturerId: d.manufacturerId,
                countryId: d.countryId,
                originalQuantity: d.originalQuantity,
                batchNo: d.batchNo,
                expiryDate: d.expiryDate,
                readyForIssue: d.readyForIssue ?? true
              }))
            };

            this.inventoryService.update(inventory.id, updateDto)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.translateService.get(['toast.inventoryItemDeleted', 'toast.success']).subscribe(translations => {
                    this.toastService.success(translations['toast.inventoryItemDeleted'], translations['toast.success']);
                  });
                  this.showDeleteDialog = false;
                  this.selectedDetail = undefined;
                  this.cdr.markForCheck();
                  this.loadInventoryData();
                },
                error: (error) => {
                  this.translateService.get(['toast.failedToDeleteItem', 'toast.error']).subscribe(translations => {
                    this.toastService.error(translations['toast.failedToDeleteItem'], translations['toast.error']);
                  });
                  this.showDeleteDialog = false;
                  this.cdr.markForCheck();
                }
              });
          }
        },
        error: (error) => {
          this.translateService.get(['toast.failedToLoad', 'toast.error']).subscribe(translations => {
            this.toastService.error(translations['toast.failedToLoad'], translations['toast.error']);
          });
          this.showDeleteDialog = false;
          this.cdr.markForCheck();
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
    const columns: ExcelColumn[] = [
      {
        header: this.translateService.instant('warehouseInventory.itemName'),
        key: 'item',
        width: 30,
        format: (item) => this.getItemName({ item } as InventoryDetailDto)
      },
      {
        header: this.translateService.instant('warehouseInventory.itemNo'),
        key: 'item.itemNo',
        width: 15
      },
      {
        header: this.translateService.instant('common.supplier'),
        key: 'supplier',
        width: 20,
        format: (supplier) => getLocalizedName(supplier, getCurrentLang(this.translateService)) || '-'
      },
      {
        header: this.translateService.instant('warehouseInventory.lot'),
        key: 'lot',
        width: 10
      },
      {
        header: this.translateService.instant('warehouseInventory.batchNo'),
        key: 'batchNo',
        width: 15,
        format: (value) => value || '-'
      },
      {
        header: this.translateService.instant('warehouseInventory.originalQty'),
        key: 'originalQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('warehouseInventory.currentQty'),
        key: 'currentQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('warehouseInventory.usedQty'),
        key: 'usedQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('warehouseInventory.remainingQty'),
        key: 'remainingQuantity',
        width: 15
      },
      {
        header: this.translateService.instant('warehouseInventory.expiryDate'),
        key: 'expiryDate',
        width: 15,
        format: (date) => this.formatDate(date)
      }
    ];

    const fileName = `${this.depoName}_Inventory_${this.activeTab}`;

    this.excelExportService.exportToExcel({
      fileName: fileName,
      sheetName: this.activeTab.charAt(0).toUpperCase() + this.activeTab.slice(1),
      columns: columns,
      data: this.filteredInventoryDetails,
      includeTimestamp: true
    });

    this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
      this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
    });
  }
}
