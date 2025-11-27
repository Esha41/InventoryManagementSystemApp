import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, AlertTriangle, CheckCircle, Clock, User, Package, X, ChevronDown, ChevronUp, Plus } from 'lucide-angular';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DropdownComponent } from '../../../shared/components/dropdown/dropdown.component';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { OrderService, OrderDto, OrderRequestItemDto, CreateUpdateRequestItemDto } from '@services/order.service';
import { APIOperationResponse } from '@models/api-response.model';
import { SupplyService, OrderSupplySuggestionDto, CreateSupplyDto, CreateSupplyDetailDto } from '@services/supply.service';
import { InventoryService, LotDetailDto } from '@services/inventory.service';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { AmmunitionService } from '@services/ammunition.service';
import { SupplyRequestDetail, OrderItem, LotItem, ApprovalStep } from '@models/supply-request.model';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { BaseRequestDto } from '@models/workflow-approval.model';
import { mapApprovalHistory, mapRequestStatus } from '@utils/request-mapper.utils';
import { mapOrderToRequestDetail, applySuggestionToItems, calculateDischargeTotals, canProcessDischarge } from '../utils/supply-request.mapper';
import { mapLotDetailsToLotItems, mapSuggestedLotsToLotItems } from '../utils/lot-mapper.utils';
import { mapWorkflowStepsToApprovalSteps } from '../utils/approval-workflow.utils';
import { getLotConditionClass } from '../utils/ui-helpers.utils';
import { formatNumber as formatNumberUtil, formatDate as formatDateUtil } from '@utils/format.utils';
import { getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import { formatLocation, determineCondition, calculateDaysUntilExpiry } from '@utils/lot.utils';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-supply-request-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, LucideAngularModule, ModalComponent, ConfirmDialogComponent, DropdownComponent, HasPermissionDirective],
  templateUrl: './supply-request-detail.component.html',
  styleUrls: ['./supply-request-detail.component.css']
})
export class SupplyRequestDetailComponent implements OnInit, OnDestroy {
  // ==================== LIFECYCLE & ICONS ====================
  private destroy$ = new Subject<void>();
  
  readonly ArrowLeft = ArrowLeft;
  readonly AlertTriangle = AlertTriangle;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly User = User;
  readonly Package = Package;
  readonly XIcon = X;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Plus = Plus;

  // ==================== STATE ====================
  orderId: number = 0;
  issueNo: string = '';
  requestDetail: SupplyRequestDetail | null = null;
  orderData: OrderDto | null = null;
  
  // Collapsible sections state
  isRequestInfoExpanded: boolean = true;
  isReceiverInfoExpanded: boolean = true;
  isApprovalWorkflowExpanded: boolean = true;
  isOrderItemsExpanded: boolean = true;
  
  // Loading states
  loading: boolean = true;
  loadingSuggestion: boolean = false;
  processingDischarge: boolean = false;
  loadingAllLots: boolean = false;
  
  // Lot selection modal state
  isLotModalOpen: boolean = false;
  selectedItem: OrderItem | null = null;
  tempLotSelections: Map<number, number> = new Map(); // Temporary selections in modal
  showManualLotEntry: boolean = false; // Toggle manual entry section
  manualLotNumber: string = ''; // For manual lot entry
  loadingManualLot: boolean = false;

  // Item management modals
  isAddItemModalOpen: boolean = false;
  isEditItemModalOpen: boolean = false;
  isRemoveItemModalOpen: boolean = false;
  selectedItemForEdit: OrderItem | null = null;
  selectedItemForRemove: OrderItem | null = null;
  addItemForm!: FormGroup;
  editItemForm!: FormGroup;
  availableItems: any[] = [];
  loadingItems: boolean = false;
  savingItem: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private ammunitionService: AmmunitionService,
    private fb: FormBuilder,
    private supplyService: SupplyService,
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private config: ConfigService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['id'];
    this.orderId = parseInt(idParam, 10);
    if (isNaN(this.orderId)) {
      this.toastService.error('Invalid order ID');
      this.router.navigate(['/requests-management']);
      return;
    }
    this.initializeAddItemForm();
    this.initializeEditItemForm({} as OrderItem);
    this.loadRequestDetail();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== DATA LOADING ====================

