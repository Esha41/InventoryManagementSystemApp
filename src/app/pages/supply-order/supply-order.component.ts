import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, CheckCircle, Clock, User, Package, Check, X as XIcon, Plus, AlertTriangle } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { OrderDto, OrderRequestItemDto } from '@services/order.service';
import { SupplyService, SupplyDto, SubmitSupplyDto } from '@services/supply.service';
import { InventoryService, LotDetailDto } from '@services/inventory.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { ApprovalStep, SupplyItemDisplay, LotItem } from '@models/supply-order.model';
import { formatDate as formatDateUtil, formatNumber as formatNumberUtil } from '@utils/format.utils';
import { getApprovalStatusClass, SubmissionStatus, getSubmissionStatusText, getSubmissionStatusClass } from '@utils/status.utils';
import { getPriorityText, getPriorityClass } from '@utils/priority.utils';
import { ErrorHandler } from '@utils/error-handler.utils';

@Component({
  selector: 'app-supply-order',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    ModalComponent
  ],
  templateUrl: './supply-order.component.html',
  styleUrls: ['./supply-order.component.css']
})
export class SupplyOrderComponent implements OnInit, OnDestroy {
  // ==================== CONSTANTS ====================
  private static readonly DAYS_NEAR_EXPIRY_THRESHOLD = 60;
  private static readonly DAYS_FAIR_CONDITION_THRESHOLD = 180;
  private static readonly DAYS_UNTIL_EXPIRY_UNDEFINED = 999999;

  // ==================== LIFECYCLE & ICONS ====================
  private destroy$ = new Subject<void>();
  
  readonly ArrowLeft = ArrowLeft;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly User = User;
  readonly Package = Package;
  readonly Check = Check;
  readonly XIcon = XIcon;
  readonly Plus = Plus;
  readonly AlertTriangle = AlertTriangle;

  // ==================== STATE ====================
  orderId: number = 0;
  supplyId: number = 0;
  orderData: OrderDto | null = null;
  supplyData: SupplyDto | null = null;
  
  loading: boolean = true;
  submitting: boolean = false;
  rejecting: boolean = false;
  updatingItem: boolean = false;
  deletingItem: boolean = false;
  
  // Add lot modal state
  isAddLotModalOpen: boolean = false;
  addLotForm!: FormGroup;
  loadingLotDetails: boolean = false;
  
  // Lot selection state
  selectedItemForLot: OrderRequestItemDto | null = null;
  availableLots: LotItem[] = [];
  selectedLotNumber: number | null = null;
  loadingAllLots: boolean = false;
  showManualLotEntry: boolean = false;
  manualLotNumber: string = '';
  loadingManualLot: boolean = false;
  
  // Order items for dropdown
  orderItems: OrderRequestItemDto[] = [];
  
  // Confirmation modal state
  isConfirmModalOpen: boolean = false;
  confirmModalTitle: string = '';
  confirmModalMessage: string = '';
  confirmModalAction: (() => void) | null = null;
  
  // Receiver form
  receiverForm!: FormGroup;
  ranks: LookupItem[] = [];
  loadingRanks: boolean = false;
  
