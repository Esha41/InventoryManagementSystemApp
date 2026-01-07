import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Package, Clock, User, Shield, FileText, Warehouse, Building2, Users, ClipboardList, Check, X } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Services
import { AssetSupplyService, OrderAssetsToSupplyDto, ItemAssetsToSupplyDto, AssetToSupplyDto, CreateAssetSupplyDto } from '@services/asset-supply.service';
import { OrderService, OrderDto } from '@services/order.service';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { TranslationService } from '@services/translation.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { UserContextService } from '@services/user-context.service';
import { BackendUserService } from '@services/backend-user.service';
import { BackendUserDto } from '@models/backend-user.model';

// Components
import { LoadingStateComponent, ModalComponent, ButtonComponent } from '@components/index';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';

// Utils
import { formatNumber as formatNumberUtil, formatDate as formatDateUtil } from '@utils/format.utils';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';

/**
 * Selected asset with custodian assignment - matches CreateAssetSupplyDetailDto structure
 */
interface SelectedAsset extends AssetToSupplyDto {
  selected: boolean;
  assetId: number; // For DTO mapping
  custodianId?: string;
  conditionOnSupply?: string;
  notes?: string;
}

/**
 * Item with selected assets
 */
interface ItemWithAssets {
  itemId: number;
  itemName: string;
  requestedQuantity: number;
  availableQuantity: number;
  canFulfill: boolean;
  selectedAssets: SelectedAsset[];
  selectedCount: number;
}

