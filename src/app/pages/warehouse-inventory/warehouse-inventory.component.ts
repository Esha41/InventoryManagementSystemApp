import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin, switchMap, timer } from 'rxjs';
import { debounceTime, startWith, map, combineLatest } from 'rxjs/operators';
import { LucideAngularModule, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ChevronDown, Edit2, Trash2, Eye, X, Search } from 'lucide-angular';
import { InventoryService } from '@services/inventory.service';
import { LookupService } from '@services/lookup.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { LookupItem } from '@models/lookup.model';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto, UpdateInventoryDetailDto, UpdateInventoryDto, InventoryDto, BaseItemDto, ItemType } from '@models/inventory.model';
import { DepotDto } from '@models/depot.model';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { EditInventoryDetailModalComponent } from './components/edit-inventory-detail-modal/edit-inventory-detail-modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';

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
    DropdownComponent,
    PaginationComponent,
    RowsPerPageComponent,
    HasPermissionDirective,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './warehouse-inventory.component.html',
  styleUrls: ['./warehouse-inventory.component.css']
})
export class WarehouseInventoryComponent implements OnInit, OnDestroy {
  depoId: number = 0;
  depoName: string = '';
  currentDepot: LookupItem | null = null;
  inventoryDetails: InventoryDetailDto[] = [];
  filteredInventoryDetails: InventoryDetailDto[] = [];
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

  private destroy$ = new Subject<void>();

  constructor(
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService
  ) { }