  // Display data
  approvalWorkflow: ApprovalStep[] = [];
  supplyItems: SupplyItemDisplay[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private supplyService: SupplyService,
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private toastService: ToastService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['supplyId'];
    this.supplyId = parseInt(idParam, 10);
    
    if (isNaN(this.supplyId)) {
      this.toastService.error('Invalid supply ID');
      this.router.navigate(['/supply-order']);
      return;
    }
    
    this.loadRanks();
    this.loadSupplyData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== FORM INITIALIZATION ====================

  private initializeForm(): void {
    this.receiverForm = this.fb.group({
      recieverName: ['', Validators.required],
      receiverRankId: [null, Validators.required],
      recieverMilitaryId: ['', Validators.required],
      notes: ['']
    });

    this.addLotForm = this.fb.group({
      itemId: [null, Validators.required], // Required - set via dropdown
      lot: [null, Validators.required], // Required - set via lot selection
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  // ==================== DATA LOADING ====================

  private loadRanks(): void {
    this.loadingRanks = true;
    this.lookupService.getLookupItems('Rank')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items: LookupItem[]) => {
          this.ranks = items ?? [];
          this.loadingRanks = false;
        },
        error: () => {
          this.ranks = [];
          this.loadingRanks = false;
        }
      });
  }

  private loadSupplyData(): void {
    this.loading = true;
    
    // Get supply by ID
    this.supplyService.getById(this.supplyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (supply: SupplyDto) => {
          this.supplyData = supply;
          this.orderId = supply.orderId;
          this.orderData = supply.order;
          
          // Extract order items for dropdown
          this.orderItems = supply.order?.requestItems || [];
          
          // Pre-fill receiver form if data exists
          if (supply.recieverName || supply.receiverRankId || supply.recieverMilitaryId) {
            this.receiverForm.patchValue({
              recieverName: supply.recieverName || '',
              receiverRankId: supply.receiverRankId || null,
              recieverMilitaryId: supply.recieverMilitaryId || '',
              notes: supply.notes || ''
            });
          }
          
          // Map supply details to display items
          this.supplyItems = this.mapSupplyDetailsToDisplay(supply);
          
          // Set static approval workflow
          this.approvalWorkflow = this.getStaticApprovalWorkflow();
          
          this.loading = false;
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load supply order');
          this.toastService.error(errorMessage);
          this.loading = false;
          this.goBack();
        }
      });
  }

  /**
   * Maps supply details from API DTO to display model for UI
   */
  private mapSupplyDetailsToDisplay(supply: SupplyDto): SupplyItemDisplay[] {
    return supply.supplyDetails.map(detail => {
      const itemId = detail.itemId;
      const itemName = detail.item?.name || this.getItemDisplayName(itemId);
      
      return {
        supplyDetailId: detail.id,
        itemId: itemId,
        itemName: itemName,
        itemType: this.getItemTypeName(detail.item?.itemNo),
        lot: detail.lot,
        quantity: detail.quantity,
        requestedQuantity: detail.requestedQuantity,
        totalSuppliedQuantity: detail.totalSuppliedQuantity,
        isFullyFulfilled: detail.isFullyFulfilled,
        notes: detail.notes,
        isEditing: false
      };
    });
  }

  /**
   * Gets item type name from item number or returns default
   */
  private getItemTypeName(itemNo?: string): string {
    // TODO: Implement logic to determine type from item number
    return 'Supply Item';
  }

  /**
   * Gets static approval workflow steps
   * NOTE: This is a placeholder implementation. 
   * TODO: Replace with actual API call to fetch workflow steps from backend
   */
  private getStaticApprovalWorkflow(): ApprovalStep[] {
    // TODO: Replace with API call: this.orderService.getApprovalWorkflow(this.orderId)
    return [
      {
        id: '1',
        approverName: 'Maj. Khalid Hassan',
        approverId: 'MIL-32145',
        militaryRank: 'Major',
        status: 'Approved',
        approvedDate: '11 Sept 2024',
        comments: 'Approved for operational needs'
      },
      {
        id: '2',
        approverName: 'Lt. Col. Mohammed Al-Farsi',
        approverId: 'MIL-21087',
        militaryRank: 'Lieutenant Colonel',
        status: 'Approved',
        approvedDate: '11 Sept 2024',
        comments: 'Verified inventory availability'
      },
      {
        id: '3',
        approverName: 'Col. Saeed Abdullah',
        approverId: 'MIL-10234',
        militaryRank: 'Colonel',
        status: 'Pending',
        comments: ''
      }
    ];
  }

  // ==================== ACTIONS ====================

  goBack(): void {
    this.router.navigate(['/supply-order']);
  }

  // ==================== ITEM EDITING ====================

  /**
   * Enable editing for an item
   */
  onEditItem(item: SupplyItemDisplay): void {
    item.isEditing = true;
  }

  /**
   * Cancel editing for an item
   */
  onCancelEdit(item: SupplyItemDisplay): void {
    item.isEditing = false;
    // Reload to reset changes
    this.loadSupplyData();
  }

