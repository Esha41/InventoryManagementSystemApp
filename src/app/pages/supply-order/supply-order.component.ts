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
import { SubmissionStatus, getSubmissionStatusText, getSubmissionStatusClass } from '@utils/status.utils';
import { getApprovalStatusClass } from '@utils/status-class.utils';
import { getPriorityText, getPriorityClass } from '@utils/priority.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { mapLotDetailsToLotItems, formatLocation, determineCondition, calculateDaysUntilExpiry } from '@utils/lot.utils';
import { mapSupplyDetailsToDisplay } from '@utils/supply-order.mapper';
import { SUPPLY_ORDER_CONSTANTS } from '@constants/app.constants';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';

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
    ModalComponent,
    HasPermissionDirective
  ],
  templateUrl: './supply-order.component.html',
  styleUrls: ['./supply-order.component.css']
})
export class SupplyOrderComponent implements OnInit, OnDestroy {
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
  // Core data
  orderId: number = 0;
  supplyId: number = 0;
  orderData: OrderDto | null = null;
  supplyData: SupplyDto | null = null;
  
  // Loading states
  loading: boolean = true;
  submitting: boolean = false;
  rejecting: boolean = false;
  updatingItem: boolean = false;
  deletingItem: boolean = false;
  loadingRanks: boolean = false;
  
  // Forms
  receiverForm!: FormGroup;
  addLotForm!: FormGroup;
  
  // Add lot modal state (grouped for better organization)
  isAddLotModalOpen: boolean = false;
  selectedItemForLot: OrderRequestItemDto | null = null;
  availableLots: LotItem[] = [];
  selectedLotNumber: number | null = null;
  showManualLotEntry: boolean = false;
  manualLotNumber: string = '';
  loadingAllLots: boolean = false;
  loadingManualLot: boolean = false;
  loadingLotDetails: boolean = false;
  
  // Confirmation modal state (grouped for better organization)
  isConfirmModalOpen: boolean = false;
  confirmModalTitle: string = '';
  confirmModalMessage: string = '';
  confirmModalAction: (() => void) | null = null;
  
  // Data collections
  orderItems: OrderRequestItemDto[] = [];
  ranks: LookupItem[] = [];
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

  /**
   * Load rank lookup items for the receiver form dropdown
   */
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

  /**
   * Load supply order data including order details and supply information
   */
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
          this.supplyItems = mapSupplyDetailsToDisplay(supply);
          
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

  /**
   * Navigate back to the supply order list
   */
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
    const wrappedValue = selectedValue as { value?: OrderRequestItemDto } | OrderRequestItemDto;
    const item = 'value' in wrappedValue && wrappedValue.value ? wrappedValue.value : (wrappedValue as OrderRequestItemDto);
    return item.id || item.itemId || null;
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
            location: formatLocation(lot.depot),
            condition: lot.isExpired ? 'Near Expiry' : determineCondition(lot.expiryDate),
            daysUntilExpiry: calculateDaysUntilExpiry(lot.expiryDate),
            selectedQuantity: 0,
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
          this.availableLots = mapLotDetailsToLotItems(lots);
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
          this.availableLots = mapLotDetailsToLotItems(lots);
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
   * @param item - The supply item to delete
   */
  onDeleteItem(item: SupplyItemDisplay): void {
    this.showConfirmationModal({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${item.itemName}" (LOT-${item.lot}, Qty: ${item.quantity}) from this supply?`,
      action: () => this.confirmDeleteItem(item)
    });
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
   * Accept (Submit) the supply order - requires receiver information
   * Validates receiver form and submits the supply order to the backend
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
          }, SUPPLY_ORDER_CONSTANTS.NAVIGATION_DELAY_MS);
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to submit supply');
          this.toastService.error(errorMessage);
          this.submitting = false;
        }
      });
  }

  /**
   * Show confirmation modal before rejecting the supply order
   */
  onReject(): void {
    if (!this.supplyData) return;

    const orderNo = this.orderData?.requestNo || this.orderData?.orderNo || `#${this.orderId}`;
    this.showConfirmationModal({
      title: 'Reject Supply Order',
      message: `Are you sure you want to reject supply order ${orderNo}? You can edit it later.`,
      action: () => this.confirmReject()
    });
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
    }, SUPPLY_ORDER_CONSTANTS.REJECTION_DELAY_MS);
  }

  /**
   * Show confirmation modal with specified configuration
   * @param config - Configuration for the confirmation modal
   */
  private showConfirmationModal(config: { title: string; message: string; action: () => void }): void {
    this.confirmModalTitle = config.title;
    this.confirmModalMessage = config.message;
    this.confirmModalAction = config.action;
    this.isConfirmModalOpen = true;
  }

  /**
   * Handle confirmation modal confirm action
   */
  onConfirmAction(): void {
    this.isConfirmModalOpen = false;
    if (this.confirmModalAction) {
      this.confirmModalAction();
      this.confirmModalAction = null;
    }
  }

  /**
   * Handle confirmation modal cancel action
   */
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
  itemOptionLabel = (option: OrderRequestItemDto | { value?: OrderRequestItemDto } | null): string => {
    if (!option) return '';
    
    // Handle DropdownOption wrapper or direct OrderRequestItemDto
    const item: OrderRequestItemDto | undefined = (option as { value?: OrderRequestItemDto }).value || (option as OrderRequestItemDto);
    
    // Ensure we have a valid item with itemId
    if (!item || (item.itemId === undefined && item.id === undefined)) {
      return '';
    }
    
    const itemId = item.itemId || item.id || 0;
    const itemName = item.itemName;
    
    return itemName || this.getItemDisplayName(itemId);
  };

  /**
   * Get display name for item (fallback when name is not available)
   */
  private getItemDisplayName(itemId: number): string {
    return `Item #${itemId}`;
  }

  /**
   * Calculate total quantity across all supply items
   * @returns Sum of all item quantities
   */
  getTotalQuantity(): number {
    return this.supplyItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Checks if the supply order can be submitted/accepted
   * Requires valid receiver form and order must be in draft or submitted state
   * @returns True if the order can be submitted
   */
  canSubmit(): boolean {
    return this.receiverForm.valid && 
           !this.submitting && 
           !this.rejecting && 
           this.canModifyOrder();
  }

  /**
   * Checks if the supply order can be modified (accepted/rejected)
   * Orders can only be modified if they are in Draft or Submitted status
   * Approved or Rejected orders cannot be modified
   * @returns True if the order can be modified
   */
  canModifyOrder(): boolean {
    if (!this.supplyData) return false;
    
    const status = this.supplyData.submissionStatus;
    return status === SubmissionStatus.Draft || status === SubmissionStatus.Submitted;
  }

  /**
   * Checks if the supply order is already approved
   * @returns True if the order status is Approved
   */
  isOrderApproved(): boolean {
    if (!this.supplyData) return false;
    return this.supplyData.submissionStatus === SubmissionStatus.Approved;
  }

  /**
   * Checks if the supply order is already rejected
   * @returns True if the order status is Rejected
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
   * Gets the current submission status of the supply order
   * @returns The submission status number or null if not available
   */
  getCurrentOrderStatus(): number | null {
    return this.supplyData?.submissionStatus ?? null;
  }
}

