import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Package, Clock, User, Shield, FileText, Warehouse, Building2, Users, ClipboardList, Check, X, Search } from 'lucide-angular';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Services
import { AssetSupplyService, OrderAssetsToSupplyDto } from '@services/asset-supply.service';
import { OrderService } from '@services/order.service';
import { OrderDto } from '@models/order.model';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslationService } from '@services/translation.service';
import { WeaponSupplyReviewService, ItemWithAssets } from './services/weapon-supply-review.service';
import { WeaponSupplyUIService } from './services/weapon-supply-ui.service';
import { WeaponSupplyLookupService } from './services/weapon-supply-lookup.service';
import { WeaponSupplyDisplayService } from './services/weapon-supply-display.service';
import { SelectedAsset } from './services/asset-selection.service';

// Components
import { LoadingStateComponent } from '@components/loading-state/loading-state.component';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { ItemAssetSelectionComponent } from './components/item-asset-selection/item-asset-selection.component';
import { WeaponSupplySelectionComponent } from './components/weapon-supply-selection/weapon-supply-selection.component';

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
    WeaponSupplySelectionComponent
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

  // Icons
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

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  // Core State
  orderId: number = 0;
  orderData: OrderDto | null = null;
  assetsData: OrderAssetsToSupplyDto | null = null;
  itemsWithAssets: ItemWithAssets[] = [];

  // UI State
  isRequestInfoExpanded: boolean = true;
  isItemsExpanded: boolean = true;
  isReceiverInfoExpanded: boolean = true;
  scanSubject = new Subject<string>();

  // Loading States
  loading: boolean = true;
  loadingAssets: boolean = false;
  submitting: boolean = false;

  // Receiver Information
  receiverName: string = '';
  receiverMilitaryId: string = '';
  receiverRankId: number = 0;
  location: string = '';
  expectedReturnDate: string = '';
  notes: string = '';

  // Depot Selection
  selectedDepotIds: number[] = [];
  depotsSelected: boolean = false;
  depotsConfirmed: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private assetSupplyService: AssetSupplyService,
    private orderService: OrderService,
    private translationService: TranslationService,
    private toastService: ToastService,
    public translate: TranslateService,
    private config: ConfigService,
    public reviewService: WeaponSupplyReviewService,
    public uiService: WeaponSupplyUIService,
    public lookupService: WeaponSupplyLookupService,
    public displayService: WeaponSupplyDisplayService,
    private cdr: ChangeDetectorRef
  ) { }

  // Expose service properties for template
  get defaultCustodianId(): string {
    return this.reviewService.defaultCustodianId;
  }

  get ranks() {
    return this.lookupService.ranks;
  }

  get availableUsers() {
    return this.lookupService.availableUsers;
  }

  get userDropdownOptions() {
    return this.lookupService.userDropdownOptions;
  }

  get availableDepots() {
    return this.lookupService.availableDepots;
  }

  get depotDropdownOptions() {
    return this.lookupService.depotDropdownOptions;
  }

  get currentPage(): number {
    return this.uiService.currentPage;
  }

  get pageSize(): number {
    return this.uiService.pageSize;
  }

  get loadingUsers(): boolean {
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

  // ==================== INITIALIZATION ====================

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

    // Load order data
    this.orderService.getOrderById(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          this.orderData = order;
          this.reviewService.initializeItemsFromOrder(order);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleError('Failed to load order details', error, 'weaponSupplyReview.failedToLoadOrderDetails');
          this.cdr.markForCheck();
          this.goBack();
        }
      });

    // Load lookup data in parallel
    forkJoin({
      depots: this.lookupService.loadDepots(),
      users: this.lookupService.loadUsers(),
      ranks: this.lookupService.loadRanks()
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (error) => {
          this.config.logError('Failed to load lookup data', error);
          this.cdr.markForCheck();
        }
      });
  }

  private setupSubscriptions(): void {
    // Subscribe to items changes
    this.reviewService.itemsWithAssets$
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => {
        this.itemsWithAssets = items;
        this.cdr.markForCheck();
      });

    // Refresh depot options when language changes (for correct nameEn/nameAr display)
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.lookupService.refreshDepotOptionsOnLangChange();
      this.cdr.markForCheck();
    });

    // Setup scan listener with debounce
    this.scanSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.reviewService.scanSerialNumber(value);
    });
  }

  // ==================== DEPOT MANAGEMENT ====================

  toggleDepotSelection(depotId: number): void {
    const index = this.selectedDepotIds.indexOf(depotId);
    if (index > -1) {
      this.selectedDepotIds.splice(index, 1);
    } else {
      this.selectedDepotIds.push(depotId);
    }

    if (this.depotsConfirmed) {
      this.resetDepotConfirmation();
    }
  }

  confirmDepotSelection(): void {
    if (this.selectedDepotIds.length === 0) {
      this.toastService.warning(
        this.translate.instant('weaponSupplyReview.selectAtLeastOneDepot'),
        this.translate.instant('toast.warning')
      );
      return;
    }

    this.depotsConfirmed = true;
    this.depotsSelected = true;
    this.loadAssets();
  }

  clearDepotSelection(): void {
    this.selectedDepotIds = [];
    this.resetDepotConfirmation();
  }

  private resetDepotConfirmation(): void {
    this.depotsConfirmed = false;
    this.depotsSelected = false;
    this.assetsData = null;

    if (this.orderData) {
      this.reviewService.initializeItemsFromOrder(this.orderData);
    }
  }

  private loadAssets(): void {
    if (!this.orderId || this.selectedDepotIds.length === 0) return;

    this.loadingAssets = true;
    this.cdr.markForCheck();
    this.assetSupplyService.getAssetsToSupply(this.orderId, this.selectedDepotIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.assetsData = data;
          this.reviewService.updateItemsWithAvailableAssets(data);
          this.loadingAssets = false;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleError('Failed to load assets', error, 'weaponSupplyReview.failedToLoadAssets');
          this.loadingAssets = false;
          this.loading = false;
          this.cdr.markForCheck();
        }
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

  onCustodianChange(asset: SelectedAsset, custodianId: string): void {
    asset.custodianId = custodianId || undefined;
  }

  onConditionChange(asset: SelectedAsset, condition: string): void {
    asset.conditionOnSupply = condition || undefined;
  }

  onNotesChange(asset: SelectedAsset, notes: string): void {
    asset.notes = notes || undefined;
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

    const allHaveCustodians = this.itemsWithAssets.every(item =>
      item.selectedAssets
        .filter(a => a.selected)
        .every(a => a.custodianId)
    );

    return allHaveCustodians;
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      this.toastService.warning(
        this.translate.instant('weaponSupplyReview.cannotSubmit'),
        this.translate.instant('toast.warning')
      );
      return;
    }

    const receiverInfo = {
      receiverName: this.receiverName,
      receiverMilitaryId: this.receiverMilitaryId,
      receiverRankId: this.receiverRankId,
      location: this.location,
      expectedReturnDate: this.expectedReturnDate,
      notes: this.notes
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

  // ==================== NAVIGATION ====================

  goBack(): void {
    if (this.orderId) {
      this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
    } else {
      this.router.navigate(['/requests-management']);
    }
  }

  // ==================== ERROR HANDLING ====================

  private handleError(logMessage: string, error: unknown, translationKey: string): void {
    this.config.logError(logMessage, error);
    const errorMessage = ErrorHandler.extractErrorMessage(error, this.translate.instant(translationKey));
    this.toastService.error(errorMessage, this.translate.instant('toast.error'));
  }

  // ==================== DISPLAY HELPERS (Delegated to Service) ====================

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

  getUserDisplayName(userId: string): string {
    return this.lookupService.getUserDisplayName(userId);
  }
}
