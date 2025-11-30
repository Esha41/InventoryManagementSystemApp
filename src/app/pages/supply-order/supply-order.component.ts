import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, CheckCircle, Clock, User, Package, Check, X as XIcon, Plus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { OrderDto, OrderRequestItemDto, CreateUpdateRequestItemDto } from '@services/order.service';
import { OrderService } from '@services/order.service';
import { SupplyService, SupplyDto } from '@services/supply.service';
import { InventoryService, LotDetailDto } from '@services/inventory.service';
import { ToastService } from '@services/toast.service';
import { AmmunitionService } from '@services/ammunition.service';
import { APIOperationResponse } from '@models/api-response.model';
import { ApprovalStep, SupplyItemDisplay, LotItem } from '@models/supply-order.model';
import { formatDate as formatDateUtil, formatNumber as formatNumberUtil } from '@utils/format.utils';
import { getApprovalStatusClass } from '@utils/status-class.utils';
import { getPriorityText, getPriorityClass } from '@utils/priority.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { mapLotDetailsToLotItems, formatLocation, determineCondition, calculateDaysUntilExpiry } from '@utils/lot.utils';
import { mapSupplyDetailsToDisplay } from '@utils/supply-order.mapper';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { BaseRequestDto } from '@models/workflow-approval.model';
import { mapApprovalHistory, mapRequestStatus } from '@utils/request-mapper.utils';
import { mapWorkflowStepsToApprovalSteps } from '../../pages/requests-management/utils/approval-workflow.utils';

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
    ConfirmDialogComponent,
    HasPermissionDirective
  ],
  templateUrl: './supply-order.component.html',
  styleUrls: ['./supply-order.component.css']
})
export class SupplyOrderComponent implements OnInit, OnDestroy {
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
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;

  orderId: number = 0;
  supplyId: number = 0;
  orderData: OrderDto | null = null;
  supplyData: SupplyDto | null = null;
  
  loading: boolean = true;
  updatingItem: boolean = false;
  deletingItem: boolean = false;
  
  addLotForm!: FormGroup;
  
  isAddLotModalOpen: boolean = false;
  selectedItemForLot: OrderRequestItemDto | null = null;
  availableLots: LotItem[] = [];
  selectedLotNumber: number | null = null;
  showManualLotEntry: boolean = false;
  manualLotNumber: string = '';
  loadingAllLots: boolean = false;
  loadingManualLot: boolean = false;
  loadingLotDetails: boolean = false;
  
  isConfirmModalOpen: boolean = false;
  confirmModalTitle: string = '';
  confirmModalMessage: string = '';
  confirmModalAction: (() => void) | null = null;
  
  isAddItemModalOpen: boolean = false;
  isEditItemModalOpen: boolean = false;
  isRemoveItemModalOpen: boolean = false;
  selectedItemForEdit: OrderRequestItemDto | null = null;
  selectedItemForRemove: OrderRequestItemDto | null = null;
  addItemForm!: FormGroup;
  editItemForm!: FormGroup;
  availableItems: any[] = [];
  loadingItems: boolean = false;
  savingItem: boolean = false;
  
  orderItems: OrderRequestItemDto[] = [];
  approvalWorkflow: ApprovalStep[] = [];
  supplyItems: SupplyItemDisplay[] = [];
  
  isApprovalWorkflowExpanded: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private orderService: OrderService,
    private supplyService: SupplyService,
    private inventoryService: InventoryService,
    private ammunitionService: AmmunitionService,
    private toastService: ToastService,
    private apiService: ApiService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['supplyId'];
    const receivedId = parseInt(idParam, 10);
    const byOrder = this.route.snapshot.queryParams['byOrder'] === 'true';
    
    if (isNaN(receivedId)) {
      this.toastService.error('Invalid ID');
      this.router.navigate(['/supply-order']);
      return;
    }
    
    this.initializeAddItemForm();
    this.initializeEditItemForm({} as OrderRequestItemDto);
    
