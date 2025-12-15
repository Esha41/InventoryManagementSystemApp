import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, CheckCircle, Clock, User, Package, Check, X as XIcon, Plus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-angular';
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
import { SupplyItemDisplay, LotItem } from '@models/supply-order.model';
import { formatDate as formatDateUtil, formatNumber as formatNumberUtil } from '@utils/format.utils';
import { getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import { getPriorityText, getPriorityClass } from '@utils/priority.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { mapLotDetailsToLotItems, formatLocation, determineCondition, calculateDaysUntilExpiry } from '@utils/lot.utils';
import { mapSupplyDetailsToDisplay } from '@utils/supply-order.mapper';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { BaseRequestDto, WorkflowApprovalStep } from '@models/workflow-approval.model';
import { mapApprovalHistory, mapRequestStatus } from '@utils/request-mapper.utils';
import { LoadingStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';

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
    HasPermissionDirective,
    LoadingStateComponent
  ],
  templateUrl: './supply-order.component.html',
  styleUrls: ['./supply-order.component.css']
})
export class SupplyOrderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
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

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

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
  approvalWorkflow: WorkflowApprovalStep[] = [];
  supplyItems: SupplyItemDisplay[] = [];
  baseRequestData: BaseRequestDto | null = null;

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
    private apiService: ApiService,
    private translateService: TranslateService,
    private translationService: TranslationService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['supplyId'];
    const receivedId = parseInt(idParam, 10);
    const byOrder = this.route.snapshot.queryParams['byOrder'] === 'true';

    if (isNaN(receivedId)) {
      this.translateService.get(['toast.error', 'supplyOrder.errors.invalidId']).subscribe(translations => {
        this.toastService.error(
          translations['supplyOrder.errors.invalidId'] || 'Invalid ID',
          translations['toast.error']
        );
      });
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


          if (this.orderData && (!this.orderData.departmentNameEn && !this.orderData.departmentNameAr || !this.orderData.requesterName)) {
            this.loadFullOrderDetails(orderId);
          }

          this.loadApprovalWorkflow();
          this.loading = false;
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load supply for this order');
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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


          if (this.orderData && (!this.orderData.departmentNameEn && !this.orderData.departmentNameAr || !this.orderData.requesterName)) {
            this.loadFullOrderDetails(this.orderId);
          }

          this.loadApprovalWorkflow();
          this.loading = false;
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load supply order');
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.loading = false;
          this.goBack();
        }
      });
  }


  private loadFullOrderDetails(orderId: number): void {
    this.orderService.getOrderById(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (fullOrder: OrderDto) => {

          if (this.orderData) {

            if (!this.orderData.departmentNameEn && !this.orderData.departmentNameAr) {
              this.orderData.departmentNameEn = fullOrder.departmentNameEn;
              this.orderData.departmentNameAr = fullOrder.departmentNameAr;
            }

            if (!this.orderData.requesterName) {
              this.orderData.requesterName = fullOrder.requesterName;
            }
          }
        },
        error: (error) => {

          console.warn('Failed to load full order details for department/requester info:', error);
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
          this.baseRequestData = baseRequest || null;

          if (baseRequest && baseRequest.approvalHistory) {
            const requestStatus = mapRequestStatus(baseRequest.status);
            this.approvalWorkflow = mapApprovalHistory(baseRequest.approvalHistory, requestStatus);
          } else {
            this.approvalWorkflow = [];
          }
        },
        error: () => {
          this.approvalWorkflow = [];
          this.baseRequestData = null;
        }
      });
  }

  get displayApprovalHistory(): WorkflowApprovalStep[] {
    if (!this.orderData) {
      return [];
    }

    const requestDate = this.baseRequestData?.requestDate || this.orderData.usageDateFrom || '';
    const requestDateString = typeof requestDate === 'string' ? requestDate : (requestDate instanceof Date ? requestDate.toISOString() : '');

    const requesterStep: WorkflowApprovalStep = {
      id: 0,
      approverName: this.orderData.requesterName || 'Unknown Requester',
      approverNameEn: this.baseRequestData?.['requesterNameEn'] || this.orderData.requesterName,
      approverNameAr: this.baseRequestData?.['requesterNameAr'],
      status: 'Approved',
      applicationRoleName: 'Requester (Order Requesting Entity)',
      approvedDateTime: requestDateString,
      isPending: false,
      comments: this.orderData.notes
    };

    return [requesterStep, ...this.approvalWorkflow];
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
    item.originalQuantity = item.quantity; // Store original quantity for validation
    item.quantityError = undefined; // Clear any previous errors
  }

  onCancelEdit(item: SupplyItemDisplay): void {
    item.isEditing = false;
    item.originalQuantity = undefined;
    item.quantityError = undefined;
    this.loadSupplyData();
  }

  onUpdateItem(item: SupplyItemDisplay): void {
    if (!this.supplyData) {
      this.translateService.get(['supplyOrder.toast.supplyDataNotLoaded', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.supplyDataNotLoaded'], translations['toast.error']);
      });
      return;
    }

    // Clear previous errors
    item.quantityError = undefined;

    if (!item.quantity || item.quantity <= 0) {
      this.translateService.get(['supplyOrder.toast.quantityMustBeGreaterThanZero']).subscribe(translations => {
        item.quantityError = translations['supplyOrder.toast.quantityMustBeGreaterThanZero'];
        this.toastService.error(translations['supplyOrder.toast.quantityMustBeGreaterThanZero']);
      });
      return;
    }

    if (!item.lot || item.lot <= 0) {
      this.translateService.get(['supplyOrder.toast.invalidLotNumber', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.invalidLotNumber'], translations['toast.error']);
      });
      return;
    }

    if (!item.itemId || item.itemId <= 0) {
      this.translateService.get(['supplyOrder.toast.invalidItem', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.invalidItem'], translations['toast.error']);
      });
      return;
    }

    // Validate that the new quantity doesn't exceed the requested quantity
    // Calculate what the new total supplied quantity would be
    const originalQuantity = item.originalQuantity || item.quantity;
    const currentTotalSupplied = item.totalSuppliedQuantity;
    const newTotalSupplied = currentTotalSupplied - originalQuantity + item.quantity;

    if (newTotalSupplied > item.requestedQuantity) {
      const maxAllowedQuantity = item.requestedQuantity - (currentTotalSupplied - originalQuantity);
      this.translateService.get(['supplyOrder.toast.maxQuantityExceeded', 'toast.error']).subscribe(translations => {
        const errorMsg = translations['supplyOrder.toast.maxQuantityExceeded']
          .replace('{{maxQuantity}}', formatNumberUtil(maxAllowedQuantity))
          .replace('{{requestedQuantity}}', formatNumberUtil(item.requestedQuantity));
        item.quantityError = errorMsg;
        this.toastService.error(errorMsg, translations['toast.error']);
      });
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
          this.translateService.get(['supplyOrder.toast.itemUpdatedSuccessfully', 'toast.success']).subscribe(translations => {
            this.toastService.success(translations['supplyOrder.toast.itemUpdatedSuccessfully'], translations['toast.success']);
          });
          item.isEditing = false;
          item.originalQuantity = undefined;
          item.quantityError = undefined;
          this.updatingItem = false;
          this.loadSupplyData();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to update item');
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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
      this.translateService.get(['supplyOrder.toast.pleaseSelectItem', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.pleaseSelectItem'], translations['toast.error']);
      });
      return;
    }

    if (!this.selectedLotNumber) {
      this.addLotForm.get('lot')?.markAsTouched();
      this.translateService.get(['supplyOrder.toast.pleaseSelectLot', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.pleaseSelectLot'], translations['toast.error']);
      });
      return;
    }

    if (this.addLotForm.invalid) {
      this.addLotForm.markAllAsTouched();
      this.translateService.get(['supplyOrder.toast.pleaseFillRequiredFields', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.pleaseFillRequiredFields'], translations['toast.error']);
      });
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
          this.translateService.get(['supplyOrder.toast.lotAddedSuccessfullyToSupply', 'toast.success']).subscribe(translations => {
            this.toastService.success(translations['supplyOrder.toast.lotAddedSuccessfullyToSupply'], translations['toast.success']);
          });
          this.loadingLotDetails = false;
          this.closeAddLotModal();
          this.loadSupplyData();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to add lot');
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.loadingLotDetails = false;
        }
      });
  }

  onShowAvailableLots(): void {
    if (!this.selectedItemForLot) {
      this.translateService.get(['supplyOrder.toast.pleaseSelectItemFirst', 'toast.warning']).subscribe(translations => {
        this.toastService.warning(translations['supplyOrder.toast.pleaseSelectItemFirst'], translations['toast.warning']);
      });
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
      this.translateService.get(['supplyOrder.toast.pleaseEnterLotNumber', 'toast.warning']).subscribe(translations => {
        this.toastService.warning(translations['supplyOrder.toast.pleaseEnterLotNumber'], translations['toast.warning']);
      });
      return;
    }

    const lotNum = parseInt(this.manualLotNumber.trim(), 10);
    if (isNaN(lotNum)) {
      this.translateService.get(['supplyOrder.toast.invalidLotNumber', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.invalidLotNumber'], translations['toast.error']);
      });
      return;
    }

    this.loadingManualLot = true;
    this.inventoryService.getLotByNumber(lotNum)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lot: LotDetailDto) => {
          if (lot.itemId !== this.selectedItemForLot!.itemId) {
            this.translateService.get(['supplyOrder.toast.lotBelongsToDifferentItemWithName', 'toast.error']).subscribe(translations => {
              const errorMsg = translations['supplyOrder.toast.lotBelongsToDifferentItemWithName']
                .replace('{{lotNumber}}', lotNum.toString())
                .replace('{{itemName}}', lot.itemName || 'Unknown');
              this.toastService.error(errorMsg, translations['toast.error']);
            });
            this.loadingManualLot = false;
            return;
          }

          const existingLot = this.availableLots.find(l => l.lotNumber === lot.lot);
          if (existingLot) {
            this.translateService.get(['supplyOrder.toast.lotAlreadyInListWithNumber', 'toast.warning']).subscribe(translations => {
              const warningMsg = translations['supplyOrder.toast.lotAlreadyInListWithNumber'].replace('{{lotNumber}}', lotNum.toString());
              this.toastService.warning(warningMsg, translations['toast.warning']);
            });
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
            depotName: getLocalizedName(lot.depot, getCurrentLang(this.translateService)),
            supplierName: getLocalizedName(lot.supplier, getCurrentLang(this.translateService)),
            manufacturerName: getLocalizedName(lot.manufacturer, getCurrentLang(this.translateService))
          };

          this.availableLots.push(newLot);
          this.availableLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

          this.translateService.get(['supplyOrder.toast.lotAddedSuccessfullyWithNumber', 'toast.success']).subscribe(translations => {
            const successMsg = translations['supplyOrder.toast.lotAddedSuccessfullyWithNumber'].replace('{{lotNumber}}', lotNum.toString());
            this.toastService.success(successMsg, translations['toast.success']);
          });
          this.manualLotNumber = '';
          this.loadingManualLot = false;
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Lot not found or error loading details');
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.loadingManualLot = false;
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
            this.translateService.get(['supplyOrder.toast.loadedAvailableLotsCount', 'toast.success']).subscribe(translations => {
              const successMsg = translations['supplyOrder.toast.loadedAvailableLotsCount']
                .replace('{{count}}', this.availableLots.length.toString())
                .replace('{{quantity}}', formatNumberUtil(item.quantity));
              this.toastService.success(successMsg, translations['toast.success']);
            });
          } else {
            this.translateService.get(['supplyOrder.toast.noAvailableLotsFoundForQuantity', 'toast.warning']).subscribe(translations => {
              this.toastService.warning(translations['supplyOrder.toast.noAvailableLotsFoundForQuantity'], translations['toast.warning']);
            });
          }
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load available lots');
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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
    return this.getLocalizedOrderItemName(this.selectedItemForLot);
  }

  onDeleteItem(item: SupplyItemDisplay): void {
    this.showConfirmationModal({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${this.getSupplyItemDisplayName(item)}" (LOT-${item.lot}, Qty: ${item.quantity}) from this supply?`,
      action: () => this.confirmDeleteItem(item)
    });
  }

  private confirmDeleteItem(item: SupplyItemDisplay): void {
    this.deletingItem = true;
    this.supplyService.deleteSupplyDetail(this.supplyId, item.supplyDetailId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.translateService.get(['supplyOrder.toast.itemRemovedFromSupply', 'toast.success']).subscribe(translations => {
            const successMsg = translations['supplyOrder.toast.itemRemovedFromSupply'].replace('{{itemName}}', item.itemName);
            this.toastService.success(successMsg, translations['toast.success']);
          });
          this.deletingItem = false;
          this.loadSupplyData();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to delete item');
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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

  formatDate = formatDateUtil;
  formatNumber = formatNumberUtil;
  getPriorityText = getPriorityText;
  getPriorityClass = getPriorityClass;

  getDepartmentName(): string {
    if (!this.orderData) return 'N/A';
    const lang = getCurrentLang(this.translateService);
    const nameEn = this.orderData.departmentNameEn;
    const nameAr = this.orderData.departmentNameAr;

    if (lang === 'ar') {
      return nameAr || nameEn || 'N/A';
    }

    return nameEn || nameAr || 'N/A';
  }

  itemOptionLabel = (option: OrderRequestItemDto | { value?: OrderRequestItemDto } | null): string => {
    if (!option) return '';

    const item: OrderRequestItemDto | undefined = (option as { value?: OrderRequestItemDto }).value || (option as OrderRequestItemDto);

    if (!item || (item.itemId === undefined && item.id === undefined)) {
      return '';
    }

    return this.getLocalizedOrderItemName(item);
  };

  private getItemDisplayName(itemId: number): string {
    return `Item #${itemId}`;
  }

  getTotalQuantity(): number {
    return this.supplyItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Calculate the maximum allowed quantity for a supply item
   * This considers the requested quantity and current total supplied quantity
   */
  getMaxAllowedQuantity(item: SupplyItemDisplay): number {
    const originalQuantity = item.originalQuantity || item.quantity;
    const currentTotalSupplied = item.totalSuppliedQuantity;
    const maxAllowed = item.requestedQuantity - (currentTotalSupplied - originalQuantity);
    return Math.max(0, maxAllowed);
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
          this.translateService.get(['supplyOrder.toast.failedToLoadItems', 'toast.error']).subscribe(translations => {
            this.toastService.error(translations['supplyOrder.toast.failedToLoadItems'], translations['toast.error']);
          });
          this.loadingItems = false;
        }
      });
  }

  itemManagementOptionLabel = (item: any): string => {
    if (!item) return '';

    const lang = getCurrentLang(this.translateService);
    const localizedName = getLocalizedName(item, lang);

    return localizedName || item?.itemNo || `Item #${item?.id}`;
  };

  onSaveAddOrderItem(): void {
    if (this.addItemForm.invalid) {
      this.addItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.addItemForm.value;
    const existingItem = this.orderItems.find(item => item.itemId === formValue.itemId);
    if (existingItem) {
      this.translateService.get(['supplyOrder.toast.itemAlreadyExists', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.itemAlreadyExists'], translations['toast.error']);
      });
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
            this.translateService.get(['supplyOrder.toast.itemAddedSuccessfully', 'toast.success']).subscribe(translations => {
              this.toastService.success(translations['supplyOrder.toast.itemAddedSuccessfully'], translations['toast.success']);
            });
            this.closeAddOrderItemModal();
            this.loadSupplyData();
          } else {
            this.translateService.get(['toast.error', 'toast.failedToAddItem']).subscribe(translations => {
              this.toastService.error(response.message || translations['toast.failedToAddItem'], translations['toast.error']);
            });
          }
          this.savingItem = false;
        },
        error: (error: any) => {
          this.translateService.get(['toast.error', 'toast.failedToAddItem']).subscribe(translations => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, translations['toast.failedToAddItem']);
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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
            this.translateService.get(['supplyOrder.toast.itemQuantityUpdatedSuccessfully', 'toast.success']).subscribe(translations => {
              this.toastService.success(translations['supplyOrder.toast.itemQuantityUpdatedSuccessfully'], translations['toast.success']);
            });
            this.closeEditOrderItemModal();
            this.loadSupplyData();
          } else {
            this.translateService.get(['toast.error', 'toast.failedToUpdateItemQuantity']).subscribe(translations => {
              this.toastService.error(response.message || translations['toast.failedToUpdateItemQuantity'], translations['toast.error']);
            });
          }
          this.savingItem = false;
        },
        error: (error: any) => {
          this.translateService.get(['toast.error', 'toast.failedToUpdateItemQuantity']).subscribe(translations => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, translations['toast.failedToUpdateItemQuantity']);
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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
            this.translateService.get(['supplyOrder.toast.itemRemovedSuccessfully', 'toast.success']).subscribe(translations => {
              this.toastService.success(translations['supplyOrder.toast.itemRemovedSuccessfully'], translations['toast.success']);
            });
            this.closeRemoveOrderItemModal();
            this.loadSupplyData();
          } else {
            this.translateService.get(['toast.error', 'toast.failedToRemoveItem']).subscribe(translations => {
              this.toastService.error(response.message || translations['toast.failedToRemoveItem'], translations['toast.error']);
            });
          }
        },
        error: (error: any) => {
          this.translateService.get(['toast.error', 'toast.failedToRemoveItem']).subscribe(translations => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, translations['toast.failedToRemoveItem']);
            this.toastService.error(errorMessage, translations['toast.error']);
          });
        }
      });
  }

  /**
   * Get localized display name for an order item (request item)
   */
  private getLocalizedOrderItemName(item: OrderRequestItemDto | null | undefined): string {
    if (!item) return '';

    const lang = getCurrentLang(this.translateService);
    const anyItem: any = item as any;

    // Prefer localizing the nested item object if available
    const localized =
      getLocalizedName(anyItem.item ?? anyItem, lang) ||
      anyItem.itemName;

    const id = anyItem.itemId || anyItem.id || 0;

    return localized || this.getItemDisplayName(id);
  }

  /**
   * Get localized name for a supply item display row
   */
  private getSupplyItemDisplayName(item: SupplyItemDisplay): string {
    const lang = getCurrentLang(this.translateService);
    const anyItem: any = item as any;

    const localized =
      getLocalizedName(anyItem.item ?? anyItem, lang) ||
      anyItem.itemName;

    const id = anyItem.itemId || anyItem.id || 0;

    return localized || this.getItemDisplayName(id);
  }

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

  isPartiallyFulfilled(item: SupplyItemDisplay): boolean {
    return !item.isFullyFulfilled &&
      item.totalSuppliedQuantity > 0 &&
      item.totalSuppliedQuantity < item.requestedQuantity;
  }

  /**
   * Get localized approver name based on current language
   */
  getApproverName(approval: any): string {
    const currentLang = this.translationService.getCurrentLanguage();

    // For pending steps, use role name (not user name)
    if (approval.isPending) {
      if (currentLang === 'ar' && approval.applicationRoleNameAr) {
        return approval.applicationRoleNameAr;
      } else if (approval.applicationRoleName) {
        return approval.applicationRoleName;
      }
    }

    // For completed steps, use user name
    if (currentLang === 'ar' && approval.approverNameAr) {
      return approval.approverNameAr;
    } else if (approval.approverNameEn) {
      return approval.approverNameEn;
    } else if (approval.approverName) {
      return approval.approverName;
    }

    return '';
  }
}

