import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Edit2, Trash2 } from 'lucide-angular';
import { InventoryService } from '@services/inventory.service';
import { LookupService } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto, UpdateInventoryDetailDto, UpdateInventoryDto } from '@models/inventory.model';
import { DepotDto } from '@models/depot.model';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { EditInventoryDetailModalComponent } from './components/edit-inventory-detail-modal/edit-inventory-detail-modal.component';

@Component({
  selector: 'app-warehouse-inventory',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    LucideAngularModule, 
    TranslateModule,
    ConfirmDialogComponent,
    EditInventoryDetailModalComponent
  ],
  templateUrl: './warehouse-inventory.component.html',
  styleUrls: ['./warehouse-inventory.component.css']
})
export class WarehouseInventoryComponent implements OnInit, OnDestroy {
  depoId: number = 0;
  depoName: string = '';
  inventoryDetails: InventoryDetailDto[] = [];
  paginatedItems: InventoryDetailDto[] = [];
  loading = true;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 0;

  readonly ArrowLeft = ArrowLeft;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly ChevronDown = ChevronDown;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;

  // Modal states
  showEditModal = false;
  showDeleteDialog = false;
  selectedDetail?: InventoryDetailDto;
  currentInventory?: any;

  private destroy$ = new Subject<void>();

  constructor(
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params['id'];
      if (id) {
        this.depoId = parseInt(id, 10);
        this.loadInventoryData();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInventoryData(): void {
    this.loading = true;
    this.error = null;

    // Load depot details and inventory details in parallel
    forkJoin({
      depot: this.lookupService.getDepots(),
      inventoryDetails: this.inventoryService.getWarehouseInventoryItems(this.depoId)
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ depot, inventoryDetails }) => {
        // Find the specific depot
        const currentDepot = depot.find(d => d.id === this.depoId);
        this.depoName = currentDepot?.nameEn || `Depot ${this.depoId}`;
        
        // Set inventory details
        this.inventoryDetails = inventoryDetails;
        this.totalCount = inventoryDetails.length;
        this.totalPages = Math.ceil(this.totalCount / this.pageSize);
        
        // Update paginated items
        this.updatePaginatedItems();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading inventory data:', error);
        this.error = 'Failed to load inventory data';
        this.loading = false;
      }
    });
  }

  private updatePaginatedItems(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedItems = this.inventoryDetails.slice(startIndex, endIndex);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedItems();
    }
  }

  onBackToWarehouses(): void {
    this.router.navigate(['/warehouse']);
  }

  onViewItem(itemId: number): void {
    this.router.navigate(['/warehouse', this.depoId, 'inventory', itemId]);
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 1; // Reset to first page
    this.totalPages = Math.ceil(this.totalCount / this.pageSize);
    this.updatePaginatedItems();
  }

  /**
   * Get item name from inventory detail
   */
  getItemName(detail: InventoryDetailDto): string {
    return detail.item?.name || detail.item?.itemNo || 'Unknown Item';
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
    return detail.supplier?.nameEn || detail.supplier?.nameAr || '-';
  }

  /**
   * Get HCC name
   */
  getHccName(detail: InventoryDetailDto): string {
    return detail.item?.hcc?.nameEn || detail.item?.hcc?.nameAr || '-';
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
   * Get page numbers for pagination
   */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
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
          this.currentInventory = inventory;
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
      inventoryDetails: this.currentInventory.inventoryDetails.map((d: InventoryDetailDto) => 
        d.id === this.selectedDetail!.id ? updateDetailDto : {
          id: d.id,
          itemId: d.itemId,
          lot: d.lot,
          supplierId: d.supplierId,
          manufacturerId: d.manufacturerId,
          countryId: d.countryId,
          itemQuantity: d.itemQuantity,
          currentQuantity: d.currentQuantity
        }
      )
    };

    this.inventoryService.update(this.currentInventory.id, updateInventoryDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.translateService.get(['toast.inventoryUpdated', 'toast.success']).subscribe(translations => {
            this.toastService.success(translations['toast.inventoryUpdated'], translations['toast.success']);
          });
          this.showEditModal = false;
          this.selectedDetail = undefined;
          this.currentInventory = undefined;
          this.loadInventoryData(); // Refresh data
        },
        error: (error) => {
          console.error('Error updating inventory:', error);
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
              invoiceNumber: inventory.invoiceNumber || '',
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
                itemQuantity: d.itemQuantity,
                currentQuantity: d.currentQuantity
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