    if (byOrder) {
      this.loadSupplyByOrderId(receivedId);
    } else {
      this.supplyId = receivedId;
      this.loadSupplyData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.addLotForm = this.fb.group({
      itemId: [null, Validators.required],
      lot: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
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
  private initializeEditItemForm(item: OrderRequestItemDto): void {
    this.editItemForm = this.fb.group({
      quantity: [item?.quantity || 1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  private loadSupplyByOrderId(orderId: number): void {
    this.loading = true;
    this.orderId = orderId;
    
    this.supplyService.getByOrderId(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (supply: SupplyDto) => {
          this.supplyId = supply.id;
          this.supplyData = supply;
          this.orderData = supply.order;
          this.orderItems = supply.order?.requestItems || [];
          this.supplyItems = mapSupplyDetailsToDisplay(supply);
          this.loadApprovalWorkflow();
          this.loading = false;
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load supply for this order');
          this.toastService.error(errorMessage);
          this.loading = false;
          this.goBack();
        }
      });
  }

  private loadSupplyData(): void {
    this.loading = true;
    
    this.supplyService.getById(this.supplyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (supply: SupplyDto) => {
          this.supplyData = supply;
          this.orderId = supply.orderId;
          this.orderData = supply.order;
          this.orderItems = supply.order?.requestItems || [];
          this.supplyItems = mapSupplyDetailsToDisplay(supply);
          this.loadApprovalWorkflow();
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

  private loadApprovalWorkflow(): void {
    if (!this.orderId) {
      this.approvalWorkflow = [];
      return;
    }

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
          const requestStatus = mapRequestStatus(baseRequest.status);
          const workflowSteps = mapApprovalHistory(baseRequest.approvalHistory, requestStatus);
          this.approvalWorkflow = mapWorkflowStepsToApprovalSteps(workflowSteps);
        } else {
          this.approvalWorkflow = [];
        }
      },
      error: () => {
        this.approvalWorkflow = [];
      }
    });
  }
  goBack(): void {
    const byOrder = this.route.snapshot.queryParams['byOrder'] === 'true';
    
    if (byOrder && this.orderId) {
      this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
    } else {
      this.router.navigate(['/supply-order']);
    }
  }

  onEditItem(item: SupplyItemDisplay): void {
    item.isEditing = true;
  }

  onCancelEdit(item: SupplyItemDisplay): void {
    item.isEditing = false;
    this.loadSupplyData();
  }

  onUpdateItem(item: SupplyItemDisplay): void {
    if (!this.supplyData) {
      this.toastService.error('Supply data not loaded');
      return;
    }
    
    if (!item.quantity || item.quantity <= 0) {
      this.toastService.error('Quantity must be greater than 0');
      return;
    }
    
    if (!item.lot || item.lot <= 0) {
      this.toastService.error('Invalid lot number');
      return;
    }
    
    if (!item.itemId || item.itemId <= 0) {
      this.toastService.error('Invalid item');
      return;
    }

    this.updatingItem = true;
    this.supplyService.updateSupplyDetail(this.supplyId, item.supplyDetailId, {
      itemId: item.itemId,
      lot: item.lot,
      quantity: item.quantity,
      notes: item.notes || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success('Item updated successfully');
          item.isEditing = false;
          this.updatingItem = false;
          this.loadSupplyData();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to update item');
          this.toastService.error(errorMessage);
          this.updatingItem = false;
          this.loadSupplyData();
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
    
    this.resetLotSelection();
  }

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

  onAddLot(): void {
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
          this.loadSupplyData();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to add lot');
          this.toastService.error(errorMessage);
          this.loadingLotDetails = false;
        }
      });
  }

  onShowAllLots(): void {
    if (!this.selectedItemForLot) {
      this.toastService.warning('Please select an item first');
      return;
    }
    this.loadAllLotsForItem(this.selectedItemForLot);
  }

  onShowAvailableLots(): void {
    if (!this.selectedItemForLot) {
      this.toastService.warning('Please select an item first');
      return;
    }
    this.loadAvailableLotsForQuantity(this.selectedItemForLot);
  }

  onAddLotManually(): void {
    this.showManualLotEntry = !this.showManualLotEntry;
    if (this.showManualLotEntry) {
      this.manualLotNumber = '';
    }
  }

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
          if (lot.itemId !== this.selectedItemForLot!.itemId) {
            this.toastService.error(`Lot ${lotNum} belongs to a different item (${lot.itemName || 'Unknown'})`);
            this.loadingManualLot = false;
            return;
          }

          const existingLot = this.availableLots.find(l => l.lotNumber === lot.lot);
          if (existingLot) {
            this.toastService.warning(`Lot ${lotNum} is already in the list`);
            this.loadingManualLot = false;
            return;
          }

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
  onSelectLot(lotNumber: number): void {
    this.selectedLotNumber = lotNumber;
    this.addLotForm.patchValue({ lot: lotNumber });
  }

  getSelectedItemDisplayName(): string {
    if (!this.selectedItemForLot) return '';
    const itemId = this.selectedItemForLot.itemId || this.selectedItemForLot.id;
    return this.selectedItemForLot.itemName || this.getItemDisplayName(itemId);
  }

  onDeleteItem(item: SupplyItemDisplay): void {
    this.showConfirmationModal({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${item.itemName}" (LOT-${item.lot}, Qty: ${item.quantity}) from this supply?`,
      action: () => this.confirmDeleteItem(item)
    });
  }

  private confirmDeleteItem(item: SupplyItemDisplay): void {
    this.deletingItem = true;
    this.supplyService.deleteSupplyDetail(this.supplyId, item.supplyDetailId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success(`Item "${item.itemName}" removed from supply`);
          this.deletingItem = false;
          this.loadSupplyData();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to delete item');
          this.toastService.error(errorMessage);
          this.deletingItem = false;
        }
      });
  }
  private showConfirmationModal(config: { title: string; message: string; action: () => void }): void {
    this.confirmModalTitle = config.title;
    this.confirmModalMessage = config.message;
    this.confirmModalAction = config.action;
    this.isConfirmModalOpen = true;
  }

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

  getApprovalStatusIcon(status: string): any {
    switch (status) {
      case 'Approved': return this.CheckCircle;
      case 'Rejected': return this.XIcon;
      case 'Pending': return this.Clock;
      default: return this.Clock;
    }
  }

  getApprovalStatusClass = getApprovalStatusClass;
  formatDate = formatDateUtil;
  formatNumber = formatNumberUtil;
  getPriorityText = getPriorityText;
  getPriorityClass = getPriorityClass;

  getDepartmentName(): string {
    if (!this.orderData) return 'N/A';
    return this.orderData.departmentNameEn || this.orderData.departmentNameAr || 'N/A';
  }

  itemOptionLabel = (option: OrderRequestItemDto | { value?: OrderRequestItemDto } | null): string => {
    if (!option) return '';
    
    const item: OrderRequestItemDto | undefined = (option as { value?: OrderRequestItemDto }).value || (option as OrderRequestItemDto);
    
    if (!item || (item.itemId === undefined && item.id === undefined)) {
      return '';
    }
    
    const itemId = item.itemId || item.id || 0;
    const itemName = item.itemName;
    
    return itemName || this.getItemDisplayName(itemId);
  };

  private getItemDisplayName(itemId: number): string {
    return `Item #${itemId}`;
  }

  getTotalQuantity(): number {
    return this.supplyItems.reduce((sum, item) => sum + item.quantity, 0);
  }
  getItemProductId(item: OrderRequestItemDto): string {
    if (item.itemNo) {
      return item.itemNo;
    }
    return '-';
  }

  /**
   * Open add item modal
   */
  openAddOrderItemModal(): void {
    this.initializeAddItemForm();
    this.loadAvailableItems();
    this.isAddItemModalOpen = true;
  }

  /**
   * Close add item modal
   */
  closeAddOrderItemModal(): void {
    this.isAddItemModalOpen = false;
    this.addItemForm.reset();
  }

  /**
   * Open edit item modal
   */
  openEditOrderItemModal(item: OrderRequestItemDto): void {
    this.selectedItemForEdit = item;
    this.initializeEditItemForm(item);
    this.isEditItemModalOpen = true;
  }

  /**
   * Close edit item modal
   */
  closeEditOrderItemModal(): void {
    this.isEditItemModalOpen = false;
    this.selectedItemForEdit = null;
    this.editItemForm.reset();
  }

  /**
   * Open remove item confirmation modal
   */
  openRemoveOrderItemModal(item: OrderRequestItemDto): void {
    this.selectedItemForRemove = item;
    this.isRemoveItemModalOpen = true;
  }

  /**
   * Close remove item modal
   */
  closeRemoveOrderItemModal(): void {
    this.isRemoveItemModalOpen = false;
    this.selectedItemForRemove = null;
  }

  private loadAvailableItems(): void {
    this.loadingItems = true;
    this.ammunitionService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          const existingItemIds = this.orderItems.map(item => item.itemId);
          this.availableItems = (items || []).filter(item => !existingItemIds.includes(item.id));
          this.loadingItems = false;
        },
        error: () => {
          this.toastService.error('Failed to load items');
          this.loadingItems = false;
        }
      });
  }

  itemManagementOptionLabel = (item: any): string => {
    return item?.name || item?.itemNo || `Item #${item?.id}`;
  };

  onSaveAddOrderItem(): void {
    if (this.addItemForm.invalid) {
      this.addItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.addItemForm.value;
    const existingItem = this.orderItems.find(item => item.itemId === formValue.itemId);
    if (existingItem) {
      this.toastService.error(`Item already exists in this order. Please use Edit to update the quantity instead.`);
      return;
    }

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
            this.toastService.success('Item added successfully');
            this.closeAddOrderItemModal();
            this.loadSupplyData();
          } else {
            this.toastService.error(response.message || 'Failed to add item');
          }
          this.savingItem = false;
        },
        error: (error: any) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to add item');
          this.toastService.error(errorMessage);
          this.savingItem = false;
        }
      });
  }

  onSaveEditOrderItem(): void {
    if (!this.selectedItemForEdit || this.editItemForm.invalid) {
      this.editItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.editItemForm.value;
    const newQuantity = formValue.quantity;

    this.savingItem = true;
    this.orderService.updateOrderItemQuantity(this.orderId, this.selectedItemForEdit.id, newQuantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<boolean>) => {
          if (response.succeeded) {
            this.toastService.success('Item quantity updated successfully');
            this.closeEditOrderItemModal();
            this.loadSupplyData();
          } else {
            this.toastService.error(response.message || 'Failed to update item quantity');
          }
          this.savingItem = false;
        },
        error: (error: any) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to update item quantity');
          this.toastService.error(errorMessage);
          this.savingItem = false;
        }
      });
  }

  onConfirmRemoveOrderItem(): void {
    if (!this.selectedItemForRemove) return;

    this.orderService.deleteOrderItem(this.orderId, this.selectedItemForRemove.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<boolean>) => {
          if (response.succeeded) {
            this.toastService.success('Item removed successfully');
            this.closeRemoveOrderItemModal();
            this.loadSupplyData();
          } else {
            this.toastService.error(response.message || 'Failed to remove item');
          }
        },
        error: (error: any) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to remove item');
          this.toastService.error(errorMessage);
        }
      });
  }
}