  ngOnInit(): void {
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
      weapons: this.weaponService.getAll<BaseItemDto>(),
      explosives: this.explosiveService.getAll<BaseItemDto>()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ depot, inventoryDetails, weapons, explosives }) => {
          // Find the specific depot
          this.currentDepot = depot.find((d: LookupItem) => d.id === this.depoId) || null;
          this.depoName = getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) || `Depot ${this.depoId}`;

          const weaponDetails: InventoryDetailDto[] = (weapons || [])
            .filter(weapon => !weapon.isDeleted)
            .map(weapon => this.convertBaseItemToInventoryDetail(weapon, ItemType.Weapon));


          const explosiveDetails: InventoryDetailDto[] = (explosives || [])
            .filter(explosive => !explosive.isDeleted)
            .map(explosive => this.convertBaseItemToInventoryDetail(explosive, ItemType.Explosive));


          const allDetails = [...inventoryDetails, ...weaponDetails, ...explosiveDetails];

          const normalizedDetails = allDetails.map(detail => {
            if (detail.item) {
              const normalizedType = this.normalizeItemType(detail.item.itemType);
              if (normalizedType !== undefined) {
                return {
                  ...detail,
                  item: {
                    ...detail.item,
                    itemType: normalizedType as ItemType
                  }
                };
              }
            }
            return detail;
          });

          const uniqueDetails = this.removeDuplicateItems(normalizedDetails);

          this.inventoryDetails = uniqueDetails;
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading inventory data:', error);
          this.error = 'Failed to load inventory data';
          this.loading = false;
        }
      });
  }

  /**
   * Convert BaseItemDto to InventoryDetailDto format for static display
   */
  private convertBaseItemToInventoryDetail(item: BaseItemDto, itemType: ItemType): InventoryDetailDto {
    const normalizedItemType = this.normalizeItemType(item.itemType);
    const finalItemType = normalizedItemType !== undefined ? normalizedItemType : itemType;
    
    return {
      id: item.id * -1,
      itemId: item.id,
      lot: 0,
      inventoryId: 0,
      supplierId: undefined,
      manufacturerId: undefined,
      countryId: undefined,
      originalQuantity: 0,
      currentQuantity: 0,
      batchNo: undefined,
      expiryDate: undefined,
      readyForIssue: true,
      usedQuantity: 0,
      reservedQuantityByOrdersOnProcessing: 0,
      remainingQuantity: 0,
      isLotEmpty: false,
      item: {
        ...item,
        itemType: finalItemType as ItemType
      }
    };
  }

  /**
   * Remove duplicate items, keeping inventory items over static items
   */
  private removeDuplicateItems(details: InventoryDetailDto[]): InventoryDetailDto[] {
    const itemIdMap = new Map<number, InventoryDetailDto>();

    // First, add all inventory items (positive IDs)
    details.forEach(detail => {
      if (detail.id > 0) {
        itemIdMap.set(detail.itemId, detail);
      }
    });

    // Then, add static items only if they don't exist in inventory
    details.forEach(detail => {
      if (detail.id < 0 && !itemIdMap.has(detail.itemId)) {
        itemIdMap.set(detail.itemId, detail);
      }
    });

    return Array.from(itemIdMap.values());
  }

  switchTab(tab: 'ammunition' | 'weapon' | 'explosive'): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.applyFilters();
  }

  /**
   * Apply both tab filter and search filter
   */
  private applyFilters(): void {
    let filtered = this.inventoryDetails;

    // Apply tab filter
    filtered = this.filterByTab(filtered);

    // Apply search filter
    const searchTerm = this.searchControl.value.trim().toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(detail => {
        const itemName = this.getItemName(detail).toLowerCase();
        const itemNo = this.getItemNo(detail).toLowerCase();
        const supplierName = this.getSupplierName(detail).toLowerCase();
        const lot = detail.lot?.toString().toLowerCase() || '';
        const batchNo = detail.batchNo?.toLowerCase() || '';
        
        return itemName.includes(searchTerm) ||
               itemNo.includes(searchTerm) ||
               supplierName.includes(searchTerm) ||
               lot.includes(searchTerm) ||
               batchNo.includes(searchTerm);
      });
    }

    this.filteredInventoryDetails = filtered;
    this.validateCurrentPage();
  }

  /**
   * Filter inventory by active tab
   */
  private filterByTab(details: InventoryDetailDto[]): InventoryDetailDto[] {
    if (this.activeTab === 'ammunition') {
      return details.filter(d => {
        const itemType = this.normalizeItemType(d.item?.itemType);
        const isAmmunition = itemType === 1;
        const isUndefinedAndNotStatic = itemType === undefined && !this.isStaticItem(d);
        return isAmmunition || isUndefinedAndNotStatic;
      });
    } else if (this.activeTab === 'weapon') {
      return details.filter(d => {
        const itemType = this.normalizeItemType(d.item?.itemType);
        return itemType === 2;
      });
    } else if (this.activeTab === 'explosive') {
      return details.filter(d => {
        const itemType = this.normalizeItemType(d.item?.itemType);
        return itemType === 3;
      });
    }
    return details;
  }

  private normalizeItemType(itemType: ItemType | string | number | undefined): number | undefined {
    if (itemType === undefined || itemType === null) {
      return undefined;
    }
    if (typeof itemType === 'number') {
      return itemType;
    }
    if (typeof itemType === 'string') {
      const parsed = parseInt(itemType, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return Number(itemType);
  }


  get totalPages(): number {
    const totalItems = this.filteredInventoryDetails.length;
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
    }
  }

  onBackToWarehouses(): void {
    this.router.navigate(['/warehouse']);
  }

  /**
   * Check if an item is static (weapon/explosive dummy data)
   */
  isStaticItem(detail: InventoryDetailDto): boolean {
    return detail.id < 0; // Static items have negative IDs
  }

  onViewItem(detail: InventoryDetailDto): void {
    // For static items (weapons/explosives), show view modal
    if (this.isStaticItem(detail)) {
      this.selectedDetailForView = detail;
      this.showViewModal = true;
    } else {
      // For inventory items, navigate to inventory detail page
      this.router.navigate(['/warehouse', this.depoId, 'inventory', detail.id]);
    }
  }

  /**
   * Close view modal
   */
  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedDetailForView = undefined;
  }

  onRowsPerPageChange(newSize: number): void {
    this.rowsPerPage = newSize;
    this.currentPage = 1; // Reset to first page
    this.validateCurrentPage();
  }

  /**
   * Get item name from inventory detail
   */
  getItemName(detail: InventoryDetailDto | null | undefined): string {
    if (!detail) return 'Unknown Item';
    const lang = getCurrentLang(this.translateService);
    const localized = getLocalizedName(detail.item, lang);
    return localized || detail.item?.itemNo || 'Unknown Item';
  }

  /**
   * Get caliber/item number
   */
  getItemNo(detail: InventoryDetailDto): string {
    return detail.item?.itemNo || '-';
  }

  /**
   * Get supplier name
   */
  getSupplierName(detail: InventoryDetailDto): string {
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(detail.supplier, lang) || '-';
  }

  /**
   * Get HCC name
   */
  getHccName(detail: InventoryDetailDto): string {
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(detail.item?.hcc, lang) || '-';
  }

  /**
   * Format date for display
   */
  formatDate(date?: Date | string): string {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Format number with thousands separator
   */
  formatNumber(num: number): string {
    return num.toLocaleString();
  }


  /**
   * Refresh inventory data
   */
  refreshInventory(): void {
    this.loadInventoryData();
  }

  /**
   * Navigate to add inventory page
   */
  onAddInventory(): void {
    this.router.navigate(['/warehouse', this.depoId, 'inventory', 'add']);
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
        },
        error: (error) => {
          console.error('Error loading inventory:', error);
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
                inventoryDetails: this.inventoryService.getWarehouseInventoryItems(this.depoId),
                weapons: this.weaponService.getAll<BaseItemDto>(),
                explosives: this.explosiveService.getAll<BaseItemDto>()
              });
            })
          );
        })
      )
      .subscribe({
        next: ({ depot, inventoryDetails, weapons, explosives }) => {
          // Find the specific depot
          this.currentDepot = depot.find((d: LookupItem) => d.id === this.depoId) || null;
          this.depoName = this.currentDepot
            ? getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) || `Depot ${this.depoId}`
            : `Depot ${this.depoId}`;

          const weaponDetails: InventoryDetailDto[] = (weapons || [])
            .filter(weapon => !weapon.isDeleted)
            .map(weapon => this.convertBaseItemToInventoryDetail(weapon, ItemType.Weapon));

          const explosiveDetails: InventoryDetailDto[] = (explosives || [])
            .filter(explosive => !explosive.isDeleted)
            .map(explosive => this.convertBaseItemToInventoryDetail(explosive, ItemType.Explosive));

          const allDetails = [...inventoryDetails, ...weaponDetails, ...explosiveDetails];
          
          // Normalize itemType for all details to ensure consistent comparison
          const normalizedDetails = allDetails.map(detail => {
            if (detail.item?.itemType !== undefined) {
              const normalizedType = this.normalizeItemType(detail.item.itemType);
              if (normalizedType !== undefined && detail.item) {
                return {
                  ...detail,
                  item: {
                    ...detail.item,
                    itemType: normalizedType as ItemType
                  }
                };
              }
            }
            return detail;
          });
          
          const uniqueDetails = this.removeDuplicateItems(normalizedDetails);

          // Update inventory details with fresh data
          this.inventoryDetails = uniqueDetails;
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error updating inventory:', error);
          this.loading = false;
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
                  this.loadInventoryData();
                },
                error: (error) => {
                  console.error('Error deleting inventory:', error);
                  this.translateService.get(['toast.failedToDelete', 'toast.error']).subscribe(translations => {
                    this.toastService.error(translations['toast.failedToDelete'], translations['toast.error']);
                  });
                  this.showDeleteDialog = false;
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
                  this.loadInventoryData();
                },
                error: (error) => {
                  console.error('Error deleting item:', error);
                  this.translateService.get(['toast.failedToDeleteItem', 'toast.error']).subscribe(translations => {
                    this.toastService.error(translations['toast.failedToDeleteItem'], translations['toast.error']);
                  });
                  this.showDeleteDialog = false;
                }
              });
          }
        },
        error: (error) => {
          console.error('Error loading inventory for delete:', error);
          this.translateService.get(['toast.failedToLoad', 'toast.error']).subscribe(translations => {
            this.toastService.error(translations['toast.failedToLoad'], translations['toast.error']);
          });
          this.showDeleteDialog = false;
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
  }

  /**
   * Close delete dialog
   */
  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.selectedDetail = undefined;
  }
}
