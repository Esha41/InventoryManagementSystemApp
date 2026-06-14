import { Component, DestroyRef, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  LucideAngularModule,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  AlertCircle
} from 'lucide-angular';
import { catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';

import { SupplyRequestDetailService } from './services/supply-request-detail.service';
import { SupplyRequestCatalogItemFacade } from './services/supply-request-catalog-item.facade';
import { SupplyRequestLotModalFacade } from './services/supply-request-lot-modal.facade';
import { LotSelectionService } from './services/lot-selection.service';
import { SupplyOrderDataService, AvailableCatalogItemDto } from '@requests/services/supply-order-data.service';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';

import { SupplyRequestDetail, OrderItem } from '@models/supply-request.model';
import { OrderDto, OrderRequestItemDto } from '@models/order.model';
import { CreateRequestItemDto } from '@models/request-item.model';

import { LotSelectionModalComponent } from './components/lot-selection-modal/lot-selection-modal.component';
import { DischargeSummaryCardComponent } from './components/discharge-summary-card/discharge-summary-card.component';
import { ItemManagementModalsComponent } from './components/item-management-modals/item-management-modals.component';
import { OrderItemsManagementComponent } from '@requests/pages/supply-order/components/order-items-management/order-items-management.component';
import { formatNumber as formatNumberUtil } from '@utils/format.utils';
import {
  getItemTypeIcon as getItemTypeIconUtil,
  getItemProductId as getItemProductIdUtil
} from '../utils/ui-helpers.utils';
import { LoadingStateComponent, ModalComponent, ButtonComponent } from '@components/index';
import { TranslationService } from '@services/translation.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { trackByKey } from '@utils/trackby.utils';
import { filterPartiallyFulfilledOrderItems } from './utils/supply-request-partial-fulfillment.util';
import { applyTempLotSelectionsToOrderItem } from './utils/supply-request-apply-lot-selections.util';
import {
  getItemStockAlertLevel,
  getProjectedRemainingQuantity
} from './utils/supply-request-stock-status.util';

@Component({
  selector: 'app-supply-request-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    LotSelectionModalComponent,
    DischargeSummaryCardComponent,
    ItemManagementModalsComponent,
    OrderItemsManagementComponent,
    LoadingStateComponent,
    ModalComponent,
    ButtonComponent
  ],
  templateUrl: './supply-request-detail.component.html',
  styleUrls: ['./supply-request-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplyRequestDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly PERMISSIONS = PERMISSIONS;

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly CheckCircle = CheckCircle;
  readonly AlertTriangle = AlertTriangle;
  readonly AlertCircle = AlertCircle;
  readonly Math = Math;
  readonly trackByRequestItemId = trackByKey('requestItemId');

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  orderId: number = 0;
  issueNo: string = '';
  requestDetail: SupplyRequestDetail | null = null;
  orderData: OrderDto | null = null;
  currentSupplyId: number | undefined = undefined;

  isOrderItemsManagementExpanded = true;
  isOrderItemsDischargeExpanded = true;

  loading = true;
  loadingSuggestion = false;
  processingDischarge = false;
  loadingAllLots = false;
  loadingManualLot = false;

  isLotModalOpen = false;
  selectedItem: OrderItem | null = null;
  tempLotSelections: Map<string, number> = new Map();
  showManualLotEntry = false;
  manualLotNumber = '';

  isAddItemModalOpen = false;
  isEditItemModalOpen = false;
  isRemoveItemModalOpen = false;
  selectedItemForEdit: OrderItem | null = null;
  selectedItemForRemove: OrderItem | null = null;
  availableItems: AvailableCatalogItemDto[] = [];
  loadingItems = false;
  savingItem = false;
  allowedItemTypes: number[] = [1, 3];

  showPartialFulfillmentConfirm = false;
  partiallyFulfilledItems: OrderItem[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supplyRequestDetailService: SupplyRequestDetailService,
    private catalogItemFacade: SupplyRequestCatalogItemFacade,
    private lotModalFacade: SupplyRequestLotModalFacade,
    private translationService: TranslationService,
    private lotSelectionService: LotSelectionService,
    private supplyOrderDataService: SupplyOrderDataService,
    private toastService: ToastService,
    private translate: TranslateService,
    private config: ConfigService,
    private cdr: ChangeDetectorRef,
    private authService: BackendAuthService
  ) {}

  get canIncreaseQuantity(): boolean {
    return this.authService.hasPermission(PERMISSIONS.REQUESTS.ORDER.EDIT) && this.authService.hasPermission(PERMISSIONS.REQUESTS.ORDER.INCREASE_QUANTITY);
  }

  get canDecreaseQuantity(): boolean {
    return this.authService.hasPermission(PERMISSIONS.REQUESTS.ORDER.EDIT) && this.authService.hasPermission(PERMISSIONS.REQUESTS.ORDER.DECREASE_QUANTITY);
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['id'];
    this.orderId = Number.parseInt(idParam, 10);
    if (Number.isNaN(this.orderId)) {
      const message = this.translate.instant('supplyRequestDetail.invalidOrderId');
      const title = this.translate.instant('toast.error');
      this.toastService.error(message, title);
      void this.router.navigate(['/requests/requests-management']);
      return;
    }
    this.loadRequestDetail();
  }

  loadRequestDetail(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.supplyRequestDetailService
      .loadRequestDetail(this.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.orderData = result.orderData;
          this.issueNo = result.issueNo;
          this.requestDetail = result.requestDetail;

          this.loading = false;
          this.cdr.markForCheck();
          this.loadSuggestionsAutomatically();
        },
        error: (error) => {
          this.config.logError('Failed to load order details', error);
          const message = this.translate.instant('supplyRequestDetail.failedToLoadOrderDetails');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          this.loading = false;
          this.cdr.markForCheck();
          this.goBack();
        }
      });
  }

  private loadSuggestionsAutomatically(): void {
    if (!this.orderData || !this.requestDetail) {
      return;
    }

    const detail = this.requestDetail;
    this.loadingSuggestion = true;
    this.cdr.markForCheck();

    this.supplyRequestDetailService
      .applyInitialSuggestionsToRequestDetail(this.orderId, detail)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ suggestion, existingSupply }) => {
          this.currentSupplyId = existingSupply?.id;
          this.loadingSuggestion = false;
          this.cdr.markForCheck();

          if (!suggestion.canFulfillCompletely && (suggestion.itemSuggestions?.length ?? 0) > 0) {
            const message = this.translate.instant('supplyRequestDetail.insufficientInventoryNote');
            const title = this.translate.instant('toast.warning');
            this.toastService.warning(message, title);
          }
        },
        error: (error) => {
          this.config.logError('Failed to load suggestions', error);
          this.loadingSuggestion = false;
          this.cdr.markForCheck();
          const message = this.translate.instant('supplyRequestDetail.failedToLoadSuggestions');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
        }
      });
  }

  goBack(): void {
    if (this.orderId) {
      void this.router.navigate(['/requests/requests-management', this.orderId, 'workflow-approval']);
    } else {
      void this.router.navigate(['/requests/requests-management']);
    }
  }

  openLotModal(item: OrderItem): void {
    this.selectedItem = item;
    this.tempLotSelections.clear();
    if (item.availableLots) {
      item.availableLots.forEach((lot) => {
        if (lot.selectedQuantity > 0) {
          this.tempLotSelections.set(String(lot.lotNumber), lot.selectedQuantity);
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
    if (!this.selectedItem) {
      return;
    }
    this.loadAvailableLotsForQuantity(this.selectedItem);
  }

  onShowAllLots(): void {
    if (!this.selectedItem) {
      return;
    }
    this.loadAllLotsForItem(this.selectedItem);
  }

  onAddLotManually(): void {
    this.showManualLotEntry = !this.showManualLotEntry;
    if (this.showManualLotEntry) {
      this.manualLotNumber = '';
    }
  }

  onGetManualLotDetails(lotNumber: string): void {
    if (!this.selectedItem) {
      return;
    }

    this.loadingManualLot = true;
    this.cdr.markForCheck();
    this.lotModalFacade
      .lookupManualLotByNumber(lotNumber, this.selectedItem)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loadingManualLot = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe();
  }

  private loadAvailableLotsForQuantity(item: OrderItem): void {
    this.loadingAllLots = true;
    this.cdr.markForCheck();
    this.lotModalFacade
      .loadAvailableLotsForQuantityIntoItem(item, this.tempLotSelections, this.currentSupplyId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loadingAllLots = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe();
  }

  private loadAllLotsForItem(item: OrderItem): void {
    this.loadingAllLots = true;
    this.cdr.markForCheck();
    this.lotModalFacade
      .loadAllLotsIntoItem(item, this.tempLotSelections)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loadingAllLots = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe();
  }

  onTempLotQuantityChange(event: { lotNumber: string; quantity: number }): void {
    if (event.quantity > 0) {
      this.tempLotSelections.set(String(event.lotNumber), event.quantity);
    } else {
      this.tempLotSelections.delete(String(event.lotNumber));
    }
  }

  onRemoveLot(lotNumber: string): void {
    if (!this.selectedItem) {
      return;
    }

    const removed = this.lotSelectionService.removeLotFromItem(this.selectedItem, lotNumber);
    if (removed) {
      this.tempLotSelections.delete(String(lotNumber));
      const message = this.translate.instant('supplyRequestDetail.lotRemovedFromList', {
        lotNumber: lotNumber
      });
      const title = this.translate.instant('toast.success');
      this.toastService.success(message, title);
    }
  }

  confirmLotSelection(selections: Map<string, number>): void {
    if (!this.selectedItem) {
      return;
    }
    applyTempLotSelectionsToOrderItem(this.selectedItem, selections);
    this.closeLotModal();
    this.cdr.markForCheck();
  }

  hasPartialFulfillment(): boolean {
    if (!this.requestDetail?.items) {
      return false;
    }
    this.partiallyFulfilledItems = filterPartiallyFulfilledOrderItems(this.requestDetail.items);
    return this.partiallyFulfilledItems.length > 0;
  }

  onProcessDischarge(): void {
    if (!this.requestDetail) {
      return;
    }

    if (this.hasPartialFulfillment()) {
      this.showPartialFulfillmentConfirm = true;
      return;
    }

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
    if (!this.requestDetail) {
      return;
    }

    this.processingDischarge = true;
    this.cdr.markForCheck();
    this.supplyRequestDetailService
      .processDischarge(this.orderId, this.requestDetail)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error) => {
          this.config.logError('Failed to process discharge', error);
          const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(
            error,
            this.translate.instant('supplyRequestDetail.failedToProcessDischarge'),
            this.translate
          );
          const title = this.translate.instant('toast.error');
          this.toastService.error(errorMessage, title);
          this.processingDischarge = false;
          this.cdr.markForCheck();
          return EMPTY;
        })
      )
      .subscribe({
        next: () => {
          this.processingDischarge = false;
          this.cdr.markForCheck();
        }
      });
  }

  onSuggestForAllItems(): void {
    if (!this.requestDetail) {
      return;
    }
    this.loadingSuggestion = true;
    this.cdr.markForCheck();
    this.supplyRequestDetailService
      .applyInteractiveSupplySuggestion(this.orderId, this.requestDetail)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loadingSuggestion = false;
          this.cdr.markForCheck();
        }),
        catchError((error) => {
          this.config.logError('Failed to load suggestions', error);
          const message = this.translate.instant('supplyRequestDetail.failedToLoadSuggestions');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          return EMPTY;
        })
      )
      .subscribe();
  }

  openAddItemModal(): void {
    this.allowedItemTypes = this.supplyRequestDetailService.getAllowedItemTypes(this.orderData, this.requestDetail);
    if (this.config.isDebugMode) {
      this.config.log(`Allowed item types: ${JSON.stringify(this.allowedItemTypes)}`);
    }
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
    const existingItemIds = (this.requestDetail?.items || []).map((item) => item.itemId);

    const allowedTypes = this.allowedItemTypes;

    this.supplyOrderDataService
      .loadAvailableItems(existingItemIds, allowedTypes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.availableItems = items || [];
          this.loadingItems = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.config.logError('Failed to load items', error);
          const message = this.translate.instant('supplyRequestDetail.failedToLoadItems');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          this.loadingItems = false;
          this.cdr.markForCheck();
        }
      });
  }

  onSaveAddItem(itemDto: CreateRequestItemDto): void {
    this.savingItem = true;
    this.cdr.markForCheck();
    this.catalogItemFacade
      .addCatalogItem(this.orderId, itemDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.savingItem = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((outcome) => {
        if (outcome === 'success') {
          this.closeAddItemModal();
          setTimeout(() => {
            this.loadRequestDetail();
          }, 300);
        }
      });
  }

  onSaveEditItem(data: { requestItemId: number; quantity: number }): void {
    this.savingItem = true;
    this.cdr.markForCheck();
    this.catalogItemFacade
      .updateItemQuantity(this.orderId, data.requestItemId, data.quantity)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.savingItem = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((outcome) => {
        if (outcome === 'success') {
          this.closeEditItemModal();
          this.loadRequestDetail();
        }
      });
  }

  onConfirmRemoveItem(requestItemId: number): void {
    this.catalogItemFacade
      .removeItem(this.orderId, requestItemId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((outcome) => {
        if (outcome === 'success') {
          this.closeRemoveItemModal();
          this.loadRequestDetail();
        }
        this.cdr.markForCheck();
      });
  }

  getItemTypeIcon(type: string): any {
    return getItemTypeIconUtil(type);
  }

  formatNumber(num: number): string {
    return formatNumberUtil(num);
  }

  getItemStockAlertLevel(item: OrderItem): 'critical' | 'low' | null {
    return getItemStockAlertLevel(item);
  }

  getProjectedRemainingQuantity(item: OrderItem): number | null {
    return getProjectedRemainingQuantity(item);
  }

  getItemProductId(item: OrderItem): string {
    return getItemProductIdUtil(item, this.orderData);
  }

  /** Rows for the management table (maps approved qty → order line quantity). */
  get orderItemsForManagement(): OrderRequestItemDto[] {
    const items = this.requestDetail?.items ?? [];
    return items.map((item) => {
      const orderLine = this.orderData?.requestItems?.find((ri) => ri.id === item.requestItemId);
      return {
        id: item.requestItemId,
        itemId: item.itemId,
        quantity: item.approvedQuantity,
        requestId: this.orderId,
        itemName: item.itemName,
        itemNo: orderLine?.itemNo,
        notes: orderLine?.notes
      } as OrderRequestItemDto;
    });
  }

  onManagementEditItem(row: OrderRequestItemDto): void {
    const item = this.requestDetail?.items.find((i) => i.requestItemId === row.id);
    if (item) {
      this.openEditItemModal(item);
    }
  }

  onManagementRemoveItem(row: OrderRequestItemDto): void {
    const item = this.requestDetail?.items.find((i) => i.requestItemId === row.id);
    if (item) {
      this.openRemoveItemModal(item);
    }
  }
}