  /**
   * Load order details from backend
   */
  /**
   * Load order details from backend and automatically load suggestions
   */
  loadRequestDetail(): void {
    this.loading = true;
    
    // Load both order details and base request (for approval history)
    this.orderService.getOrderById(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order: OrderDto) => {
          this.orderData = order;
          this.issueNo = order.requestNo || order.orderNo || `#${order.id}`;
          
          // Load base request to get approval history
          this.loadBaseRequestForApprovalHistory();
          
          this.requestDetail = mapOrderToRequestDetail(order);
          this.loading = false;
          
          // Automatically load suggestions after order details are loaded
          this.loadSuggestionsAutomatically();
        },
        error: (error) => {
          console.error('Failed to load order details:', error);
          this.toastService.error('Failed to load order details');
          this.loading = false;
          this.goBack();
        }
      });
  }

  /**
   * Load base request data to get approval workflow history
   */
  private loadBaseRequestForApprovalHistory(): void {
    this.apiService.getWithAuth<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: any) => {
        const data: BaseRequestDto[] = Array.isArray(response) 
          ? response 
          : (response?.data || []);
        
        const baseRequest = data.find(r => r.id === this.orderId);
        
        if (baseRequest && baseRequest.approvalHistory) {
          // Map approval history to ApprovalStep format
          const requestStatus = mapRequestStatus(baseRequest.status);
          const workflowSteps = mapApprovalHistory(baseRequest.approvalHistory, requestStatus);
          
          // Update requestDetail with real approval workflow
          if (this.requestDetail) {
            this.requestDetail.approvalWorkflow = mapWorkflowStepsToApprovalSteps(workflowSteps);
          }
        }
      },
      error: (error) => {
        console.error('Failed to load approval history:', error);
        // Don't show error to user - just use empty/default workflow
      }
    });
  }


  /**
   * Automatically load supply suggestions on page load
   */
  private loadSuggestionsAutomatically(): void {
    if (!this.orderData) return;

    this.loadingSuggestion = true;
    this.supplyService.getSupplySuggestion(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suggestion: OrderSupplySuggestionDto) => {
          if (this.requestDetail) {
            applySuggestionToItems(this.requestDetail, suggestion);
          }
          this.loadingSuggestion = false;
          
          // Silent success - suggestions are loaded automatically
          if (!suggestion.canFulfillCompletely) {
            this.toastService.warning('Note: Insufficient inventory for full fulfillment.');
          }
        },
        error: (error) => {
          console.error('Failed to load suggestions:', error);
          // Don't show error toast for automatic loading - just log it
          this.loadingSuggestion = false;
        }
      });
  }


  goBack(): void {
    // Navigate back to workflow-approval-detail (main approval page)
    // The orderId is the same as requestId used in workflow-approval-detail
    if (this.orderId) {
      this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
    } else {
      this.router.navigate(['/requests-management']);
    }
  }

  // ==================== LOT SELECTION MODAL ====================

  /**
   * Open lot selection modal for an item
   * Shows empty lots list - user must choose how to load lots
   */
  openLotModal(item: OrderItem): void {
    this.selectedItem = item;
    this.tempLotSelections.clear();
    this.openModalWithLots(item);
  }

  private openModalWithLots(item: OrderItem): void {
    // Copy current selections to temp
    item.availableLots.forEach(lot => {
      if (lot.selectedQuantity > 0) {
        this.tempLotSelections.set(lot.lotNumber, lot.selectedQuantity);
      }
    });
    this.isLotModalOpen = true;
  }

  /**
   * Show AVAILABLE lots for this item and quantity (FEFO logic)
   * Endpoint: GET /api/Inventory/item/{itemId}/available-lots?quantity=X
   */
  onShowAvailableLots(): void {
    if (!this.selectedItem) return;
    this.loadAvailableLotsForQuantity(this.selectedItem);
  }

  /**
   * Add lot by lot number
   * Shows input field for manual entry
   */
  onAddLotManually(): void {
    // Toggle manual entry section
    this.showManualLotEntry = !this.showManualLotEntry;
    if (this.showManualLotEntry) {
      this.manualLotNumber = '';
    }
  }

  /**
   * Get details for manually entered lot number
   * Endpoint: GET /api/Inventory/lot/{lotNumber}
   */
  onGetManualLotDetails(): void {
    console.log('onGetManualLotDetails called', { 
      manualLotNumber: this.manualLotNumber, 
      selectedItem: this.selectedItem?.itemId 
    });

    if (!this.selectedItem || !this.manualLotNumber.trim()) {
      this.toastService.warning('Please enter a lot number');
      return;
    }

    const lotNum = parseInt(this.manualLotNumber.trim(), 10);
    console.log('Parsed lot number:', lotNum);
    
    if (isNaN(lotNum)) {
      this.toastService.error('Invalid lot number');
      return;
    }

    console.log('Calling API to fetch lot:', lotNum);
    this.loadingManualLot = true;
    this.inventoryService.getLotByNumber(lotNum)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lot: LotDetailDto) => {
          // Check if lot is for the correct item
          if (lot.itemId !== this.selectedItem!.itemId) {
            this.toastService.error(`Lot ${lotNum} belongs to a different item (${lot.itemName})`);
            this.loadingManualLot = false;
            return;
          }

          // Check if lot already exists in the list
          const existingLot = this.selectedItem!.availableLots.find(l => l.lotNumber === lot.lot);
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

          this.selectedItem!.availableLots.push(newLot);
          
          // Sort by expiry date
          this.selectedItem!.availableLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

          this.toastService.success(`Lot ${lotNum} added successfully`);
          this.manualLotNumber = '';
          this.loadingManualLot = false;
        },
        error: (error) => {
          console.error('Failed to load lot details:', error);
          this.toastService.error('Lot not found or error loading details');
          this.loadingManualLot = false;
        }
      });
  }

  /**
   * Load AVAILABLE lots for an item and quantity (FEFO logic)
   * Endpoint: GET /api/Inventory/item/{itemId}/available-lots?quantity=X
   */
  private loadAvailableLotsForQuantity(item: OrderItem): void {
    this.loadingAllLots = true;
    this.inventoryService.getAvailableLotsForQuantity(item.itemId, item.approvedQuantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots: LotDetailDto[]) => {
          // Save current selections before updating
          const currentSelections = new Map(this.tempLotSelections);
          
          // Map lots to UI format and preserve selections
          item.availableLots = mapLotDetailsToLotItems(lots, currentSelections);
          this.loadingAllLots = false;
          
          if (item.availableLots.length > 0) {
            this.toastService.success(`Loaded ${item.availableLots.length} available lot(s) optimized for quantity ${item.approvedQuantity}`);
          } else {
            this.toastService.warning('No available lots found for requested quantity');
          }
        },
        error: (error) => {
          console.error('Failed to load available lots:', error);
          this.toastService.error('Failed to load available lots');
          this.loadingAllLots = false;
        }
      });
  }


  closeLotModal(): void {
    this.isLotModalOpen = false;
    this.selectedItem = null;
    this.tempLotSelections.clear();
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
  }

  /**
   * Handle quantity change in lot selection modal
   */
  onTempLotQuantityChange(lotNumber: number, quantity: number): void {
    if (quantity > 0) {
      this.tempLotSelections.set(lotNumber, quantity);
    } else {
      this.tempLotSelections.delete(lotNumber);
    }
  }

  /**
   * Remove a lot from the selection list (frontend only)
   */
  onRemoveLot(lotNumber: number): void {
    if (!this.selectedItem) return;

    // Remove from availableLots array
    const index = this.selectedItem.availableLots.findIndex(lot => lot.lotNumber === lotNumber);
    if (index > -1) {
      this.selectedItem.availableLots.splice(index, 1);
      
      // Remove from temp selections if it was selected
      this.tempLotSelections.delete(lotNumber);
      
      this.toastService.success(`Lot ${lotNumber} removed from list`);
    }
  }

  /**
   * Calculate total quantity selected in modal
   */
  getTempTotalSelected(): number {
    return Array.from(this.tempLotSelections.values())
      .reduce((sum, qty) => sum + qty, 0);
  }

  /**
   * Check if selection can be confirmed (has selections and doesn't exceed approved qty)
   */
  canConfirmSelection(): boolean {
    if (!this.selectedItem) return false;
    const total = this.getTempTotalSelected();
    return total > 0 && total <= this.selectedItem.approvedQuantity;
  }

  /**
   * Confirm lot selection and update item's discharge quantity
   * Updates both individual lot selections and item totals
   */
  confirmLotSelection(): void {
    if (!this.selectedItem || !this.canConfirmSelection()) return;

    // Apply selections from temp map to actual lot items
    this.selectedItem.availableLots.forEach(lot => {
      lot.selectedQuantity = this.tempLotSelections.get(lot.lotNumber) || 0;
    });

    // Recalculate total selected for this item from all its lots
    this.selectedItem.totalSelectedForDischarge = this.selectedItem.availableLots
      .reduce((sum, lot) => sum + lot.selectedQuantity, 0);

    this.config.log('Lot selection confirmed', {
      itemId: this.selectedItem.itemId,
      itemName: this.selectedItem.itemName,
      totalSelected: this.selectedItem.totalSelectedForDischarge,
      approvedQty: this.selectedItem.approvedQuantity,
      lotsSelected: this.selectedItem.availableLots.filter(l => l.selectedQuantity > 0).length
    });

    this.closeLotModal();
  }

  // ==================== DISCHARGE SUMMARY CALCULATIONS ====================

  /**
   * Calculate total approved quantity across all items in the order
   */
  getTotalApproved(): number {
    if (!this.requestDetail?.items) return 0;
    return calculateDischargeTotals(this.requestDetail.items).totalApproved;
  }

  /**
   * Calculate total selected for discharge across all items
   * Sums up totalSelectedForDischarge from each item (which is sum of lot selections)
   */
  getTotalSelectedForDischarge(): number {
    if (!this.requestDetail?.items) return 0;
    return calculateDischargeTotals(this.requestDetail.items).totalSelected;
  }

  /**
   * Calculate remaining quantity to be fulfilled
   * Remaining = Total Approved - Total Selected
   */
  getTotalRemaining(): number {
    if (!this.requestDetail?.items) return 0;
    return calculateDischargeTotals(this.requestDetail.items).totalRemaining;
  }

  /**
   * Check if discharge can be processed
   * Requirements: Must have selections AND not exceed approved quantity
   */
  canProcessDischarge(): boolean {
    if (!this.requestDetail?.items) return false;
    return canProcessDischarge(this.requestDetail.items);
  }

  // ==================== SUPPLY SUGGESTIONS ====================

  
  onSuggestForAllItems(): void {
    if (!this.orderData) return;

    this.loadingSuggestion = true;
    this.supplyService.getSupplySuggestion(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suggestion: OrderSupplySuggestionDto) => {
          if (this.requestDetail) {
            applySuggestionToItems(this.requestDetail, suggestion);
          }
          this.loadingSuggestion = false;
          
          if (suggestion.canFulfillCompletely) {
            this.toastService.success('Suggestions loaded! All items can be fulfilled from inventory.');
          } else {
            this.toastService.warning('Suggestions loaded. Note: Insufficient inventory for full fulfillment.');
          }
        },
        error: (error) => {
          console.error('Failed to load suggestions:', error);
          this.toastService.error('Failed to load supply suggestions');
          this.loadingSuggestion = false;
        }
      });
  }


  // ==================== DISCHARGE PROCESSING ====================

  /**
   * Process discharge - creates supply record from selected lots
   * First checks if draft supply already exists for this order
   */
  onProcessDischarge(): void {
    if (!this.requestDetail?.items || !canProcessDischarge(this.requestDetail.items)) return;

    // First check if draft supply already exists
    this.processingDischarge = true;
    this.supplyService.checkDraftSupplyExists(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (existingSupply) => {
          if (existingSupply) {
            // Draft supply already exists
            this.processingDischarge = false;
            this.toastService.warning(`A draft supply (ID: ${existingSupply.id}) already exists for this order. Please update it instead.`);
            return;
          }

          // No draft exists, proceed with creation
          this.createNewSupply();
        },
        error: (error) => {
          console.error('Failed to check existing supply:', error);
          // Continue with creation attempt anyway
          this.createNewSupply();
        }
      });
  }

  /**
   * Create new supply record from selected lots
   * Converts UI selections to backend DTO format
   */
  private createNewSupply(): void {
    if (!this.requestDetail) return;

    // Build supply details array from all selected lots across all items
    const supplyDetails: CreateSupplyDetailDto[] = [];
    
    this.requestDetail.items.forEach(item => {
      item.availableLots.forEach(lot => {
        if (lot.selectedQuantity > 0) {
          supplyDetails.push({
            itemId: item.itemId,
            lot: lot.lotNumber,
            quantity: lot.selectedQuantity,
            notes: undefined
          });
        }
      });
    });

    // Validation
    if (supplyDetails.length === 0) {
      this.toastService.error('No items selected for discharge');
      this.processingDischarge = false;
      return;
    }

    const createSupplyDto: CreateSupplyDto = {
      orderId: this.orderId,
      supplyDetails: supplyDetails
    };

    this.config.log('Creating supply', { 
      orderId: this.orderId, 
      detailCount: supplyDetails.length 
    });

    // Call backend to create supply
    this.supplyService.create(createSupplyDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (supplyId: number) => {
          this.toastService.success(`Discharge processed successfully! Supply ID: ${supplyId}`);
          this.processingDischarge = false;
          
          setTimeout(() => {
            this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
          }, 1500);
        },
        error: (error) => {
          console.error('Failed to create supply:', error);
          const errorMessage = error?.error?.message || error?.message || 'Failed to process discharge';
          this.toastService.error(errorMessage);
          this.processingDischarge = false;
        }
      });
  }

  // ==================== UI HELPER METHODS ====================

  getApprovalStatusIcon(status: string): any {
    switch (status) {
      case 'Approved': return this.CheckCircle;
      case 'Rejected': return this.AlertTriangle;
      case 'Pending': return this.Clock;
      default: return this.Clock;
    }
  }

  getApprovalStatusClass(status: string): string {
    return getApprovalStatusBadgeClass(status);
  }

  getLotConditionClass(condition: string): string {
    return getLotConditionClass(condition);
  }

  getItemTypeIcon(type: string): any {
    return this.Package;
  }

  formatDate(date: Date | string | undefined): string {
    return formatDateUtil(date);
  }

  formatNumber(num: number): string {
    return formatNumberUtil(num);
  }

  getDepartmentName(): string {
    if (!this.orderData) return 'N/A';
    return this.orderData.departmentNameEn || this.orderData.departmentNameAr || 'N/A';
  }

  // ==================== ITEM MANAGEMENT ====================

  /**
   * Get product ID for an item
   */
  getItemProductId(item: OrderItem): string {
    // Try to get from orderData requestItems
    if (this.orderData?.requestItems) {
      const orderItem = this.orderData.requestItems.find(ri => ri.id === item.requestItemId);
      if (orderItem?.itemNo) {
        return orderItem.itemNo;
      }
    }
    return '-';
  }

  /**
   * Get nature option for an item
   */
  getItemNature(item: OrderItem): string {
    // Nature is not directly available in OrderRequestItemDto
    // This would need to be fetched from item details if needed
    return '-';
  }

  /**
   * Get linked status for an item
   */
  getItemLinkedStatus(item: OrderItem): string {
    // Linked status is not directly available in OrderRequestItemDto
    // This would need to be fetched from item details if needed
    return '-';
  }

  /**
   * Open add item modal
   */
  openAddItemModal(): void {
    this.initializeAddItemForm();
    this.loadAvailableItems();
    this.isAddItemModalOpen = true;
  }

  /**
   * Close add item modal
   */
  closeAddItemModal(): void {
    this.isAddItemModalOpen = false;
    this.addItemForm.reset();
  }

  /**
   * Open edit item modal
   */
  openEditItemModal(item: OrderItem): void {
    this.selectedItemForEdit = item;
    this.initializeEditItemForm(item);
    this.isEditItemModalOpen = true;
  }

  /**
   * Close edit item modal
   */
  closeEditItemModal(): void {
    this.isEditItemModalOpen = false;
    this.selectedItemForEdit = null;
    this.editItemForm.reset();
  }

  /**
   * Open remove item confirmation modal
   */
  openRemoveItemModal(item: OrderItem): void {
    this.selectedItemForRemove = item;
    this.isRemoveItemModalOpen = true;
  }

  /**
   * Close remove item modal
   */
  closeRemoveItemModal(): void {
    this.isRemoveItemModalOpen = false;
    this.selectedItemForRemove = null;
  }

  /**
   * Initialize add item form
   */
  private initializeAddItemForm(): void {
    this.addItemForm = this.fb.group({
      itemId: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  /**
   * Initialize edit item form
   */
  private initializeEditItemForm(item: OrderItem): void {
    this.editItemForm = this.fb.group({
      quantity: [item?.approvedQuantity || 1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  /**
   * Load available items for dropdown
   */
  private loadAvailableItems(): void {
    this.loadingItems = true;
    this.ammunitionService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.availableItems = items || [];
          this.loadingItems = false;
        },
        error: (error) => {
          console.error('Failed to load items:', error);
          this.toastService.error('supplyRequestDetail.failedToLoadItems');
          this.loadingItems = false;
        }
      });
  }

  /**
   * Get item option label for dropdown
   */
  itemOptionLabel(item: any): string {
    return item?.name || item?.itemNo || `Item #${item?.id}`;
  }

  /**
   * Save new item
   */
  onSaveAddItem(): void {
    if (this.addItemForm.invalid) {
      this.addItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.addItemForm.value;
    const itemDto: CreateUpdateRequestItemDto = {
      itemId: formValue.itemId,
      quantity: formValue.quantity,
      notes: formValue.notes || undefined
    };

    this.savingItem = true;
    this.orderService.addOrderItem(this.orderId, itemDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<number>) => {
          if (response.succeeded) {
            this.toastService.success('supplyRequestDetail.itemAddedSuccessfully');
            this.closeAddItemModal();
            this.loadRequestDetail(); // Reload to refresh data
          } else {
            this.toastService.error(response.message || 'supplyRequestDetail.failedToAddItem');
          }
          this.savingItem = false;
        },
        error: (error: any) => {
          console.error('Failed to add item:', error);
          this.toastService.error('supplyRequestDetail.failedToAddItem');
          this.savingItem = false;
        }
      });
  }

  /**
   * Save edited item quantity
   */
  onSaveEditItem(): void {
    if (!this.selectedItemForEdit || this.editItemForm.invalid) {
      this.editItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.editItemForm.value;
    const newQuantity = formValue.quantity;

    this.savingItem = true;
    this.orderService.updateOrderItemQuantity(this.orderId, this.selectedItemForEdit.requestItemId, newQuantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<boolean>) => {
          if (response.succeeded) {
            this.toastService.success('supplyRequestDetail.itemQuantityUpdatedSuccessfully');
            this.closeEditItemModal();
            this.loadRequestDetail(); // Reload to refresh data
          } else {
            this.toastService.error(response.message || 'supplyRequestDetail.failedToUpdateItemQuantity');
          }
          this.savingItem = false;
        },
        error: (error: any) => {
          console.error('Failed to update item quantity:', error);
          this.toastService.error('supplyRequestDetail.failedToUpdateItemQuantity');
          this.savingItem = false;
        }
      });
  }

  /**
   * Confirm remove item
   */
  onConfirmRemoveItem(): void {
    if (!this.selectedItemForRemove) return;

    this.orderService.deleteOrderItem(this.orderId, this.selectedItemForRemove.requestItemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<boolean>) => {
          if (response.succeeded) {
            this.toastService.success('supplyRequestDetail.itemRemovedSuccessfully');
            this.closeRemoveItemModal();
            this.loadRequestDetail(); // Reload to refresh data
          } else {
            this.toastService.error(response.message || 'supplyRequestDetail.failedToRemoveItem');
          }
        },
        error: (error: any) => {
          console.error('Failed to remove item:', error);
          this.toastService.error('supplyRequestDetail.failedToRemoveItem');
        }
      });
  }
}
