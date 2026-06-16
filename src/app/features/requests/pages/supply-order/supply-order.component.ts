import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, AlertTriangle } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ModalComponent } from '@components/modal/modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { AddLotModalComponent } from './components/add-lot-modal/add-lot-modal.component';
import { AddOrderItemModalComponent } from './components/add-order-item-modal/add-order-item-modal.component';
import { EditOrderItemModalComponent } from './components/edit-order-item-modal/edit-order-item-modal.component';
import { SupplyOrderHeaderComponent } from './components/supply-order-header/supply-order-header.component';
import { OrderItemsManagementComponent } from './components/order-items-management/order-items-management.component';
import { SupplyItemsListComponent } from './components/supply-items-list/supply-items-list.component';
import { OrderDto, OrderRequestItemDto } from '@models/order.model';
import { SupplyDto } from '@requests/services/supply.service';
import { ToastService } from '@services/toast.service';
import { APIOperationResponse } from '@models/api-response.model';
import { SupplyItemDisplay } from '@models/supply-order.model';
import { formatNumber as formatNumberUtil } from '@utils/format.utils';
import { BaseRequestDto, WorkflowApprovalStep } from '@models/workflow-approval.model';
import { LoadingStateComponent } from '@components/index';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
import { SupplyOrderDataService } from '@requests/services/supply-order-data.service';
import { getLocalizedOrderItemName, getSupplyItemDisplayName } from '@requests/utils/supply-order-format.utils';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { ConfigService } from '@services/config.service';
import { ErrorHandler } from '@utils/error-handler.utils';

