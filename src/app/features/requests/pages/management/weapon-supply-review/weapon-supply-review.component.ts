import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Package, Clock, User, Shield, FileText, Warehouse, Building2, Users, ClipboardList, Check, X, Search, Info } from 'lucide-angular';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AssetSupplyService, OrderAssetsToSupplyDto } from '@services/asset-supply.service';
import { AssetService } from '@services/asset.service';
import { OrderService } from '@services/order.service';
import { OrderDto } from '@models/order.model';
import { LookupItem } from '@services/lookup.service';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslationService } from '@services/translation.service';
import { WeaponSupplyReviewService, ItemWithAssets, ReceiverInfo } from './services/weapon-supply-review.service';
import { WeaponSupplyUIService } from './services/weapon-supply-ui.service';
import { WeaponSupplyLookupService } from './services/weapon-supply-lookup.service';
import { WeaponSupplyDisplayService } from './services/weapon-supply-display.service';
import { SelectedAsset } from './services/asset-selection.service';

import { LoadingStateComponent } from '@components/loading-state/loading-state.component';
import { ItemAssetSelectionComponent } from './components/item-asset-selection/item-asset-selection.component';
import { EmployeeFormModalComponent } from '@components/employee-form-modal/employee-form-modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { BatchService } from '@services/batch.service';

export interface SavedSelectionDepot {
  id: number;
  name: string;
}

export interface SavedSelectionBatch {
  id: number;
  batchNumber: string;
  depotName: string;
}

export interface SavedSelectionTableRow {
  depotId: number;
  depotName: string;
  batchId: number;
  batchNumber: string;
  itemId: number;
  itemName: string;
  quantity: number;
}