@Component({
  selector: 'app-weapon-supply-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    HasPermissionDirective,
    LoadingStateComponent,
    ModalComponent,
    ButtonComponent,
    DropdownComponent
  ],
  templateUrl: './weapon-supply-review.component.html',
  styleUrls: ['./weapon-supply-review.component.css']
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

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  // State
  orderId: number = 0;
  orderData: OrderDto | null = null;
  assetsData: OrderAssetsToSupplyDto | null = null;
  itemsWithAssets: ItemWithAssets[] = [];

  // UI State
  isRequestInfoExpanded: boolean = true;
  isItemsExpanded: boolean = true;
  isReceiverInfoExpanded: boolean = true;

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
  defaultCustodianId: string = '';

  // Ranks dropdown
  ranks: LookupItem[] = [];
  loadingRanks: boolean = false;

  // Users/Custodians
  availableUsers: BackendUserDto[] = [];
  userDropdownOptions: DropdownOption<string>[] = [];
  loadingUsers: boolean = false;

  // Depots
  availableDepots: LookupItem[] = [];
  selectedDepotIds: number[] = [];
  loadingDepots: boolean = false;
  depotDropdownOptions: DropdownOption<number>[] = [];
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
    private lookupService: LookupService,
    private userContextService: UserContextService,
    private backendUserService: BackendUserService
  ) { }

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['id'];
    this.orderId = parseInt(idParam, 10);
    if (isNaN(this.orderId)) {
      const message = this.translate.instant('weaponSupplyReview.invalidOrderId');
      const title = this.translate.instant('toast.error');
      this.toastService.error(message, title);
      this.router.navigate(['/requests-management']);
      return;
    }
    this.loadOrderData();
    this.loadRanks();
    this.loadUsers();
    this.loadDepots();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== DATA LOADING ====================

  loadOrderData(): void {
    this.loading = true;

    this.orderService.getOrderById(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          this.orderData = order;
          this.defaultCustodianId = order.requesterId || '';
          // Don't load assets data here - wait for depot selection
          this.loading = false;
        },
        error: (error) => {
          this.config.logError('Failed to load order details', error);
          const message = this.translate.instant('weaponSupplyReview.failedToLoadOrderDetails');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          this.loading = false;
          this.goBack();
        }
      });
  }

  loadDepots(): void {
    this.loadingDepots = true;
    this.lookupService.getDepots()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots: LookupItem[]) => {
          this.availableDepots = depots.filter(d => !d.isDeleted);
          const currentLang = getCurrentLang(this.translate);
          this.depotDropdownOptions = this.availableDepots.map(depot => ({
            value: depot.id!,
            label: currentLang === 'ar' 
              ? (depot.nameAr || depot.nameEn || `Depot ${depot.id}`)
              : (depot.nameEn || depot.nameAr || `Depot ${depot.id}`),
            description: depot.code || ''
          })).sort((a, b) => a.label.localeCompare(b.label));
          this.loadingDepots = false;
        },
        error: (error: any) => {
          this.config.logError('Failed to load depots', error);
          this.loadingDepots = false;
        }
      });
  }

  toggleDepotSelection(depotId: number): void {
    const index = this.selectedDepotIds.indexOf(depotId);
    if (index > -1) {
      this.selectedDepotIds.splice(index, 1);
    } else {
      this.selectedDepotIds.push(depotId);
    }
    
    // Reset confirmation if depots are changed
    if (this.depotsConfirmed) {
      this.depotsConfirmed = false;
      this.assetsData = null;
      this.itemsWithAssets = [];
    }
  }

  confirmDepotSelection(): void {
    if (this.selectedDepotIds.length === 0) {
      const message = this.translate.instant('weaponSupplyReview.selectAtLeastOneDepot');
      const title = this.translate.instant('toast.warning');
      this.toastService.warning(message, title);
      return;
    }

    this.depotsConfirmed = true;
    this.depotsSelected = true;
    this.loadAssetsData();
  }

  clearDepotSelection(): void {
    this.selectedDepotIds = [];
    this.depotsConfirmed = false;
    this.depotsSelected = false;
    this.assetsData = null;
    this.itemsWithAssets = [];
  }

  loadAssetsData(): void {
    if (!this.depotsConfirmed || this.selectedDepotIds.length === 0) {
      return;
    }

    this.loadingAssets = true;

    this.assetSupplyService.getAssetsToSupply(this.orderId, this.selectedDepotIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.assetsData = data;
          this.initializeItemsWithAssets(data);
          this.loadingAssets = false;
          this.loading = false;
        },
        error: (error) => {
          this.config.logError('Failed to load available assets', error);
          const message = this.translate.instant('weaponSupplyReview.failedToLoadAssets');
          const title = this.translate.instant('toast.error');
          this.toastService.error(message, title);
          this.loadingAssets = false;
          this.loading = false;
        }
      });
  }

  private initializeItemsWithAssets(data: OrderAssetsToSupplyDto): void {
    this.itemsWithAssets = data.items.map(item => ({
      itemId: item.itemId,
      itemName: item.itemName || 'Unknown Item',
      requestedQuantity: item.requestedQuantity,
      availableQuantity: item.availableQuantity,
      canFulfill: item.canFulfill,
      selectedAssets: item.availableAssets.map(asset => ({
        ...asset,
        assetId: asset.id, // For DTO mapping
        selected: false,
        custodianId: this.defaultCustodianId,
        conditionOnSupply: asset.condition || '',
        notes: ''
      })),
      selectedCount: 0
    }));
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.backendUserService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users: BackendUserDto[]) => {
          this.availableUsers = users || [];
          // Create dropdown options
          const currentLang = getCurrentLang(this.translate);
          this.userDropdownOptions = this.availableUsers.map(user => ({
            value: user.id,
            label: currentLang === 'ar' 
              ? (user.nameAr || user.userName)
              : (user.nameEn || user.userName),
            description: user.userName
          })).sort((a, b) => a.label.localeCompare(b.label));
          this.loadingUsers = false;
        },
        error: (error: any) => {
          this.config.logError('Failed to load users', error);
          this.loadingUsers = false;
        }
      });
  }

  loadRanks(): void {
    this.loadingRanks = true;
    this.lookupService.getLookupItems('Rank')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ranks: LookupItem[]) => {
          this.ranks = ranks || [];
          this.loadingRanks = false;
        },
        error: (error: any) => {
          this.config.logError('Failed to load ranks', error);
          this.loadingRanks = false;
        }
      });
  }

  // ==================== ASSET SELECTION ====================

  toggleAssetSelection(item: ItemWithAssets, asset: SelectedAsset): void {
    if (!asset.selected && item.selectedCount >= item.requestedQuantity) {
      const message = this.translate.instant('weaponSupplyReview.maxQuantityReached', {
        quantity: item.requestedQuantity
      });
      const title = this.translate.instant('toast.warning');
      this.toastService.warning(message, title);
      return;
    }

    asset.selected = !asset.selected;
    item.selectedCount = item.selectedAssets.filter(a => a.selected).length;
  }

  selectAssetsForItem(item: ItemWithAssets, count: number): void {
    const maxCount = Math.min(count, item.requestedQuantity, item.selectedAssets.length);
    const currentlySelected = item.selectedCount;

    if (maxCount > currentlySelected) {
      // Select more assets (FIFO order)
      const assetsToSelect = item.selectedAssets
        .filter(a => !a.selected)
        .slice(0, maxCount - currentlySelected);
      assetsToSelect.forEach(asset => {
        asset.selected = true;
        asset.custodianId = this.defaultCustodianId;
      });
    } else if (maxCount < currentlySelected) {
      // Deselect assets (reverse FIFO order)
      const assetsToDeselect = item.selectedAssets
        .filter(a => a.selected)
        .slice(-(currentlySelected - maxCount));
      assetsToDeselect.forEach(asset => {
        asset.selected = false;
      });
    }

    item.selectedCount = item.selectedAssets.filter(a => a.selected).length;
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

  getUserDisplayName(userId: string): string {
    if (!userId) return '';
    const user = this.availableUsers.find(u => u.id === userId);
    if (!user) return userId;
    const currentLang = getCurrentLang(this.translate);
    return currentLang === 'ar' 
      ? (user.nameAr || user.userName)
      : (user.nameEn || user.userName);
  }

  getSelectedAssetsForItem(item: ItemWithAssets): SelectedAsset[] {
    return item.selectedAssets.filter(asset => asset.selected);
  }

  // ==================== SUBMISSION ====================

  canSubmit(): boolean {
    // Check if depots are confirmed
    if (!this.depotsConfirmed || this.selectedDepotIds.length === 0) {
      return false;
    }

    if (!this.receiverName || !this.receiverMilitaryId || !this.receiverRankId) {
      return false;
    }

    // Check if at least one asset is selected
    const hasSelectedAssets = this.itemsWithAssets.some(item => item.selectedCount > 0);
    if (!hasSelectedAssets) {
      return false;
    }

    // Check if all selected assets have custodians
    const allHaveCustodians = this.itemsWithAssets.every(item =>
      item.selectedAssets
        .filter(a => a.selected)
        .every(a => a.custodianId)
    );

    return allHaveCustodians;
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      const message = this.translate.instant('weaponSupplyReview.cannotSubmit');
      const title = this.translate.instant('toast.warning');
      this.toastService.warning(message, title);
      return;
    }

    const selectedAssets = this.itemsWithAssets.flatMap(item =>
      item.selectedAssets
        .filter(a => a.selected)
        .map(a => ({
          assetId: a.assetId || a.id,
          conditionOnSupply: a.conditionOnSupply || a.condition || undefined,
          custodianId: a.custodianId || undefined,
          notes: a.notes || undefined
        }))
    );

    const dto: CreateAssetSupplyDto = {
      orderId: this.orderId,
      custodianId: this.defaultCustodianId,
      receiverName: this.receiverName,
      receiverMilitaryId: this.receiverMilitaryId,
      receiverRankId: this.receiverRankId,
      location: this.location || undefined,
      expectedReturnDate: this.expectedReturnDate || undefined,
      notes: this.notes || undefined,
      supplyDetails: selectedAssets
    };

    this.submitting = true;

    this.assetSupplyService.createAndSubmit(dto)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.config.logError('Failed to submit asset supply', error);
          const errorMessage = error?.error?.message || error?.message || this.translate.instant('weaponSupplyReview.failedToSubmit');
          const title = this.translate.instant('toast.error');
          this.toastService.error(errorMessage, title);
          this.submitting = false;
          return [];
        })
      )
      .subscribe({
        next: (supplyId) => {
          this.submitting = false;
          const message = this.translate.instant('weaponSupplyReview.submitSuccess');
          const title = this.translate.instant('toast.success');
          this.toastService.success(message, title);
          
          // Navigate back to workflow approval detail
          setTimeout(() => {
            this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
          }, 1500);
        }
      });
  }

  // ==================== NAVIGATION ====================

  goBack(): void {
    if (this.orderId) {
      this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
    } else {
      this.router.navigate(['/requests-management']);
    }
  }

  // ==================== UI HELPERS ====================

  formatNumber(num: number): string {
    return formatNumberUtil(num);
  }

  formatDate(date: Date | string | undefined): string {
    return formatDateUtil(date);
  }

  getCurrentLang(): string {
    return getCurrentLang(this.translate);
  }

  getDepartmentName(): string {
    if (!this.orderData) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    
    if (this.orderData.department) {
      return getLocalizedName(this.orderData.department, currentLang) || 'N/A';
    }
    
    if (this.orderData.departmentNameEn || this.orderData.departmentNameAr) {
      return getLocalizedName(
        {
          nameEn: this.orderData.departmentNameEn,
          nameAr: this.orderData.departmentNameAr
        },
        currentLang
      ) || 'N/A';
    }
    
    return 'N/A';
  }

  getRequesterName(): string {
    if (!this.orderData) return 'N/A';
    const currentLang = getCurrentLang(this.translate);

    // Use nested requester object if available (for proper localization)
    if (this.orderData.requester) {
      const localized = getLocalizedName(
        {
          nameEn: this.orderData.requester.fullNameEN,
          nameAr: this.orderData.requester.fullNameAR
        },
        currentLang
      );
      if (localized) return localized;
      if (this.orderData.requester.userName) return this.orderData.requester.userName;
    }

    // Fallback to flattened properties
    if (this.orderData.requesterNameEn || this.orderData.requesterNameAr) {
      return getLocalizedName(
        {
          nameEn: this.orderData.requesterNameEn,
          nameAr: this.orderData.requesterNameAr
        },
        currentLang
      ) || 'N/A';
    }

    if (this.orderData.requesterName) return this.orderData.requesterName;

    return 'N/A';
  }

  getTotalSelectedCount(): number {
    return this.itemsWithAssets.reduce((sum, item) => sum + item.selectedCount, 0);
  }

  getTotalRequestedCount(): number {
    return this.itemsWithAssets.reduce((sum, item) => sum + item.requestedQuantity, 0);
  }

  isFullyFulfilled(): boolean {
    return this.itemsWithAssets.every(item => item.selectedCount >= item.requestedQuantity);
  }

  isPartiallyFulfilled(): boolean {
    return this.itemsWithAssets.some(item => 
      item.selectedCount > 0 && item.selectedCount < item.requestedQuantity
    );
  }
}

