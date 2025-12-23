import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Plus, CheckCircle, AlertTriangle, Package, Clock } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Services
import { SupplyRequestDetailService } from './services/supply-request-detail.service';
import { OrderItemManagementService } from './services/order-item-management.service';
import { LotSelectionService } from './services/lot-selection.service';
import { AmmunitionService } from '@services/ammunition.service';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';

// Models
import { SupplyRequestDetail, OrderItem } from '@models/supply-request.model';
import { OrderDto, CreateUpdateRequestItemDto } from '@services/order.service';

// Components
import { LotSelectionModalComponent } from './components/lot-selection-modal/lot-selection-modal.component';
import { DischargeSummaryCardComponent } from './components/discharge-summary-card/discharge-summary-card.component';
import { ItemManagementModalsComponent } from './components/item-management-modals/item-management-modals.component';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

// Utils
import { formatNumber as formatNumberUtil, formatDate as formatDateUtil } from '@utils/format.utils';
import { getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import {
  getLotConditionClass,
  getApprovalStatusIcon as getApprovalStatusIconUtil,
  getItemTypeIcon as getItemTypeIconUtil,
  getDepartmentName as getDepartmentNameUtil,
  getItemProductId as getItemProductIdUtil
} from '../utils/ui-helpers.utils';
import { LoadingStateComponent, ModalComponent, ButtonComponent } from '@components/index';
import { TranslationService } from '@services/translation.service';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';

@Component({
  selector: 'app-supply-request-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    HasPermissionDirective,
    LotSelectionModalComponent,
    DischargeSummaryCardComponent,
    ItemManagementModalsComponent,
    LoadingStateComponent,
    ModalComponent,
    ButtonComponent
  ],
  templateUrl: './supply-request-detail.component.html',
  styleUrls: ['./supply-request-detail.component.css']
})
export class SupplyRequestDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Icons
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Plus = Plus;
  readonly CheckCircle = CheckCircle;
  readonly AlertTriangle = AlertTriangle;
  readonly Package = Package;
  readonly Clock = Clock;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  // State
  orderId: number = 0;
  issueNo: string = '';
  requestDetail: SupplyRequestDetail | null = null;
  orderData: OrderDto | null = null;

  // UI State
  isRequestInfoExpanded: boolean = true;
  isApprovalWorkflowExpanded: boolean = true;
  isOrderItemsExpanded: boolean = true;

  // Loading States
  loading: boolean = true;
  loadingSuggestion: boolean = false;
  processingDischarge: boolean = false;
  loadingAllLots: boolean = false;
  loadingManualLot: boolean = false;

  // Lot Selection Modal
  isLotModalOpen: boolean = false;
  selectedItem: OrderItem | null = null;
  tempLotSelections: Map<number, number> = new Map();
  showManualLotEntry: boolean = false;
  manualLotNumber: string = '';

  // Item Management
  isAddItemModalOpen: boolean = false;
  isEditItemModalOpen: boolean = false;
  isRemoveItemModalOpen: boolean = false;
  selectedItemForEdit: OrderItem | null = null;
  selectedItemForRemove: OrderItem | null = null;
  availableItems: any[] = [];
  loadingItems: boolean = false;
  savingItem: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supplyRequestDetailService: SupplyRequestDetailService,
    private orderItemManagementService: OrderItemManagementService,
    private translationService: TranslationService,
    private lotSelectionService: LotSelectionService,
    private ammunitionService: AmmunitionService,
    private toastService: ToastService,
    private translate: TranslateService,
    private config: ConfigService
  ) { }

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['id'];
    this.orderId = parseInt(idParam, 10);
    if (isNaN(this.orderId)) {
      const message = this.translate.instant('supplyRequestDetail.invalidOrderId');
      const title = this.translate.instant('toast.error');
      this.toastService.error(message, title);
      this.router.navigate(['/requests-management']);
      return;
    }
    this.loadRequestDetail();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== DATA LOADING ====================

  loadRequestDetail(): void {
    this.loading = true;

    this.supplyRequestDetailService.loadRequestDetail(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.orderData = result.orderData;
          this.issueNo = result.issueNo;
          this.requestDetail = result.requestDetail;

          // Load approval history
          this.supplyRequestDetailService.loadApprovalHistory(this.orderId, this.requestDetail)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (updatedDetail) => {
                this.requestDetail = updatedDetail;
              }
            });

          this.loading = false;
          this.loadSuggestionsAutomatically();
        },
        error: (error) => {
          this.config.logError('Failed to load order details', error);
          const message = this.translate.instant('supplyRequestDetail.failedToLoadOrderDetails');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          this.loading = false;
          this.goBack();
        }
      });
  }

  private loadSuggestionsAutomatically(): void {
    if (!this.orderData || !this.requestDetail) {
      return;
    }

    this.loadingSuggestion = true;

    this.supplyRequestDetailService.loadSuggestionsWithDraftCheck(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ suggestion, existingSupply }) => {
          if (!this.requestDetail) {
            this.loadingSuggestion = false;
            return;
          }

          const hasEmptySuggestions = !suggestion.itemSuggestions || suggestion.itemSuggestions.length === 0;
          const hasExistingSupply = existingSupply && existingSupply.supplyDetails && existingSupply.supplyDetails.length > 0;

          if (hasEmptySuggestions && hasExistingSupply) {
            this.supplyRequestDetailService.loadLotsForExistingSelections(
              this.requestDetail,
              existingSupply.supplyDetails
            ).pipe(takeUntil(this.destroy$)).subscribe();
          } else {
            this.supplyRequestDetailService.applySuggestions(this.requestDetail, suggestion);

            if (existingSupply && existingSupply.supplyDetails) {
              const { restoredCount, notFoundCount } = this.supplyRequestDetailService.restoreExistingSelections(
                this.requestDetail,
                existingSupply.supplyDetails
              );

              if (notFoundCount > 0) {
                this.config.log(`${notFoundCount} previously selected lots are no longer available`);
              }
            }
          }

          this.loadingSuggestion = false;

          if (!suggestion.canFulfillCompletely && !hasEmptySuggestions) {
            const message = this.translate.instant('supplyRequestDetail.insufficientInventoryNote');
            const title = this.translate.instant('toast.warning');
            this.toastService.warning(message, title);
          }
        },
        error: (error) => {
          this.config.logError('Failed to load suggestions', error);
          this.loadingSuggestion = false;
          const message = this.translate.instant('supplyRequestDetail.failedToLoadSuggestions');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
        }
      });
  }

  goBack(): void {
    if (this.orderId) {
      this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
    } else {
      this.router.navigate(['/requests-management']);
    }
  }

  // ==================== LOT SELECTION MODAL ====================

  openLotModal(item: OrderItem): void {
    this.selectedItem = item;
    this.tempLotSelections.clear();
    if (item.availableLots) {
      item.availableLots.forEach(lot => {
        if (lot.selectedQuantity > 0) {
          this.tempLotSelections.set(lot.lotNumber, lot.selectedQuantity);
        }
      });
    }
    this.isLotModalOpen = true;
  }

  closeLotModal(): void {
    this.isLotModalOpen = false;
    this.selectedItem = null;
    this.tempLotSelections.clear();
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
  }

  onShowAvailableLots(): void {
    if (!this.selectedItem) return;
    this.loadAvailableLotsForQuantity(this.selectedItem);
  }

  onAddLotManually(): void {
    this.showManualLotEntry = !this.showManualLotEntry;
    if (this.showManualLotEntry) {
      this.manualLotNumber = '';
    }
  }

  onGetManualLotDetails(lotNumber: string): void {
    if (!this.selectedItem) return;

    const validation = this.lotSelectionService.validateLotNumber(lotNumber);
    if (!validation.isValid) {
      const title = validation.error?.includes('invalid')
        ? this.translate.instant('toast.error')
        : this.translate.instant('toast.warning');
      this.toastService.warning(validation.error!, title);
      return;
    }

    this.loadingManualLot = true;
    this.lotSelectionService.getLotByNumberAndValidate(validation.parsedNumber!, this.selectedItem)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ lot, isValid, error }) => {
          if (!isValid) {
            const title = error?.includes('different')
              ? this.translate.instant('toast.error')
              : this.translate.instant('toast.warning');
            this.toastService.warning(error!, title);
            this.loadingManualLot = false;
            return;
          }

          const newLot = this.lotSelectionService.convertLotDetailToLotItem(lot);
          this.lotSelectionService.addLotToItem(this.selectedItem!, newLot);

          const message = this.translate.instant('supplyRequestDetail.lotAddedSuccessfully', {
            lotNumber: validation.parsedNumber
          });
          const title = this.translate.instant('toast.success');
          this.toastService.success(message, title);
          this.loadingManualLot = false;
        },
        error: (error) => {
          this.config.logError('Failed to load lot details', error);
          const message = this.translate.instant('supplyRequestDetail.lotNotFoundOrError');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          this.loadingManualLot = false;
        }
      });
  }

  private loadAvailableLotsForQuantity(item: OrderItem): void {
    this.loadingAllLots = true;
    const currentSelections = new Map(this.tempLotSelections);

    this.lotSelectionService.loadAvailableLotsForQuantity(item, currentSelections)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          item.availableLots = result.lots;
          this.loadingAllLots = false;

          if (item.availableLots.length > 0) {
            const message = this.translate.instant('supplyRequestDetail.loadedAvailableLots', {
              count: item.availableLots.length,
              quantity: item.approvedQuantity
            });
            const title = this.translate.instant('toast.success');
            this.toastService.success(message, title);
          } else {
            const message = this.translate.instant('supplyRequestDetail.noAvailableLotsFound');
            const title = this.translate.instant('toast.warning');
            this.toastService.warning(message, title);
          }
        },
        error: (error) => {
          this.config.logError('Failed to load available lots', error);
          const message = this.translate.instant('supplyRequestDetail.failedToLoadAvailableLots');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          this.loadingAllLots = false;
        }
      });
  }

  onTempLotQuantityChange(event: { lotNumber: number; quantity: number }): void {
    if (event.quantity > 0) {
      this.tempLotSelections.set(event.lotNumber, event.quantity);
    } else {
      this.tempLotSelections.delete(event.lotNumber);
    }
  }

  onRemoveLot(lotNumber: number): void {
    if (!this.selectedItem) return;

    const removed = this.lotSelectionService.removeLotFromItem(this.selectedItem, lotNumber);
    if (removed) {
      this.tempLotSelections.delete(lotNumber);
      const message = this.translate.instant('supplyRequestDetail.lotRemovedFromList', {
        lotNumber: lotNumber
      });
      const title = this.translate.instant('toast.success');
      this.toastService.success(message, title);
    }
  }

  confirmLotSelection(selections: Map<number, number>): void {
    if (!this.selectedItem) return;

    this.selectedItem.availableLots.forEach(lot => {
      lot.selectedQuantity = selections.get(lot.lotNumber) || 0;
    });

    this.selectedItem.totalSelectedForDischarge = this.selectedItem.availableLots
      .reduce((sum, lot) => sum + lot.selectedQuantity, 0);

    this.closeLotModal();
  }

  // ==================== DISCHARGE PROCESSING ====================

  // Partial fulfillment confirmation modal state
  showPartialFulfillmentConfirm: boolean = false;
  partiallyFulfilledItems: OrderItem[] = [];

  /**
   * Check if there are any items with partial fulfillment
   */
  hasPartialFulfillment(): boolean {
    if (!this.requestDetail?.items) return false;

    this.partiallyFulfilledItems = this.requestDetail.items.filter(item =>
      item.totalSelectedForDischarge > 0 &&
      item.totalSelectedForDischarge < item.approvedQuantity
    );

    return this.partiallyFulfilledItems.length > 0;
  }

  onProcessDischarge(): void {
    if (!this.requestDetail) return;

    // Check for partial fulfillment
    if (this.hasPartialFulfillment()) {
      this.showPartialFulfillmentConfirm = true;
      return;
    }

    // No partial fulfillment, proceed directly
    this.proceedWithDischarge();
  }

  onConfirmPartialFulfillment(): void {
    this.showPartialFulfillmentConfirm = false;
    this.proceedWithDischarge();
  }

  onCancelPartialFulfillment(): void {
    this.showPartialFulfillmentConfirm = false;
    this.partiallyFulfilledItems = [];
  }

  private proceedWithDischarge(): void {
    if (!this.requestDetail) return;

    this.processingDischarge = true;
    this.supplyRequestDetailService.processDischarge(this.orderId, this.requestDetail)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.config.logError('Failed to process discharge', error);
          const errorMessage = error?.error?.message || error?.message || this.translate.instant('supplyRequestDetail.failedToProcessDischarge');
          const title = this.translate.instant('toast.error');
          this.toastService.error(errorMessage, title);
          this.processingDischarge = false;
          return [];
        })
      )
      .subscribe({
        next: () => {
          this.processingDischarge = false;
        }
      });
  }

  onSuggestForAllItems(): void {
    this.loadingSuggestion = true;
    this.supplyRequestDetailService.getSupplySuggestion(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suggestion) => {
          if (this.requestDetail) {
            this.supplyRequestDetailService.applySuggestions(this.requestDetail, suggestion);
          }
          this.loadingSuggestion = false;

          if (suggestion.canFulfillCompletely) {
            const message = this.translate.instant('supplyRequestDetail.suggestionsLoadedAllFulfilled');
            const title = this.translate.instant('toast.success');
            this.toastService.success(message, title);
          } else {
            const message = this.translate.instant('supplyRequestDetail.suggestionsLoadedInsufficient');
            const title = this.translate.instant('toast.warning');
            this.toastService.warning(message, title);
          }
        },
        error: (error) => {
          this.config.logError('Failed to load suggestions', error);
          const message = this.translate.instant('supplyRequestDetail.failedToLoadSuggestions');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          this.loadingSuggestion = false;
        }
      });
  }

  // ==================== ITEM MANAGEMENT ====================

  openAddItemModal(): void {
    this.loadAvailableItems();
    this.isAddItemModalOpen = true;
  }

  closeAddItemModal(): void {
    this.isAddItemModalOpen = false;
  }

  openEditItemModal(item: OrderItem): void {
    this.selectedItemForEdit = item;
    this.isEditItemModalOpen = true;
  }

  closeEditItemModal(): void {
    this.isEditItemModalOpen = false;
    this.selectedItemForEdit = null;
  }

  openRemoveItemModal(item: OrderItem): void {
    this.selectedItemForRemove = item;
    this.isRemoveItemModalOpen = true;
  }

  closeRemoveItemModal(): void {
    this.isRemoveItemModalOpen = false;
    this.selectedItemForRemove = null;
  }

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
          this.config.logError('Failed to load items', error);
          const message = this.translate.instant('supplyRequestDetail.failedToLoadItems');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          this.loadingItems = false;
        }
      });
  }

  onSaveAddItem(itemDto: CreateUpdateRequestItemDto): void {
    this.savingItem = true;
    this.orderItemManagementService.addItem(this.orderId, itemDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.orderItemManagementService.showSuccessMessage('supplyRequestDetail.itemAddedSuccessfully');
            this.closeAddItemModal();
            setTimeout(() => {
              this.loadRequestDetail();
            }, 300);
          } else {
            this.orderItemManagementService.showErrorMessage(
              'supplyRequestDetail.failedToAddItem',
              response.message
            );
          }
          this.savingItem = false;
        },
        error: (error) => {
          this.config.logError('Failed to add item', error);
          this.orderItemManagementService.showErrorMessage('supplyRequestDetail.failedToAddItem');
          this.savingItem = false;
        }
      });
  }

  onSaveEditItem(data: { requestItemId: number; quantity: number }): void {
    this.savingItem = true;
    this.orderItemManagementService.updateItemQuantity(this.orderId, data.requestItemId, data.quantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.orderItemManagementService.showSuccessMessage('supplyRequestDetail.itemQuantityUpdatedSuccessfully');
            this.closeEditItemModal();
            this.loadRequestDetail();
          } else {
            this.orderItemManagementService.showErrorMessage(
              'supplyRequestDetail.failedToUpdateItemQuantity',
              response.message
            );
          }
          this.savingItem = false;
        },
        error: (error) => {
          this.config.logError('Failed to update item quantity', error);
          this.orderItemManagementService.showErrorMessage('supplyRequestDetail.failedToUpdateItemQuantity');
          this.savingItem = false;
        }
      });
  }

  onConfirmRemoveItem(requestItemId: number): void {
    this.orderItemManagementService.removeItem(this.orderId, requestItemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.orderItemManagementService.showSuccessMessage('supplyRequestDetail.itemRemovedSuccessfully');
            this.closeRemoveItemModal();
            this.loadRequestDetail();
          } else {
            this.orderItemManagementService.showErrorMessage(
              'supplyRequestDetail.failedToRemoveItem',
              response.message
            );
          }
        },
        error: (error) => {
          this.config.logError('Failed to remove item', error);
          this.orderItemManagementService.showErrorMessage('supplyRequestDetail.failedToRemoveItem');
        }
      });
  }

  // ==================== UI HELPER METHODS ====================

  getApprovalStatusIcon(status: string): any {
    return getApprovalStatusIconUtil(status);
  }

  getApprovalStatusClass(status: string): string {
    return getApprovalStatusBadgeClass(status);
  }

  getLotConditionClass(condition: string): string {
    return getLotConditionClass(condition);
  }

  getItemTypeIcon(type: string): any {
    return getItemTypeIconUtil(type);
  }

  formatDate(date: Date | string | undefined): string {
    return formatDateUtil(date);
  }

  formatNumber(num: number): string {
    return formatNumberUtil(num);
  }

  getDepartmentName(): string {
    return getDepartmentNameUtil(this.orderData);
  }

  getItemProductId(item: OrderItem): string {
    return getItemProductIdUtil(item, this.orderData);
  }

  /**
   * Get localized approver name based on current language
   */
  getApproverName(approval: any): string {
    const currentLang = getCurrentLang(this.translate);

    // Check if this is a WorkflowApprovalStep (has applicationRoleName) or ApprovalStep (has militaryRank)
    // For pending steps, use role name (not user name)
    if (approval.isPending) {
      if (currentLang === 'ar' && approval.applicationRoleNameAr) {
        return approval.applicationRoleNameAr;
      } else if (approval.applicationRoleName) {
        return approval.applicationRoleName;
      }
    }

    // For completed steps, use user name
    // Check for Arabic name first
    if (currentLang === 'ar' && approval.approverNameAr) {
      return approval.approverNameAr;
    } else if (approval.approverNameEn) {
      return approval.approverNameEn;
    } else if (approval.approverName) {
      return approval.approverName;
    }

    // Fallback: if no name found, return empty string
    return '';
  }

  /**
   * Resolve usage purpose with proper localization
   */
  resolveUsagePurpose(): string {
    if (!this.orderData) {
      return 'N/A';
    }
    const currentLang = getCurrentLang(this.translate);

    // Try nested object first (current backend structure)
    if (this.orderData.requestPurpose) {
      return getLocalizedName(
        {
          nameEn: this.orderData.requestPurpose.nameEn,
          nameAr: this.orderData.requestPurpose.nameAr
        },
        currentLang
      ) || this.orderData.usagePurpose || 'N/A';
    }

    // Fallback to flattened properties
    return getLocalizedName(
      {
        nameEn: this.orderData.requestPurposeNameEn,
        nameAr: this.orderData.requestPurposeNameAr
      },
      currentLang
    ) || this.orderData.usagePurpose || 'N/A';
  }

  /**
   * Resolve department name with proper localization
   */
  resolveDepartmentName(): string {
    if (!this.orderData) return 'N/A';
    const currentLang = getCurrentLang(this.translate);

    // Use nested department object if available (for proper localization)
    if (this.orderData.department) {
      const localized = getLocalizedName(this.orderData.department, currentLang);
      if (localized) return localized;
    }

    // Fallback to flattened properties
    if (this.orderData.departmentNameEn || this.orderData.departmentNameAr) {
      const localized = getLocalizedName(
        {
          nameEn: this.orderData.departmentNameEn,
          nameAr: this.orderData.departmentNameAr
        },
        currentLang
      );
      if (localized) return localized;
    }

    return 'N/A';
  }

  /**
   * Resolve requester name with proper localization
   */
  resolveRequesterName(): string {
    if (!this.orderData) return 'N/A';
    const currentLang = getCurrentLang(this.translate);

    // Use nested requester object if available (for proper localization)
    if (this.orderData.requester) {
      const localized = getLocalizedName(this.orderData.requester, currentLang);
      if (localized) return localized;
      if (this.orderData.requester.userName) return this.orderData.requester.userName;
    }

    // Fallback to flattened property
    if (this.orderData.requesterName) return this.orderData.requesterName;

    return 'N/A';
  }
}