@Component({
  selector: 'app-weapon-supply-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ItemAssetSelectionComponent,
    EmployeeFormModalComponent,
    DropdownComponent
  ],
  providers: [
    WeaponSupplyReviewService,
    WeaponSupplyUIService,
    WeaponSupplyLookupService,
    WeaponSupplyDisplayService
  ],
  templateUrl: './weapon-supply-review.component.html',
  styleUrls: ['./weapon-supply-review.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponSupplyReviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly CheckCircle = CheckCircle;
  readonly AlertTriangle = AlertTriangle;
  readonly Package = Package;
  readonly Clock = Clock;
  readonly User = User;
  readonly Shield = Shield;
  readonly FileText = FileText;
  readonly Warehouse = Warehouse;
  readonly Building2 = Building2;
  readonly Users = Users;
  readonly ClipboardList = ClipboardList;
  readonly Check = Check;
  readonly X = X;
  readonly Search = Search;
  readonly Info = Info;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon(): typeof ArrowRight | typeof ArrowLeft {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  orderId: number = 0;
  orderData: OrderDto | null = null;
  assetsData: OrderAssetsToSupplyDto | null = null;
  itemsWithAssets: ItemWithAssets[] = [];

  isRequestInfoExpanded: boolean = true;
  isItemsExpanded: boolean = true;
  isReceiverInfoExpanded: boolean = true;
  isSelectionSummaryExpanded: boolean = true;
  scanSubject = new Subject<string>();

  loading: boolean = true;
  loadingAssets: boolean = false;
  submitting: boolean = false;

  receiverName: string = '';
  receiverMilitaryId: string = '';
  receiverRankId: number | undefined = undefined;
  location: string = '';
  expectedReturnDate: string = '';
  notes: string = '';

  hasSavedSelection: boolean = false;
  /** True when user can load assets (depot selection or batch number typed) */
  get hasSelectionOrBatchNumber(): boolean {
    return this.hasSavedSelection || !!this.batchFilterBatchNumber?.trim();
  }
  /** True after assets have been loaded at least once */
  assetsLoadedOnce: boolean = false;
  savedSelectionDepots: SavedSelectionDepot[] = [];
  savedSelectionBatches: SavedSelectionBatch[] = [];
  savedSelectionTableRows: SavedSelectionTableRow[] = [];
  isEmployeeModalOpen: boolean = false;
  private savedDepotIds: number[] = [];
  private savedBatchIds: number[] = [];
  /** Per-batch quantity limits from the selection page */
  private savedBatchQuantities: Map<number, number | null> = new Map();

  /** Batch API filter options */
  batchFilterBatchNumber: string = '';
  batchFilterSerialNumberOnly: boolean = false;
  batchFilterByIsAssigned: boolean | null = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private assetSupplyService: AssetSupplyService,
    private assetService: AssetService,
    private orderService: OrderService,
    private translationService: TranslationService,
    private toastService: ToastService,
    public translate: TranslateService,
    private config: ConfigService,
    public reviewService: WeaponSupplyReviewService,
    public uiService: WeaponSupplyUIService,
    public lookupService: WeaponSupplyLookupService,
    public displayService: WeaponSupplyDisplayService,
    private batchService: BatchService,
    private cdr: ChangeDetectorRef
  ) { }

  get defaultCustodianId(): number | undefined {
    return this.reviewService.defaultCustodianId;
  }

  get ranks(): LookupItem[] {
    return this.lookupService.ranks;
  }

  get rankDropdownOptions(): DropdownOption<number>[] {
    return this.lookupService.rankDropdownOptions;
  }

  get employeeDropdownOptions(): DropdownOption<number>[] {
    return this.lookupService.employeeDropdownOptions;
  }

  get availableDepots(): LookupItem[] {
    return this.lookupService.availableDepots;
  }

  get depotDropdownOptions(): DropdownOption<number>[] {
    return this.lookupService.depotDropdownOptions;
  }

  get currentPage(): number {
    return this.uiService.currentPage;
  }

  get pageSize(): number {
    return this.uiService.pageSize;
  }

  get loadingEmployees(): boolean {
    return this.loading;
  }

  get loadingRanks(): boolean {
    return this.loading;
  }

  get loadingDepots(): boolean {
    return this.loading;
  }

  get itemSearchTerm(): string {
    return this.uiService.searchTerm;
  }

  ngOnInit(): void {
    this.initializeRoute();
    this.loadAllData();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeRoute(): void {
    const idParam = this.route.snapshot.params['id'];
    this.orderId = parseInt(idParam, 10);

    if (isNaN(this.orderId)) {
      this.toastService.error(
        this.translate.instant('weaponSupplyReview.invalidOrderId'),
        this.translate.instant('toast.error')
      );
      this.router.navigate(['/requests-management']);
    }
  }

  private loadAllData(): void {
    this.loading = true;
    this.cdr.markForCheck();

    forkJoin({
      order: this.orderService.getOrderById(this.orderId),
      depots: this.lookupService.loadDepots(),
      employees: this.lookupService.loadEmployees(),
      ranks: this.lookupService.loadRanks()
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ order }) => {
          this.orderData = order;
          this.reviewService.initializeItemsFromOrder(order);
          this.loading = false;
          this.cdr.markForCheck();

          this.loadSavedSelection();
        },
        error: (error) => {
          this.handleError('Failed to load data', error, 'weaponSupplyReview.failedToLoadOrderDetails');
          this.loading = false;
          this.cdr.markForCheck();
          this.goBack();
        }
      });
  }

  private loadSavedSelection(): void {
    this.assetSupplyService.getWeaponSupplySelection(this.orderId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null)),
        switchMap((selections) => {
          if (!selections || selections.length === 0) return of(null);

          const uniqueDepotIds = [...new Set(selections.map(s => s.depotId))];
          const uniqueBatchIds = [...new Set(selections.map(s => s.batchId))];

          this.savedBatchQuantities.clear();
          selections.forEach(s => {
            const prev = this.savedBatchQuantities.get(s.batchId) ?? 0;
            this.savedBatchQuantities.set(s.batchId, (prev || 0) + s.quantity);
          });

          const itemNameMap = new Map<number, string>();
          const reqItems = this.orderData?.requestItems ?? [];
          reqItems.forEach((ri: { itemId?: number; itemName?: string }) => {
            if (ri.itemId != null) itemNameMap.set(ri.itemId, ri.itemName ?? `Item ${ri.itemId}`);
          });

          return forkJoin(
            uniqueBatchIds.map(id => this.batchService.getById(id).pipe(catchError(() => of(null))))
          ).pipe(
            switchMap((batches) => {
              const batchMap = new Map<number, string>();
              uniqueBatchIds.forEach((id, i) => {
                batchMap.set(id, batches[i]?.batchNumber ?? String(id));
              });

              this.savedSelectionTableRows = selections.map(s => ({
                depotId: s.depotId,
                depotName: this.lookupService.getDepotDisplayName(s.depotId),
                batchId: s.batchId,
                batchNumber: batchMap.get(s.batchId) ?? String(s.batchId),
                itemId: s.itemId,
                itemName: itemNameMap.get(s.itemId) ?? `Item ${s.itemId}`,
                quantity: s.quantity
              }));

              this.savedDepotIds = uniqueDepotIds;
              this.savedBatchIds = uniqueBatchIds;
              this.savedSelectionDepots = uniqueDepotIds.map(id => ({ id, name: this.lookupService.getDepotDisplayName(id) }));
              this.hasSavedSelection = true;
              this.cdr.markForCheck();
              return of(selections);
            })
          );
        })
      )
      .subscribe({
        next: (selections) => {
          if (selections && selections.length > 0) {
            this.hasSavedSelection = true;
            this.cdr.markForCheck();
            this.loadAssetsFromSavedSelection();
          } else {
            this.hasSavedSelection = false;
            this.cdr.markForCheck();
          }
        }
      });
  }

  private loadAssetsFromSavedSelection(): void {
    const batchNumber = this.batchFilterBatchNumber?.trim();
    const hasBatchNumber = !!batchNumber;
    const hasDepotSelection = this.savedDepotIds.length > 0;

    if (!hasBatchNumber && !hasDepotSelection) return;

    this.loadingAssets = true;
    this.cdr.markForCheck();

    const options = {
      serialNumberOnly: this.batchFilterSerialNumberOnly,
      filterByIsAssigned: this.batchFilterByIsAssigned ?? undefined
    };

    if (hasBatchNumber) {
      this.batchService.getByBatchNumber(batchNumber, options).pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null))
      ).subscribe({
        next: (batch) => {
          const ids = batch ? [batch.id] : [];
          const data = batch ? this.buildOrderAssetsFromBatches([batch], ids) : this.buildEmptyOrderAssets();
          this.assetsData = data;
          this.reviewService.updateItemsWithAvailableAssets(data);
          this.assetsLoadedOnce = true;
          this.loadingAssets = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleError('Failed to load assets', error, 'weaponSupplyReview.failedToLoadAssets');
          this.loadingAssets = false;
          this.cdr.markForCheck();
        }
      });
      return;
    }

    const depotIds = this.savedDepotIds;
    const batchIds = this.savedBatchIds.length > 0 ? [...this.savedBatchIds] : undefined;

    const loadBatchIds$ = batchIds && batchIds.length > 0
      ? of(batchIds)
      : this.assetSupplyService.getBatchesForOrderDepots(this.orderId, depotIds).pipe(
          catchError(() => of([])),
          switchMap(batches => of(batches.map(b => b.id)))
        );

    loadBatchIds$.pipe(
      takeUntil(this.destroy$),
      switchMap(ids => {
        if (!ids || ids.length === 0) return of(this.buildEmptyOrderAssets());
        return forkJoin(
          ids.map(id => {
            const perBatchQty = this.savedBatchQuantities.get(id);
            const batchOptions = {
              ...options,
              quantity: perBatchQty ?? undefined
            };
            return this.batchService.getById(id, batchOptions).pipe(catchError(() => of(null)));
          })
        ).pipe(
          switchMap(batches => {
            const data = this.buildOrderAssetsFromBatches(batches, ids);
            return of(data);
          })
        );
      })
    ).subscribe({
      next: (data) => {
        this.assetsData = data;
        this.reviewService.updateItemsWithAvailableAssets(data);
        this.assetsLoadedOnce = true;
        this.loadingAssets = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.handleError('Failed to load assets', error, 'weaponSupplyReview.failedToLoadAssets');
        this.loadingAssets = false;
        this.cdr.markForCheck();
      }
    });
  }

  private buildEmptyOrderAssets(): OrderAssetsToSupplyDto {
    const items = (this.orderData?.requestItems ?? []).map(ri => ({
      itemId: ri.itemId,
      itemName: ri.itemName,
      requestedQuantity: ri.quantity,
      availableQuantity: 0,
      canFulfill: false,
      availableAssets: []
    }));
    return {
      orderId: this.orderId,
      requestNo: this.orderData?.requestNo,
      departmentName: this.orderData?.department?.nameEn,
      items,
      canFullyFulfill: false
    };
  }

  private buildOrderAssetsFromBatches(
    batches: (import('@models/batch.model').BatchDto | null)[],
    _batchIds: number[]
  ): OrderAssetsToSupplyDto {
    const reqItems = this.orderData?.requestItems ?? [];
    const requestItemIds = new Set(reqItems.map((ri: { itemId?: number }) => ri.itemId).filter((id): id is number => id != null));
    const requestItemMap = new Map(
      reqItems
        .filter((ri: { itemId?: number }) => ri.itemId != null)
        .map((ri: { itemId: number; itemName?: string; quantity?: number }) => [ri.itemId, { itemName: ri.itemName, quantity: ri.quantity ?? 0 }])
    );

    const flatAssets: { itemId: number; dto: import('@services/asset-supply.service').AssetToSupplyDto }[] = [];

    for (const batch of batches) {
      const assets = (batch as { assets?: unknown[]; Assets?: unknown[] })?.assets ?? (batch as { Assets?: unknown[] })?.Assets ?? [];
      if (!assets?.length) continue;
      for (const asset of assets) {
        const itemId = (asset as { itemId?: number }).itemId;
        if (itemId == null || !requestItemIds.has(itemId)) continue;
        const dto: import('@services/asset-supply.service').AssetToSupplyDto = {
          id: (asset as { id?: number }).id ?? 0,
          serialNumber: ((asset as { serialNumber?: string }).serialNumber ?? '') as string,
          rfid: (asset as { rfid?: string }).rfid,
          assetTag: (asset as { assetTag?: string }).assetTag,
          condition: (asset as { condition?: string }).condition,
          status: (asset as { status?: number }).status,
          purchaseDate: (() => {
            const pd = (asset as { purchaseDate?: string | Date }).purchaseDate;
            return pd instanceof Date ? pd.toISOString() : (pd ?? undefined);
          })(),
          depotId: (asset as { depotId?: number }).depotId ?? 0,
          depot: (asset as { depot?: { id: number; nameEn?: string; nameAr?: string } }).depot,
          priority: 0
        };
        flatAssets.push({ itemId, dto });
      }
    }

    const assetsByItem = new Map<number, import('@services/asset-supply.service').AssetToSupplyDto[]>();
    for (const { itemId, dto } of flatAssets) {
      const list = assetsByItem.get(itemId) ?? [];
      list.push(dto);
      assetsByItem.set(itemId, list);
    }

    const items = Array.from(requestItemMap.entries()).map(([itemId, info]) => {
      const availableAssets = assetsByItem.get(itemId) ?? [];
      const requestedQuantity = info.quantity;
      return {
        itemId,
        itemName: info.itemName,
        requestedQuantity,
        availableQuantity: availableAssets.length,
        canFulfill: availableAssets.length >= requestedQuantity,
        availableAssets
      };
    });

    return {
      orderId: this.orderId,
      requestNo: this.orderData?.requestNo,
      departmentName: this.orderData?.department?.nameEn,
      items,
      canFullyFulfill: items.every(i => i.canFulfill)
    };
  }

  onBatchFiltersChange(): void {
    this.loadAssetsFromSavedSelection();
  }


  get hasNoAvailableAssets(): boolean {
    return this.itemsWithAssets.length > 0 && this.itemsWithAssets.every(i => i.availableQuantity === 0);
  }

  get hasSomeAvailableAssets(): boolean {
    return this.itemsWithAssets.some(i => i.availableQuantity > 0);
  }

  private setupSubscriptions(): void {
    this.reviewService.itemsWithAssets$
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => {
        this.itemsWithAssets = items;
        this.cdr.markForCheck();
      });

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.lookupService.refreshDepotOptionsOnLangChange();
      if (this.hasSavedSelection) {
        this.savedSelectionDepots = this.savedDepotIds.map(id => ({
          id,
          name: this.lookupService.getDepotDisplayName(id)
        }));
        this.savedSelectionTableRows = this.savedSelectionTableRows.map(row => ({
          ...row,
          depotName: this.lookupService.getDepotDisplayName(row.depotId)
        }));
      }
      this.cdr.markForCheck();
    });

    this.scanSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.reviewService.scanSerialNumber(value);
    });
  }

  // ==================== SCANNING ====================

  onScanInput(value: string): void {
    this.scanSubject.next(value);
  }

  scanSerialNumber(value: string): void {
    this.reviewService.scanSerialNumber(value);
  }

  // ==================== ASSET SELECTION ====================

  onAssetSelectionChange(item: ItemWithAssets, event: { asset: SelectedAsset; selected: boolean }): void {
    if (!event.selected && item.selectedCount >= item.requestedQuantity) {
      this.toastService.warning(
        this.translate.instant('weaponSupplyReview.maxQuantityReached', { quantity: item.requestedQuantity }),
        this.translate.instant('toast.warning')
      );
      event.asset.selected = false;
      return;
    }
    this.reviewService.toggleAssetSelection(item, event.asset, event.selected);
  }

  onBulkSelectChange(item: ItemWithAssets, count: number): void {
    const maxCount = Math.min(count, item.requestedQuantity, item.selectedAssets.length);
    const currentlySelected = item.selectedCount;

    if (maxCount > currentlySelected) {
      this.selectAssets(item, maxCount - currentlySelected);
    } else if (maxCount < currentlySelected) {
      this.deselectAssets(item, currentlySelected - maxCount);
    }
  }

  private selectAssets(item: ItemWithAssets, count: number): void {
    const assetsToSelect = item.selectedAssets
      .filter(a => !a.selected)
      .slice(0, count);

    assetsToSelect.forEach(asset => {
      this.reviewService.toggleAssetSelection(item, asset, true);
      asset.custodianId = this.reviewService.defaultCustodianId;
    });
  }

  private deselectAssets(item: ItemWithAssets, count: number): void {
    const assetsToDeselect = item.selectedAssets
      .filter(a => a.selected)
      .slice(-count);

    assetsToDeselect.forEach(asset => {
      this.reviewService.toggleAssetSelection(item, asset, false);
    });
  }

  // ==================== CUSTODIAN ASSIGNMENT ====================

  onCustodianChange(asset: SelectedAsset, custodianId: number): void {
    asset.custodianId = custodianId || undefined;
  }

  onNotesChange(asset: SelectedAsset, notes: string): void {
    asset.notes = notes || undefined;
  }

  onSerialNumberChange(asset: SelectedAsset, serialNumber: string): void {
    const value = serialNumber.trim() || null;
    this.assetService.updateSerialNumber(asset.id, value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          asset.serialNumber = value ?? undefined;
          this.toastService.success(
            this.translate.instant('weaponSupplyReview.serialNumberUpdated'),
            this.translate.instant('toast.success')
          );
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleError('Failed to update serial number', error, 'weaponSupplyReview.failedToUpdateSerialNumber');
        }
      });
  }

  getSelectedAssetsForItem(item: ItemWithAssets): SelectedAsset[] {
    return item.selectedAssets.filter(asset => asset.selected);
  }

  // ==================== SUBMISSION ====================

  canSubmit(): boolean {
    if (!this.receiverName || !this.receiverMilitaryId || !this.receiverRankId) {
      return false;
    }

    const hasSelectedAssets = this.itemsWithAssets.some(item => item.selectedCount > 0);
    if (!hasSelectedAssets) {
      return false;
    }

    return true;
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      this.toastService.warning(
        this.translate.instant('weaponSupplyReview.cannotSubmit'),
        this.translate.instant('toast.warning')
      );
      return;
    }

    const receiverInfo: ReceiverInfo = {
      receiverName: this.receiverName,
      receiverMilitaryId: this.receiverMilitaryId,
      receiverRankId: this.receiverRankId!,
      location: this.location || undefined,
      expectedReturnDate: this.expectedReturnDate || undefined,
      notes: this.notes || undefined
    };

    const dto = this.reviewService.createSupplyDto(this.orderId, receiverInfo, this.itemsWithAssets);

    this.submitting = true;
    this.cdr.markForCheck();

    this.reviewService.submitSupply(dto)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.handleError('Failed to submit asset supply', error, 'weaponSupplyReview.failedToSubmit');
          this.submitting = false;
          this.cdr.markForCheck();
          return [];
        })
      )
      .subscribe({
        next: () => {
          this.submitting = false;
          this.cdr.markForCheck();
          this.toastService.success(
            this.translate.instant('weaponSupplyReview.submitSuccess'),
            this.translate.instant('toast.success')
          );

          setTimeout(() => {
            this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
          }, 1500);
        }
      });
  }

  // ==================== UI HELPERS ====================

  get filteredItems(): ItemWithAssets[] {
    return this.uiService.filterItems(this.itemsWithAssets);
  }

  get paginatedItems(): ItemWithAssets[] {
    return this.uiService.paginateItems(this.filteredItems);
  }

  get totalPages(): number {
    return this.uiService.getTotalPages(this.filteredItems.length);
  }

  onItemSearch(term: string): void {
    this.uiService.setSearchTerm(term);
  }

  setPage(page: number): void {
    this.uiService.setPage(page, this.totalPages);
  }

  toggleItemExpanded(item: ItemWithAssets): void {
    this.uiService.toggleItemExpanded(item.itemId);
  }

  isItemExpanded(item: ItemWithAssets): boolean {
    return this.uiService.isItemExpanded(item.itemId);
  }

  trackByItemId(_index: number, item: ItemWithAssets): number {
    return item.itemId;
  }

  // ==================== NAVIGATION ====================

  goBack(): void {
    if (this.orderId) {
      this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
    } else {
      this.router.navigate(['/requests-management']);
    }
  }

  goToSelectionPage(): void {
    this.router.navigate(['/requests-management', this.orderId, 'weapon-supply-selection']);
  }

  openAddEmployeeModal(): void {
    this.isEmployeeModalOpen = true;
    this.cdr.markForCheck();
  }

  onEmployeeModalClosed(): void {
    this.isEmployeeModalOpen = false;
    this.cdr.markForCheck();
  }

  onEmployeeSaved(): void {
    this.lookupService.loadEmployees().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isEmployeeModalOpen = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ==================== ERROR HANDLING ====================

  private handleError(logMessage: string, error: unknown, translationKey: string): void {
    this.config.logError(logMessage, error);
    const errorMessage = ErrorHandler.extractErrorMessage(error, this.translate.instant(translationKey));
    this.toastService.error(errorMessage, this.translate.instant('toast.error'));
  }

  // ==================== DISPLAY HELPERS ====================

  formatNumber(num: number): string {
    return this.displayService.formatNumber(num);
  }

  formatDate(date: Date | string | undefined): string {
    return this.displayService.formatDate(date);
  }

  getCurrentLang(): string {
    return this.displayService.getCurrentLang();
  }

  getDepartmentName(): string {
    return this.displayService.getDepartmentName(this.orderData);
  }

  getRequesterName(): string {
    return this.displayService.getRequesterName(this.orderData);
  }

  getTotalSelectedCount(): number {
    return this.displayService.getTotalSelectedCount(this.itemsWithAssets);
  }

  getTotalRequestedCount(): number {
    return this.displayService.getTotalRequestedCount(this.itemsWithAssets);
  }

  isFullyFulfilled(): boolean {
    return this.displayService.isFullyFulfilled(this.itemsWithAssets);
  }

  isPartiallyFulfilled(): boolean {
    return this.displayService.isPartiallyFulfilled(this.itemsWithAssets);
  }

  getEmployeeDisplayName(employeeId: number): string {
    return this.lookupService.getEmployeeDisplayName(employeeId);
  }
}