@Component({
  selector: 'app-supply-order',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    ModalComponent,
    ConfirmDialogComponent,
    LoadingStateComponent,
    AddLotModalComponent,
    AddOrderItemModalComponent,
    EditOrderItemModalComponent,
    SupplyOrderHeaderComponent,
    OrderItemsManagementComponent,
    SupplyItemsListComponent
  ],
  templateUrl: './supply-order.component.html',
  styleUrls: ['./supply-order.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplyOrderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly PERMISSIONS = PERMISSIONS;
  readonly AlertTriangle = AlertTriangle;

  orderId: number = 0;
  supplyId: number = 0;
  orderData: OrderDto | null = null;
  supplyData: SupplyDto | null = null;

  loading: boolean = true;
  updatingItem: boolean = false;
  deletingItem: boolean = false;

  isAddLotModalOpen: boolean = false;

  isConfirmModalOpen: boolean = false;
  confirmModalTitle: string = '';
  confirmModalMessage: string = '';
  confirmModalAction: (() => void) | null = null;

  isAddItemModalOpen: boolean = false;
  isEditItemModalOpen: boolean = false;
  isRemoveItemModalOpen: boolean = false;
  selectedItemForEdit: OrderRequestItemDto | null = null;
  selectedItemForRemove: OrderRequestItemDto | null = null;

  orderItems: OrderRequestItemDto[] = [];
  approvalWorkflow: WorkflowApprovalStep[] = [];
  supplyItems: SupplyItemDisplay[] = [];
  baseRequestData: BaseRequestDto | null = null;

  isApprovalWorkflowExpanded: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private supplyOrderDataService: SupplyOrderDataService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
    private authService: BackendAuthService
  ) { }

  get canIncreaseQuantity(): boolean {
    return this.authService.hasPermission(PERMISSIONS.REQUESTS.ORDER.EDIT) && this.authService.hasPermission(PERMISSIONS.REQUESTS.ORDER.INCREASE_QUANTITY);
  }

  get canDecreaseQuantity(): boolean {
    return this.authService.hasPermission(PERMISSIONS.REQUESTS.ORDER.EDIT) && this.authService.hasPermission(PERMISSIONS.REQUESTS.ORDER.DECREASE_QUANTITY);
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['supplyId'];
    const receivedId = parseInt(idParam, 10);
    const byOrder = this.route.snapshot.queryParams['byOrder'] === 'true';

    if (isNaN(receivedId)) {
      this.showErrorToastKeys('supplyOrder.errors.invalidId', 'toast.error');
      this.router.navigate(['/requests/supply-order']);
      return;
    }

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


  private loadSupplyByOrderId(orderId: number): void {
    this.loading = true;
    this.orderId = orderId;

    this.supplyOrderDataService.loadSupplyByOrderId(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ supply, order, orderItems, supplyItems }: {
          supply: SupplyDto;
          order: OrderDto;
          orderItems: OrderRequestItemDto[];
          supplyItems: SupplyItemDisplay[];
        }) => {
          this.supplyId = supply.id;
          this.supplyData = supply;
          this.orderData = order;
          this.orderItems = orderItems;
          this.supplyItems = supplyItems;

          // Always load full order details to ensure nested objects (department, requester) are populated
          this.loadFullOrderDetails(orderId);

          this.loadApprovalWorkflow();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.showErrorToast(error, 'Failed to load supply for this order');
          this.loading = false;
          this.cdr.markForCheck();
          this.goBack();
        }
      });
  }

  private loadSupplyData(): void {
    this.loading = true;

    this.supplyOrderDataService.loadSupplyData(this.supplyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ supply, order, orderItems, supplyItems }: {
          supply: SupplyDto;
          order: OrderDto;
          orderItems: OrderRequestItemDto[];
          supplyItems: SupplyItemDisplay[];
        }) => {
          this.supplyData = supply;
          this.orderId = supply.orderId;
          this.orderData = order;
          this.orderItems = orderItems;
          this.supplyItems = supplyItems;

          // Always load full order details to ensure nested objects (department, requester) are populated
          this.loadFullOrderDetails(this.orderId);

          this.loadApprovalWorkflow();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.showErrorToast(error, 'Failed to load supply order');
          this.loading = false;
          this.cdr.markForCheck();
          this.goBack();
        }
      });
  }

  private loadFullOrderDetails(orderId: number): void {
    // This is now a backup/fallback call since we're loading full order details in the service
    // But we keep it to ensure data is always up-to-date
    this.supplyOrderDataService.loadFullOrderDetails(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (fullOrder: OrderDto) => {
          if (this.orderData) {
            // Merge nested objects (always update to ensure we have the latest)
            if (fullOrder.department) {
              this.orderData.department = fullOrder.department;
              // Always populate flat properties from nested object
              this.orderData.departmentNameEn = fullOrder.department.nameEn || this.orderData.departmentNameEn;
              this.orderData.departmentNameAr = fullOrder.department.nameAr || this.orderData.departmentNameAr;
            }

            if (fullOrder.requester) {
              this.orderData.requester = fullOrder.requester;
              // Always populate flat properties from nested object
              this.orderData.requesterName = fullOrder.requester.fullNameEN ||
                fullOrder.requester.fullNameAR ||
                fullOrder.requester.userName ||
                this.orderData.requesterName;
              this.orderData.requesterNameEn = fullOrder.requester.fullNameEN || this.orderData.requesterNameEn;
              this.orderData.requesterNameAr = fullOrder.requester.fullNameAR || this.orderData.requesterNameAr;
            }

            if (fullOrder.requestPurpose) {
              this.orderData.requestPurpose = fullOrder.requestPurpose;
              // Always populate flat properties from nested object
              this.orderData.requestPurposeNameEn = fullOrder.requestPurpose.nameEn || this.orderData.requestPurposeNameEn;
              this.orderData.requestPurposeNameAr = fullOrder.requestPurpose.nameAr || this.orderData.requestPurposeNameAr;
            }

            // Trigger change detection to update the UI
            this.cdr.markForCheck();
          }
        },
        error: (err: unknown) => {
          this.configService.logWarning('Failed to load full order details for department/requester info', err);
        }
      });
  }

  private loadApprovalWorkflow(): void {
    if (!this.orderId) {
      this.approvalWorkflow = [];
      return;
    }

    this.supplyOrderDataService.loadApprovalWorkflow(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ approvalWorkflow, baseRequestData }: {
          approvalWorkflow: WorkflowApprovalStep[];
          baseRequestData: BaseRequestDto | null;
        }) => {
          this.approvalWorkflow = approvalWorkflow;
          this.baseRequestData = baseRequestData;
          this.cdr.markForCheck();
        },
        error: () => {
          this.approvalWorkflow = [];
          this.baseRequestData = null;
          this.cdr.markForCheck();
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
      approverNameEn: this.baseRequestData?.requesterNameEn || this.orderData.requesterName,
      approverNameAr: this.baseRequestData?.requesterNameAr,
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
      this.router.navigate(['/requests/requests-management', this.orderId, 'workflow-approval']);
    } else {
      this.router.navigate(['/requests/supply-order']);
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
      this.showErrorToastKeys('supplyOrder.toast.supplyDataNotLoaded', 'toast.error');
      return;
    }

    // Clear previous errors
    item.quantityError = undefined;

    if (!item.quantity || item.quantity <= 0) {
      this.showFieldValidationToast(item, 'supplyOrder.toast.quantityMustBeGreaterThanZero');
      return;
    }

    const lotStr = String(item.lot ?? '').trim();
    if (!lotStr || lotStr.length > 64) {
      this.showErrorToastKeys('supplyOrder.toast.invalidLotNumber', 'toast.error');
      return;
    }

    if (!item.itemId || item.itemId <= 0) {
      this.showErrorToastKeys('supplyOrder.toast.invalidItem', 'toast.error');
      return;
    }

    // Validate that the new quantity doesn't exceed the requested quantity
    // Calculate what the new total supplied quantity would be
    const originalQuantity = item.originalQuantity || item.quantity;
    const currentTotalSupplied = item.totalSuppliedQuantity;
    const newTotalSupplied = currentTotalSupplied - originalQuantity + item.quantity;

    if (newTotalSupplied > item.requestedQuantity) {
      const maxAllowedQuantity = item.requestedQuantity - (currentTotalSupplied - originalQuantity);
      this.showMaxQuantityExceededToast(item, maxAllowedQuantity);
      return;
    }

    this.updatingItem = true;
    this.supplyOrderDataService.updateSupplyDetail(this.supplyId, item.supplyDetailId, {
      itemId: item.itemId,
      lot: lotStr,
      quantity: item.quantity,
      notes: item.notes || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccessToast('supplyOrder.toast.itemUpdatedSuccessfully', 'toast.success');
          item.isEditing = false;
          item.originalQuantity = undefined;
          item.quantityError = undefined;
          this.updatingItem = false;
          this.cdr.markForCheck();
          this.loadSupplyData();
        },
        error: (error: unknown) => {
          this.showErrorToast(error, 'Failed to update item');
          this.updatingItem = false;
          this.cdr.markForCheck();
          this.loadSupplyData();
        }
      });
  }

  /**
   * Open add lot modal
   */
  openAddLotModal(): void {
    this.isAddLotModalOpen = true;
  }

  /**
   * Close add lot modal
   */
  closeAddLotModal(): void {
    this.isAddLotModalOpen = false;
  }

  onLotAdded(): void {
    this.loadSupplyData();
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
    this.supplyOrderDataService.deleteSupplyDetail(this.supplyId, item.supplyDetailId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccessToastInterpolated(
            'supplyOrder.toast.itemRemovedFromSupply',
            'toast.success',
            msg => msg.replace('{{itemName}}', item.itemName)
          );
          this.deletingItem = false;
          this.cdr.markForCheck();
          this.loadSupplyData();
        },
        error: (error: unknown) => {
          this.showErrorToast(error, 'Failed to delete item');
          this.deletingItem = false;
          this.cdr.markForCheck();
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

  /**
   * Open add item modal
   */
  openAddOrderItemModal(): void {
    this.isAddItemModalOpen = true;
  }

  /**
   * Close add item modal
   */
  closeAddOrderItemModal(): void {
    this.isAddItemModalOpen = false;
  }

  /**
   * Open edit item modal
   */
  openEditOrderItemModal(item: OrderRequestItemDto): void {
    this.selectedItemForEdit = item;
    this.isEditItemModalOpen = true;
  }

  /**
   * Close edit item modal
   */
  closeEditOrderItemModal(): void {
    this.isEditItemModalOpen = false;
    this.selectedItemForEdit = null;
  }

  onOrderItemAdded(): void {
    this.loadSupplyData();
  }

  onOrderItemUpdated(): void {
    this.loadSupplyData();
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


  onConfirmRemoveOrderItem(): void {
    if (!this.selectedItemForRemove) return;

    this.supplyOrderDataService.deleteOrderItem(this.orderId, this.selectedItemForRemove.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<boolean>) => {
          if (response.succeeded) {
            this.showSuccessToast('supplyOrder.toast.itemRemovedSuccessfully', 'toast.success');
            this.closeRemoveOrderItemModal();
            this.loadSupplyData();
          } else {
            this.showErrorToastWithApiOrFallbackMessage(response.message, 'toast.failedToRemoveItem');
          }
        },
        error: (error: unknown) => {
          this.showErrorToast(error, 'Failed to remove item');
        }
      });
  }

  /**
   * Get localized display name for an order item (request item)
   */
  private getLocalizedOrderItemName(item: OrderRequestItemDto | null | undefined): string {
    return getLocalizedOrderItemName(item, this.translateService);
  }

  /**
   * Get localized name for a supply item display row
   */
  private getSupplyItemDisplayName(item: SupplyItemDisplay): string {
    return getSupplyItemDisplayName(item, this.translateService);
  }

  /**
   * Get total supplied quantity for an order item
   */
  getTotalSupplied(item: OrderRequestItemDto | null): number {
    if (!item || !this.supplyItems) return 0;
    // Sum up quantities of all lots for this item in the supply items list
    return this.supplyItems
      .filter(si => si.itemId === item.itemId)
      .reduce((sum, si) => sum + si.quantity, 0);
  }

  private showSuccessToast(messageKey: string, titleKey: string = 'toast.success'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.success(translations[messageKey], translations[titleKey]);
      });
  }

  private showSuccessToastInterpolated(
    messageKey: string,
    titleKey: string,
    format: (message: string) => string
  ): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.success(format(translations[messageKey]), translations[titleKey]);
      });
  }

  private showWarningToast(messageKey: string, titleKey: string = 'toast.warning'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.warning(translations[messageKey], translations[titleKey]);
      });
  }

  private showErrorToastKeys(messageKey: string, titleKey: string = 'toast.error'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(translations[messageKey], translations[titleKey]);
      });
  }

  private showFieldValidationToast(item: SupplyItemDisplay, messageKey: string): void {
    this.translateService
      .get([messageKey, 'toast.error'])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        item.quantityError = translations[messageKey];
        this.toastService.error(translations[messageKey], translations['toast.error']);
      });
  }

  private showMaxQuantityExceededToast(item: SupplyItemDisplay, maxAllowedQuantity: number): void {
    this.translateService
      .get(['supplyOrder.toast.maxQuantityExceeded', 'toast.error'])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        const errorMsg = translations['supplyOrder.toast.maxQuantityExceeded']
          .replace('{{maxQuantity}}', formatNumberUtil(maxAllowedQuantity))
          .replace('{{requestedQuantity}}', formatNumberUtil(item.requestedQuantity));
        item.quantityError = errorMsg;
        this.toastService.error(errorMsg, translations['toast.error']);
      });
  }

  private showErrorToast(error: unknown, defaultMsg: string): void {
    const msg = ErrorHandler.extractAndTranslateErrorMessage(error, defaultMsg, this.translateService);
    this.translateService
      .get('toast.error')
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(msg, translations['toast.error']);
      });
  }

  private showErrorToastWithApiOrFallbackMessage(apiMessage: string | undefined, fallbackKey: string): void {
    this.translateService
      .get(['toast.error', fallbackKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(apiMessage || translations[fallbackKey], translations['toast.error']);
      });
  }
}