  /**
   * Update supply detail
   * Endpoint: PUT /api/Supply/{supplyId}/details/{detailId}
   */
  onUpdateItem(item: SupplyItemDisplay): void {
    if (!this.supplyData || item.quantity <= 0) {
      this.toastService.error('Invalid quantity');
      return;
    }

    this.updatingItem = true;
    this.supplyService.updateSupplyDetail(this.supplyId, item.supplyDetailId, {
      itemId: item.itemId,
      lot: item.lot,
      quantity: item.quantity,
      notes: item.notes
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success('Item updated successfully');
          item.isEditing = false;
          this.updatingItem = false;
          // Reload to get updated calculations
          this.loadSupplyData();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to update item');
          this.toastService.error(errorMessage);
          this.updatingItem = false;
        }
      });
  }

  /**
   * Open add lot modal
   */
  openAddLotModal(): void {
    this.addLotForm.reset();
    this.addLotForm.patchValue({ quantity: 1 });
    this.selectedItemForLot = null;
    this.availableLots = [];
    this.selectedLotNumber = null;
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
    this.isAddLotModalOpen = true;
  }

  /**
   * Close add lot modal
   */
  closeAddLotModal(): void {
    this.isAddLotModalOpen = false;
    this.addLotForm.reset();
    this.selectedItemForLot = null;
    this.availableLots = [];
    this.selectedLotNumber = null;
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
  }

  /**
   * Handle item selection from dropdown
   * Extracts item ID from dropdown selection (can be number, object, or array)
   */
  onItemSelected(selectedValue: OrderRequestItemDto | OrderRequestItemDto[] | number | null): void {
    const itemId = this.extractItemId(selectedValue);

    if (!itemId) {
      this.resetLotSelection();
      return;
    }

    const selectedItem = this.orderItems.find(item => item.id === itemId);
    if (selectedItem) {
      this.selectedItemForLot = selectedItem;
      this.addLotForm.patchValue({ itemId: selectedItem.id });
    } else {
      this.selectedItemForLot = null;
      this.addLotForm.patchValue({ itemId: null });
    }
    
    // Reset lot selection when item changes
    this.resetLotSelection();
  }

  /**
   * Extracts item ID from dropdown selection value
   */
  private extractItemId(selectedValue: OrderRequestItemDto | OrderRequestItemDto[] | number | null): number | null {
    if (selectedValue === null || selectedValue === undefined) {
      return null;
    }
    
    if (typeof selectedValue === 'number') {
      return selectedValue;
    }
    
    if (Array.isArray(selectedValue)) {
      return selectedValue.length > 0 ? (selectedValue[0].id || selectedValue[0].itemId) : null;
    }
    
    // Handle DropdownOption wrapper or direct OrderRequestItemDto
    const item = (selectedValue as any).value || selectedValue;
    return (item as OrderRequestItemDto).id || (item as OrderRequestItemDto).itemId || null;
  }

  /**
   * Resets lot selection state
   */
  private resetLotSelection(): void {
    this.availableLots = [];
    this.selectedLotNumber = null;
    this.addLotForm.patchValue({ lot: null });
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
  }

  /**
   * Add new supply detail
   * Endpoint: POST /api/Supply/{supplyId}/details
   */
  onAddLot(): void {
    // Validate form and selections
    if (!this.selectedItemForLot) {
      this.addLotForm.get('itemId')?.markAsTouched();
      this.toastService.error('Please select an item');
      return;
    }

    if (!this.selectedLotNumber) {
      this.addLotForm.get('lot')?.markAsTouched();
      this.toastService.error('Please select a lot');
      return;
    }

    if (this.addLotForm.invalid) {
      this.addLotForm.markAllAsTouched();
      this.toastService.error('Please fill in all required fields');
      return;
    }

    const formValue = this.addLotForm.value;
    this.loadingLotDetails = true;

    this.supplyService.addSupplyDetail(this.supplyId, {
      itemId: this.selectedItemForLot.itemId,
      lot: this.selectedLotNumber,
      quantity: formValue.quantity,
      notes: formValue.notes
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success('Lot added successfully to supply');
          this.loadingLotDetails = false;
          this.closeAddLotModal();
          // Reload to show new item
          this.loadSupplyData();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to add lot');
          this.toastService.error(errorMessage);
          this.loadingLotDetails = false;
        }
      });
  }

  // ==================== LOT SELECTION METHODS ====================

  /**
   * Show ALL lots for selected item
   */
  onShowAllLots(): void {
    if (!this.selectedItemForLot) {
      this.toastService.warning('Please select an item first');
      return;
    }
    this.loadAllLotsForItem(this.selectedItemForLot);
  }

  /**
   * Show AVAILABLE lots for selected item (FEFO logic)
   */
  onShowAvailableLots(): void {
    if (!this.selectedItemForLot) {
      this.toastService.warning('Please select an item first');
      return;
    }
    this.loadAvailableLotsForQuantity(this.selectedItemForLot);
  }

  /**
   * Toggle manual lot entry section
   */
  onAddLotManually(): void {
    this.showManualLotEntry = !this.showManualLotEntry;
    if (this.showManualLotEntry) {
      this.manualLotNumber = '';
    }
  }

  /**
   * Get details for manually entered lot number
   */
  onGetManualLotDetails(): void {
    if (!this.selectedItemForLot || !this.manualLotNumber.trim()) {
      this.toastService.warning('Please enter a lot number');
      return;
    }

    const lotNum = parseInt(this.manualLotNumber.trim(), 10);
    if (isNaN(lotNum)) {
      this.toastService.error('Invalid lot number');
      return;
    }

    this.loadingManualLot = true;
    this.inventoryService.getLotByNumber(lotNum)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lot: LotDetailDto) => {
          // Check if lot is for the correct item
          if (lot.itemId !== this.selectedItemForLot!.itemId) {
            this.toastService.error(`Lot ${lotNum} belongs to a different item (${lot.itemName || 'Unknown'})`);
            this.loadingManualLot = false;
            return;
          }

          // Check if lot already exists in the list
          const existingLot = this.availableLots.find(l => l.lotNumber === lot.lot);
          if (existingLot) {
            this.toastService.warning(`Lot ${lotNum} is already in the list`);
            this.loadingManualLot = false;
            return;
          }

          // Add the lot to the list
          const newLot: LotItem = {
            inventoryDetailId: lot.inventoryDetailId,
            lotNumber: lot.lot,
            quantity: lot.remainingQuantity,
            expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : undefined,
            location: this.formatLocation(lot.depot),
            condition: lot.isExpired ? 'Near Expiry' : this.determineCondition(lot.expiryDate),
            daysUntilExpiry: this.calculateDaysUntilExpiry(lot.expiryDate),
            depotName: lot.depot?.nameEn || lot.depot?.nameAr,
            supplierName: lot.supplier?.nameEn || lot.supplier?.nameAr,
            manufacturerName: lot.manufacturer?.nameEn || lot.manufacturer?.nameAr
          };

          this.availableLots.push(newLot);
          this.availableLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

          this.toastService.success(`Lot ${lotNum} added successfully`);
          this.manualLotNumber = '';
          this.loadingManualLot = false;
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Lot not found or error loading details');
          this.toastService.error(errorMessage);
          this.loadingManualLot = false;
        }
      });
  }

  /**
   * Load ALL lots for an item by itemId
   */
  private loadAllLotsForItem(item: OrderRequestItemDto): void {
    this.loadingAllLots = true;
    this.inventoryService.getLotsByItemId(item.itemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots: LotDetailDto[]) => {
          this.availableLots = this.mapLotDetailsToLotItems(lots);
          this.loadingAllLots = false;
          
          if (this.availableLots.length > 0) {
            this.toastService.success(`Loaded ${this.availableLots.length} total lot(s) for item`);
          } else {
            this.toastService.warning('No lots found for this item');
          }
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load lots');
          this.toastService.error(errorMessage);
          this.loadingAllLots = false;
        }
      });
  }

  /**
   * Load AVAILABLE lots for an item and quantity (FEFO logic)
   */
  private loadAvailableLotsForQuantity(item: OrderRequestItemDto): void {
    this.loadingAllLots = true;
    this.inventoryService.getAvailableLotsForQuantity(item.itemId, item.quantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots: LotDetailDto[]) => {
          this.availableLots = this.mapLotDetailsToLotItems(lots);
          this.loadingAllLots = false;
          
          if (this.availableLots.length > 0) {
            this.toastService.success(`Loaded ${this.availableLots.length} available lot(s) optimized for quantity ${item.quantity}`);
          } else {
            this.toastService.warning('No available lots found for requested quantity');
          }
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load available lots');
          this.toastService.error(errorMessage);
          this.loadingAllLots = false;
        }
      });
  }

  /**
   * Map LotDetailDto from inventory API to UI LotItem format
   */
  private mapLotDetailsToLotItems(lotDetails: LotDetailDto[]): LotItem[] {
    const lots = lotDetails
      .filter(lot => !lot.isEmptyLot) // Exclude empty lots
      .map(lot => ({
        inventoryDetailId: lot.inventoryDetailId,
        lotNumber: lot.lot,
        quantity: lot.remainingQuantity,
        expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : undefined,
        location: this.formatLocation(lot.depot),
        condition: lot.isExpired ? 'Near Expiry' as const : this.determineCondition(lot.expiryDate),
        daysUntilExpiry: this.calculateDaysUntilExpiry(lot.expiryDate),
        depotName: lot.depot?.nameEn || lot.depot?.nameAr,
        supplierName: lot.supplier?.nameEn || lot.supplier?.nameAr,
        manufacturerName: lot.manufacturer?.nameEn || lot.manufacturer?.nameAr
      }));

    // Sort by expiry date (FEFO)
    return lots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  /**
   * Format location string from depot information
   */
  private formatLocation(depot?: { nameEn?: string; nameAr?: string }): string {
    if (!depot) return 'Unknown Location';
    return depot.nameEn || depot.nameAr || 'Unknown Location';
  }

  /**
   * Determines condition based on expiry date
   */
  private determineCondition(expiryDate?: string): 'Good' | 'Fair' | 'Near Expiry' {
    if (!expiryDate) return 'Good';
    
    const days = this.calculateDaysUntilExpiry(expiryDate);
    if (days < SupplyOrderComponent.DAYS_NEAR_EXPIRY_THRESHOLD) return 'Near Expiry';
    if (days < SupplyOrderComponent.DAYS_FAIR_CONDITION_THRESHOLD) return 'Fair';
    return 'Good';
  }

  /**
   * Calculates days until expiry date
   * Returns large number (999999) if no expiry date or already expired
   */
  private calculateDaysUntilExpiry(expiryDate?: string): number {
    if (!expiryDate) return SupplyOrderComponent.DAYS_UNTIL_EXPIRY_UNDEFINED;
    
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Select a lot for adding
   */
  onSelectLot(lotNumber: number): void {
    this.selectedLotNumber = lotNumber;
    this.addLotForm.patchValue({ lot: lotNumber });
  }

  /**
   * Get display name for selected item
   */
  getSelectedItemDisplayName(): string {
    if (!this.selectedItemForLot) return '';
    const itemId = this.selectedItemForLot.itemId || this.selectedItemForLot.id;
    return this.selectedItemForLot.itemName || this.getItemDisplayName(itemId);
  }

  /**
   * Show confirmation modal before deleting item
   */
  onDeleteItem(item: SupplyItemDisplay): void {
    this.confirmModalTitle = 'Delete Item';
    this.confirmModalMessage = `Are you sure you want to delete "${item.itemName}" (LOT-${item.lot}, Qty: ${item.quantity}) from this supply?`;
    this.confirmModalAction = () => this.confirmDeleteItem(item);
    this.isConfirmModalOpen = true;
  }

  /**
   * Actually delete the item after confirmation
   */
  private confirmDeleteItem(item: SupplyItemDisplay): void {
    this.deletingItem = true;
    this.supplyService.deleteSupplyDetail(this.supplyId, item.supplyDetailId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success(`Item "${item.itemName}" removed from supply`);
          this.deletingItem = false;
          // Reload to refresh list
          this.loadSupplyData();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to delete item');
          this.toastService.error(errorMessage);
          this.deletingItem = false;
        }
      });
  }

  /**
   * Accept (Submit) the supply - requires receiver information
   * Endpoint: POST /api/Supply/{id}/submit
   */
  onAccept(): void {
    if (this.receiverForm.invalid) {
      this.receiverForm.markAllAsTouched();
      this.toastService.error('Please fill in all required receiver information');
      return;
    }

    if (!this.supplyData) return;

    const submitDto: SubmitSupplyDto = this.receiverForm.value;

    this.submitting = true;
    this.supplyService.submit(this.supplyId, submitDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success('Supply order accepted and submitted successfully!');
          this.submitting = false;
          
          setTimeout(() => {
            this.goBack();
          }, 1500);
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to submit supply');
          this.toastService.error(errorMessage);
          this.submitting = false;
        }
      });
  }

  /**
   * Show confirmation modal before rejecting
   */
  onReject(): void {
    if (!this.supplyData) return;

    const orderNo = this.orderData?.requestNo || this.orderData?.orderNo || `#${this.orderId}`;
    this.confirmModalTitle = 'Reject Supply Order';
    this.confirmModalMessage = `Are you sure you want to reject supply order ${orderNo}? You can edit it later.`;
    this.confirmModalAction = () => this.confirmReject();
    this.isConfirmModalOpen = true;
  }

  /**
   * Actually reject after confirmation
   */
  private confirmReject(): void {
    this.rejecting = true;
    this.toastService.warning('Supply order rejected. No changes submitted.');
    
    setTimeout(() => {
      this.rejecting = false;
      this.goBack();
    }, 1000);
  }

  /**
   * Handle confirmation modal actions
   */
  onConfirmAction(): void {
    this.isConfirmModalOpen = false;
    if (this.confirmModalAction) {
      this.confirmModalAction();
      this.confirmModalAction = null;
    }
  }

  onCancelConfirmation(): void {
    this.isConfirmModalOpen = false;
    this.confirmModalAction = null;
  }

  // ==================== UI HELPER METHODS ====================

  /**
   * Get icon component for approval status
   * Note: Kept in component as it depends on lucide-angular icons
   */
  getApprovalStatusIcon(status: string): any {
    switch (status) {
      case 'Approved': return this.CheckCircle;
      case 'Rejected': return this.XIcon;
      case 'Pending': return this.Clock;
      default: return this.Clock;
    }
  }

  // Use utility functions (exposed as component methods for template access)
  getApprovalStatusClass = getApprovalStatusClass;
  formatDate = formatDateUtil;
  formatNumber = formatNumberUtil;
  getPriorityText = getPriorityText;
  getPriorityClass = getPriorityClass;

  getDepartmentName(): string {
    if (!this.orderData) return 'N/A';
    return this.orderData.departmentNameEn || this.orderData.departmentNameAr || 'N/A';
  }

  rankOptionLabel = (option: any): string => {
    if (!option) return '';
    return option.nameEn || option.nameAr || '';
  };

  /**
   * Get display label for item dropdown option
   * Handles both DropdownOption wrapper and direct OrderRequestItemDto
   */
  itemOptionLabel = (option: OrderRequestItemDto | any): string => {
    if (!option) return '';
    
    // Handle DropdownOption wrapper or direct OrderRequestItemDto
    const item: OrderRequestItemDto | undefined = option.value || option;
    
    // Ensure we have a valid item with itemId
    if (!item || (item.itemId === undefined && item.id === undefined)) {
      return '';
    }
    
    const itemId = item.itemId || item.id || 0;
    const itemName = item.itemName || (item as any).name;
    
    return itemName || this.getItemDisplayName(itemId);
  };

  /**
   * Get display name for item (fallback when name is not available)
   */
  private getItemDisplayName(itemId: number): string {
    return `Item #${itemId}`;
  }

  getTotalQuantity(): number {
    return this.supplyItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Checks if the order can be submitted/accepted
   * Requires valid receiver form and order must be in draft or submitted state
   */
  canSubmit(): boolean {
    return this.receiverForm.valid && 
           !this.submitting && 
           !this.rejecting && 
           this.canModifyOrder();
  }

  /**
   * Checks if the order can be modified (accepted/rejected)
   * Orders can only be modified if they are in Draft or Submitted status
   * Approved or Rejected orders cannot be modified
   */
  canModifyOrder(): boolean {
    if (!this.supplyData) return false;
    
    const status = this.supplyData.submissionStatus;
    return status === SubmissionStatus.Draft || status === SubmissionStatus.Submitted;
  }

  /**
   * Checks if the order is already approved
   */
  isOrderApproved(): boolean {
    if (!this.supplyData) return false;
    return this.supplyData.submissionStatus === SubmissionStatus.Approved;
  }

  /**
   * Checks if the order is already rejected
   */
  isOrderRejected(): boolean {
    if (!this.supplyData) return false;
    return this.supplyData.submissionStatus === SubmissionStatus.Rejected;
  }

  /**
   * Gets the current submission status text for display
   */
  getSubmissionStatusText = getSubmissionStatusText;
  getSubmissionStatusClass = getSubmissionStatusClass;

  /**
   * Gets the current order status for display
   */
  getCurrentOrderStatus(): number | null {
    return this.supplyData?.submissionStatus ?? null;
  }
}

