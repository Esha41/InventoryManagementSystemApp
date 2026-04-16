import { Component, OnDestroy, OnInit, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Cartridge } from './components/cartridge-list/cartridge-list.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { StepperComponent, Step } from '@components/stepper/stepper.component';
import { UsageFormComponent } from './components/usage-form/usage-form.component';
import { ReviewFormComponent } from './components/review-form/review-form.component';
import { AllowanceSelectionComponent } from './components/allowance-selection/allowance-selection.component';
import { OrderSuccessComponent } from './components/order-success/order-success.component';
import { StepSelectionComponent } from './components/step-selection/step-selection.component';
import { ErrorBannerComponent } from './components/error-banner/error-banner.component';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { CartridgeDataService } from '@services/cartridge-data.service';
import { OrderSubmissionService } from '@services/order-submission.service';
import { APIOperationResponse } from '@models/api-response.model';
import { IssueRequestFilterService } from '@requests/services/issue-request-filter.service';
import { IssueRequestStateService } from '@requests/services/issue-request-state.service';
import { IssueRequestDataService } from '@requests/services/issue-request-data.service';
import { IssueRequestNavigationService } from '@requests/services/issue-request-navigation.service';
import { IssueRequestUserContextService } from '@requests/services/issue-request-user-context.service';
import { IssueRequestCartridgeLoaderService } from '@requests/services/issue-request-cartridge-loader.service';
import { IssueRequestCartridgeManagementService } from '@requests/services/issue-request-cartridge-management.service';
import { IssueRequestSubmissionService } from '@requests/services/issue-request-submission.service';
import { OnboardingTourService } from '@features/onboarding/services/onboarding-tour.service';
import {
  RequestPurposeDto,
  FilterState,
  FilterOptions,
  CartridgeState,
  UsageFormData,
  ReserveDetailsState,
  UserContextState,
  RequestPurposeState,
  OrderSubmissionState,
  ReviewFormData
} from './new-issue-request.state';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getWeaponTypeOptions } from '@utils/weapon.utils';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';
import { ConfirmationDialogComponent, ConfirmationType } from '@components/confirmation-dialog/confirmation-dialog.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import {
  mapSelectedEntriesToCartridges,
  filterReserveDetailsBySelectedItems,
  computeTotalReserve,
  computeAvailableReserve,
  computeOrderedQuantity,
  computeUsedQuantity,
  resolveCurrentRequesterName,
  syncRequesterNameFromUserDetails as syncRequesterNameUtil,
  applyUserContext as applyUserContextUtil,
  applyAuthenticatedUserContext as applyAuthenticatedUserContextUtil,
  getDepartmentIdForRequest as getDepartmentIdForRequestUtil
} from '@utils/issue-request.utils';
import { defaultPageSize } from '@constants/app.constants';

interface ExtendedFilterState extends FilterState {
  selectedWeaponType?: string;
  selectedCaliber?: string;
  selectedExplosiveType?: string;
  selectedUNNumber?: string;
}

interface ExtendedFilterOptions extends FilterOptions {
  weaponTypeOptions?: string[];
  explosiveTypeOptions?: string[];
}

@Component({
  selector: 'app-new-issue-request',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    StepperComponent,
    StepperComponent,
    UsageFormComponent,
    ReviewFormComponent,
    AllowanceSelectionComponent,
    OrderSuccessComponent,
    ErrorBannerComponent,
    ConfirmationDialogComponent,
    StepSelectionComponent
  ],
  templateUrl: './new-issue-request.component.html',
  styleUrls: ['./new-issue-request.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewIssueRequestComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  /** Debounced refetch when sidebar filters change (full catalog only). */
  private readonly serverCatalogFilterApply$ = new Subject<void>();
  private static readonly SERVER_CATALOG_FILTER_DEBOUNCE_MS = 350;
  private pendingSelections: Array<{ id: number; quantity: number }> | null = null;
  currentStep = 0;
  steps: Step[] = [
    { label: 'newIssueRequest.allowanceSelection', completed: false },
    { label: 'newIssueRequest.selection', completed: false },
    { label: 'newIssueRequest.usage', completed: false },
    { label: 'newIssueRequest.review', completed: false },
    { label: 'newIssueRequest.send', completed: false }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private cartridgeDataService: CartridgeDataService,
    private orderSubmissionService: OrderSubmissionService,
    private filterService: IssueRequestFilterService,
    private stateService: IssueRequestStateService,
    private dataService: IssueRequestDataService,
    private navigationService: IssueRequestNavigationService,
    private issueRequestUserContextService: IssueRequestUserContextService,
    private cartridgeLoaderService: IssueRequestCartridgeLoaderService,
    private cartridgeManagementService: IssueRequestCartridgeManagementService,
    private submissionService: IssueRequestSubmissionService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private onboardingTourService: OnboardingTourService
  ) { }

  // Grouped state objects
  filterState: ExtendedFilterState = {
    selectedItemType: 'Ammunition',
    selectedAmmunitionType: '',
    selectedBulletDiameter: '',
    selectedLinked: '',
    selectedNature: '',
    selectedNSN: '',
    searchTerm: '',
    selectedWeaponType: '',
    selectedCaliber: '',
    selectedExplosiveType: '',
    selectedUNNumber: ''
  };

  filterOptions: ExtendedFilterOptions = {
    itemTypeOptions: ['Ammunition', 'Explosive', 'Weapon'],
    ammunitionTypeOptions: [
      { label: 'newIssueRequest.ammunitionTypeSmall', value: 'Small' },
      { label: 'newIssueRequest.ammunitionTypeMedium', value: 'Medium' },
      { label: 'newIssueRequest.ammunitionTypeLarge', value: 'Large' }
    ],
    bulletDiameters: [],
    linkedOptions: [
      { label: 'newIssueRequest.linkedOptionLinked', value: 'Linked' },
      { label: 'newIssueRequest.linkedOptionNotLinked', value: 'Not Linked' }
    ],
    natureOptions: [],
    orderPriorities: [],
    weaponTypeOptions: [],
    explosiveTypeOptions: []
  };

  cartridgeState: CartridgeState = {
    allCartridges: [],
    filteredCartridges: [],
    selectedCartridgeForView: null,
    showCartridgeDetails: false,
    loadingCartridges: false,
    catalogPageLoading: false,
    cartridgeError: null,
    selectedEntries: [],
    selectedCartridgesCache: new Map<number, Cartridge>(),
    catalogPagination: {
      page: 1,
      pageSize: defaultPageSize,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    }
  };

  usageFormData: UsageFormData = {
    usePurpose: '',
    usageLocation: '',
    numberOfOfficers: null,
    numberOfOtherRanks: null,
    usageDateFrom: '',
    usageTimeFrom: '',
    usageDateTo: '',
    usageTimeTo: '',
    orderPriority: ''
  };

  usageFormFiles: File[] = [];

  reserveDetailsState: ReserveDetailsState = {
    totalReserve: 0,
    availableReserve: 0,
    orderedQuantity: 0,
    usedQuantity: 0,
    loadingReserveDetails: false,
    reserveDetailsByItem: []
  };

  userContextState: UserContextState = {
    currentUserDetails: null,
    currentUserDepartmentId: null,
    currentUserRequesterId: null,
    fallbackRequesterName: '',
    isAdminUser: false,
    lockRequesterName: false
  };

  requestPurposeState: RequestPurposeState = {
    requestPurposeOptions: [],
    selectedRequestPurposeId: null,
    loadingRequestPurposes: false,
    requestPurposesSource: []
  };

  orderSubmissionState: OrderSubmissionState = {
    submittingOrder: false,
    orderSubmitError: null,
    createdOrderId: null,
    orderNumber: null,
    orderSubmitted: false
  };

  // Confirmation dialog state
  showConfirmDialog = false;
  confirmDialogConfig = {
    title: '',
    message: '',
    type: 'success' as ConfirmationType,
    confirmText: '',
    cancelText: ''
  };

  reviewFormData: ReviewFormData = {
    requesterName: '', // Will be populated from /Users/me API
    requesterComments: '',
    orderType: 'New Issue Request',
    orderDocument: ''
  };

  // Step 1: Allowance Selection
  fromReserve: string = 'Yes';
  allowanceError: string | null = null;

  private readonly DEFAULT_DEPARTMENT_ID = 1;
  private readonly DEFAULT_REQUEST_PURPOSE_ID = 1;
  private readonly DEFAULT_REQUEST_TYPE_ID = 1;

  get selectedCartridges(): Cartridge[] {
    return mapSelectedEntriesToCartridges(
      this.cartridgeState.selectedEntries,
      this.cartridgeState.allCartridges,
      this.cartridgeState.selectedCartridgesCache
    );
  }

  get displayedItemTypeOptions(): string[] {
    const options = this.filterOptions.itemTypeOptions;
    if (this.fromReserve === 'No') {
      return options.filter(t => t !== 'Weapon');
    }
    return options;
  }

  /** Training Order (ID 4) is not valid for weapon orders - hide from use purpose when weapons are selected */
  private static readonly TRAINING_ORDER_ID = 4;

  get displayedUsePurposeOptions(): DropdownOption<number>[] {
    const options = this.requestPurposeState.requestPurposeOptions;
    if (this.hasWeaponInSelection()) {
      return options.filter(opt => opt.value !== NewIssueRequestComponent.TRAINING_ORDER_ID);
    }
    return options;
  }

  private hasWeaponInSelection(): boolean {
    return this.selectedCartridges.some(c =>
      c.itemType === 'Weapon' || !!(c.weaponType || c.caliber || c.actionType)
    );
  }

  get canProceedFromSelection(): boolean {
    const hasSelection = this.cartridgeState.selectedEntries.length > 0;
    const quantitiesValid = this.cartridgeState.selectedEntries.every(entry => entry.quantity > 0);
    return hasSelection && quantitiesValid;
  }

  get currentRequesterName(): string {
    return resolveCurrentRequesterName(
      this.userContextState.currentUserDetails,
      this.userContextState.fallbackRequesterName,
      this.reviewFormData.requesterName
    );
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.onboardingTourService.checkAndStartPageTour('issue-request'), 300);
  }

  ngOnInit(): void {
    this.initializeUserContext();
    this.initializeStepFromQueryParams();
    this.loadRequestPurposes();
    this.rebuildOrderPriorities();

    // Load static options from Utils
    this.filterOptions.weaponTypeOptions = getWeaponTypeOptions() as any;
    this.filterOptions.explosiveTypeOptions = getExplosiveTypeOptions() as any;

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.rebuildRequestPurposeOptions();
        this.rebuildOrderPriorities();
        this.updateUsePurposeFromSelection(this.requestPurposeState.selectedRequestPurposeId);
      });

    this.serverCatalogFilterApply$
      .pipe(
        debounceTime(NewIssueRequestComponent.SERVER_CATALOG_FILTER_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (!this.isServerCatalogMode()) {
          return;
        }
        if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) {
          return;
        }
        this.cartridgeState.catalogPagination.page = 1;
        this.loadCatalogPage(1, 'overlay');
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeUserContext(): void {
    this.issueRequestUserContextService.initializeUserContext(
      this.userContextState,
      this.destroy$,
      () => this.syncRequesterNameFromUserDetails()
    );
  }

  private isServerCatalogMode(): boolean {
    return this.fromReserve === 'No';
  }

  private resetCatalogPagination(): void {
    this.cartridgeState.catalogPagination = {
      page: 1,
      pageSize: defaultPageSize,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };
  }

  private loadCartridges(): void {
    this.cartridgeState.cartridgeError = null;
    const type = this.filterState.selectedItemType;
    const isAllowance = this.fromReserve === 'Yes';
    const deptId = this.userContextState.currentUserDepartmentId;

    if (this.isServerCatalogMode()) {
      this.resetCatalogPagination();
      this.loadAmmunitionFacetMetadataIfNeeded();
      this.loadCatalogPage(1);
      return;
    }

    this.cartridgeState.loadingCartridges = true;
    this.cdr.markForCheck();

    if (isAllowance && !deptId) {
      this.cartridgeState.allCartridges = [];
      this.cartridgeState.filteredCartridges = [];
      this.cartridgeState.loadingCartridges = false;
      this.cartridgeState.cartridgeError = 'Department not found for current user.';
      this.cdr.markForCheck();
      return;
    }

    this.cartridgeLoaderService
      .loadCartridges(type, isAllowance, deptId)
      .subscribe({
        next: (result: any) => {
          this.cartridgeState.allCartridges = result.cartridges;
          this.buildFilterOptions();
          this.filterCartridges();

          if (isAllowance && deptId) {
            this.loadReserveDetails();
          }

          this.cartridgeState.loadingCartridges = false;
          if (result.error) {
            this.cartridgeState.cartridgeError = result.error;
          } else {
            this.restoreSelections();
          }
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          this.cartridgeState.allCartridges = [];
          this.cartridgeState.filteredCartridges = [];
          this.cartridgeState.loadingCartridges = false;
          this.cartridgeState.cartridgeError = error.error || 'Failed to load items. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  private loadAmmunitionFacetMetadataIfNeeded(): void {
    if (this.filterState.selectedItemType !== 'Ammunition') {
      return;
    }
    this.cartridgeLoaderService.loadAmmunitionFacetSample().subscribe({
      next: (facets) => {
        this.filterOptions.bulletDiameters = facets.bulletDiameters;
        this.filterOptions.natureOptions = facets.natureOptions;
        this.cdr.markForCheck();
      }
    });
  }

  private loadCatalogPage(page: number, loadMode: 'initial' | 'overlay' = 'initial'): void {
    this.cartridgeState.cartridgeError = null;
    if (loadMode === 'overlay') {
      this.cartridgeState.catalogPageLoading = true;
    } else {
      this.cartridgeState.loadingCartridges = true;
      this.cartridgeState.catalogPageLoading = false;
    }
    this.cdr.markForCheck();

    const type = this.filterState.selectedItemType;
    const size = this.cartridgeState.catalogPagination.pageSize;

    this.cartridgeLoaderService
      .loadCartridgesPaginated(type, page, size, this.filterState)
      .subscribe({
        next: (result) => {
          this.cartridgeState.allCartridges = result.cartridges;
          this.cartridgeState.catalogPagination = {
            page: result.pageIndex,
            pageSize: size,
            totalCount: result.totalCount,
            totalPages: result.totalPages,
            hasNextPage: result.hasNextPage,
            hasPreviousPage: result.hasPreviousPage
          };
          this.mergeSelectedWithList(this.cartridgeState.allCartridges);
          this.cartridgeState.loadingCartridges = false;
          this.cartridgeState.catalogPageLoading = false;
          if (result.error) {
            this.cartridgeState.cartridgeError = result.error;
          } else {
            this.restoreSelections();
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.cartridgeState.allCartridges = [];
          this.cartridgeState.filteredCartridges = [];
          this.cartridgeState.loadingCartridges = false;
          this.cartridgeState.catalogPageLoading = false;
          this.cartridgeState.cartridgeError = 'Failed to load items. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  applyCatalogSearch(searchTerm?: string): void {
    if (!this.isServerCatalogMode()) {
      return;
    }
    if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) {
      return;
    }
    if (searchTerm !== undefined) {
      this.filterState.searchTerm = searchTerm;
    }
    this.cartridgeState.catalogPagination.page = 1;
    this.loadCatalogPage(1, 'overlay');
  }

  onCatalogPageNext(): void {
    if (!this.isServerCatalogMode() || !this.cartridgeState.catalogPagination.hasNextPage) {
      return;
    }
    if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) {
      return;
    }
    this.loadCatalogPage(this.cartridgeState.catalogPagination.page + 1, 'overlay');
  }

  onCatalogPagePrev(): void {
    if (!this.isServerCatalogMode() || !this.cartridgeState.catalogPagination.hasPreviousPage) {
      return;
    }
    if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) {
      return;
    }
    this.loadCatalogPage(this.cartridgeState.catalogPagination.page - 1, 'overlay');
  }

  // Kept for compatibility but Refactored logic is in loadCartridges now
  // private loadAllAmmunition(): void { ... } 
  // private loadAllowanceItems(): void { ... }

  private loadReserveDetails(): void {
    if (!this.userContextState.currentUserDepartmentId) {
      return;
    }

    this.reserveDetailsState.loadingReserveDetails = true;
    this.cdr.markForCheck();
    this.cartridgeDataService.loadReserveDetails(this.userContextState.currentUserDepartmentId).subscribe({
      next: (result) => {
        this.reserveDetailsState.totalReserve = result.totalReserve;
        this.reserveDetailsState.availableReserve = result.availableReserve;
        this.reserveDetailsState.orderedQuantity = result.orderedQuantity;
        this.reserveDetailsState.usedQuantity = result.usedQuantity;
        this.reserveDetailsState.reserveDetailsByItem = result.reserveDetailsByItem;
        this.reserveDetailsState.loadingReserveDetails = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.reserveDetailsState.loadingReserveDetails = false;
        // Keep default values of 0
        this.reserveDetailsState.reserveDetailsByItem = [];
        this.cdr.markForCheck();
      }
    });
  }

  private loadRequestPurposes(): void {
    this.requestPurposeState.loadingRequestPurposes = true;
    this.cdr.markForCheck();

    this.dataService
      .loadRequestPurposes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (purposes) => {
          this.requestPurposeState.requestPurposesSource = purposes;
          this.rebuildRequestPurposeOptions();
          this.requestPurposeState.loadingRequestPurposes = false;
          this.updateUsePurposeFromSelection(this.requestPurposeState.selectedRequestPurposeId);
          this.cdr.markForCheck();
        },
        error: () => {
          this.requestPurposeState.requestPurposesSource = [];
          this.requestPurposeState.requestPurposeOptions = [];
          this.requestPurposeState.loadingRequestPurposes = false;
          this.updateUsePurposeFromSelection(null);
          this.cdr.markForCheck();
        }
      });
  }

  retryLoadCartridges(): void {
    if (!this.cartridgeState.loadingCartridges && !this.cartridgeState.catalogPageLoading) {
      this.loadCartridges();
    }
  }

  onCartridgeAdded(event: { cartridge: Cartridge; quantity: number }): void {
    const { cartridge, quantity } = event;
    // Cache the full cartridge data to preserve it across item type changes
    this.cartridgeState.selectedCartridgesCache.set(cartridge.id, { ...cartridge });
    this.cartridgeManagementService.addCartridge(cartridge, quantity, this.cartridgeState);
    this.cartridgeManagementService.persistSelections(this.cartridgeState.selectedEntries);
    // If adding a weapon and Training Order is selected, clear it (Training Order is not valid for weapons)
    const isWeapon = cartridge.itemType === 'Weapon' || !!(cartridge.weaponType || cartridge.caliber || cartridge.actionType);
    if (isWeapon && this.requestPurposeState.selectedRequestPurposeId === NewIssueRequestComponent.TRAINING_ORDER_ID) {
      this.requestPurposeState.selectedRequestPurposeId = null;
      this.usageFormData.usePurpose = '';
    }
    this.cdr.markForCheck();
  }

  private buildFilterOptions(): void {
    if (this.isServerCatalogMode()) {
      return;
    }
    const options = this.cartridgeDataService.buildFilterOptions(this.cartridgeState.allCartridges);
    this.filterOptions.bulletDiameters = options.bulletDiameters;
    this.filterOptions.natureOptions = options.natureOptions;
  }

  private initializeStepFromQueryParams(): void {
    this.stateService
      .getQueryParamsState(this.steps.length)
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        // If we're on step 4 (success page) but order is not actually submitted, reset to step 0
        // This handles the case where user navigates back after order creation or from sidebar
        if (params.step === 4 && !this.orderSubmissionState.orderSubmitted) {
          this.resetForm();
          this.clearQueryParams();
          this.cdr.markForCheck();
          return;
        }

        // Same route component can be reused after a successful submit; URL then shows step 0 while
        // in-memory wizard state still holds the previous order. Start a clean flow.
        if (this.orderSubmissionState.orderSubmitted && params.step === 0) {
          this.resetForm();
          if (this.route.snapshot.queryParamMap.keys.length > 0) {
            this.clearQueryParams();
            this.cdr.markForCheck();
            return;
          }
        }

        this.currentStep = params.step;
        this.fromReserve = params.fromReserve;
        this.pendingSelections = params.pendingSelections;

        // If we're on step 1 or later, we need to load cartridges
        // (step 0 is allowance selection, step 1 is cartridge selection)
        if (params.step >= 1 && this.cartridgeState.allCartridges.length === 0 && !this.cartridgeState.loadingCartridges) {
          this.loadCartridges();
        }

        // Ensure requester name is synced when navigating to review step (step 3)
        if (params.step === 3) {
          this.syncRequesterNameFromUserDetails();
        }
        this.cdr.markForCheck();
      });
  }

  private updateQueryParams(step: number): void {
    this.stateService.updateQueryParams(step, this.fromReserve, this.cartridgeState.selectedEntries);
  }

  /**
   * Persists selected entries to query params
   */
  private persistSelections(): void {
    this.cartridgeManagementService.persistSelections(this.cartridgeState.selectedEntries);
  }

  /**
   * Restores selected entries from pending selections and updates cartridge state
   */
  private restoreSelections(): void {
    if (!this.pendingSelections) {
      return;
    }

    this.stateService.restoreSelections(this.pendingSelections, this.cartridgeState);
    // Clear pending selections after restoration
    this.pendingSelections = null;
  }

  filterCartridges(): void {
    if (this.isServerCatalogMode()) {
      this.mergeSelectedWithList(this.cartridgeState.allCartridges);
      return;
    }
    const filtered = this.filterService.filterCartridges(
      this.cartridgeState.allCartridges,
      this.filterState
    );
    this.mergeSelectedWithList(filtered);
  }

  private mergeSelectedWithList(filtered: Cartridge[]): void {
    const selectedCartridges: Cartridge[] = [];
    const selectedIds = new Set<number>();
    const currentItemType = this.filterState.selectedItemType;

    const inferItemType = (cartridge: Cartridge): string | null => {
      if (cartridge.itemType) {
        return cartridge.itemType;
      }
      if (cartridge.weaponType || cartridge.caliber || cartridge.actionType) {
        return 'Weapon';
      }
      if (cartridge.explosiveType || cartridge.unNumber) {
        return 'Explosive';
      }
      if (cartridge.ammunitionType || cartridge.bulletDiameterLabel || cartridge.linkedLabel) {
        return 'Ammunition';
      }
      return null;
    };

    this.cartridgeState.selectedCartridgesCache.forEach((cachedCartridge, id) => {
      const cartridgeItemType = cachedCartridge.itemType || inferItemType(cachedCartridge);

      if (cartridgeItemType === currentItemType) {
        const cartridgeCopy = { ...cachedCartridge };
        cartridgeCopy.added = true;
        cartridgeCopy.selected = true;
        selectedCartridges.push(cartridgeCopy);
        selectedIds.add(id);
      }
    });

    const filteredWithoutSelected = filtered.filter(c => !selectedIds.has(c.id));
    this.cartridgeState.filteredCartridges = [...selectedCartridges, ...filteredWithoutSelected];
    this.cdr.markForCheck();
  }

  // Handlers
  onRemoveSelectedCartridge(cartridgeId: number): void {
    // Remove from cache as well
    this.cartridgeState.selectedCartridgesCache.delete(cartridgeId);
    this.cartridgeManagementService.removeCartridge(cartridgeId, this.cartridgeState);
    this.cartridgeManagementService.persistSelections(this.cartridgeState.selectedEntries);
    this.cdr.markForCheck();
  }

  onFilterSidebarChange(): void {
    if (!this.isServerCatalogMode()) {
      this.filterCartridges();
      return;
    }
    this.serverCatalogFilterApply$.next();
  }

  onClearFilters(): void {
    this.filterService.clearFilters(this.filterState, this.filterState.selectedItemType);
    if (this.isServerCatalogMode()) {
      if (this.cartridgeState.catalogPageLoading || this.cartridgeState.loadingCartridges) {
        return;
      }
      this.resetCatalogPagination();
      this.loadCatalogPage(1, 'overlay');
    } else {
      this.filterCartridges();
    }
  }

  onItemTypeChange(value: string): void {
    const prev = this.filterState.selectedItemType;
    if (prev !== value) {
      this.filterState.selectedItemType = value;
      this.filterService.clearFilters(this.filterState, value);
      this.cartridgeState.allCartridges = [];
      if (value !== 'Ammunition') {
        this.filterOptions.bulletDiameters = [];
        this.filterOptions.natureOptions = [];
      }
      this.loadCartridges();
    }
  }

  onStepChange(step: number): void {
    this.currentStep = step;
    this.updateQueryParams(step);
    this.cdr.markForCheck();
  }

  onFromReserveChange(value: string): void {
    const prev = this.fromReserve;
    if (prev !== value) {
      this.fromReserve = value;

      // If switching to reserve and weapon is selected, switch to ammunition
      if (value === 'Yes' && this.filterState.selectedItemType === 'Weapon') {
        this.filterState.selectedItemType = 'Ammunition';
        this.onClearFilters();
      }

      this.updateQueryParams(this.currentStep);
      this.cdr.markForCheck();
      // Force reload because switching from/to reserve changes data source
      // Only if we are past step 1
      if (this.currentStep >= 1) {
        this.loadCartridges();
      }
    }
  }

  onConfirmAllowanceSelection(): void {
    if (this.fromReserve === 'No' && this.filterState.selectedItemType === 'Weapon') {
      this.filterState.selectedItemType = 'Ammunition';
    }
    this.steps[0].completed = true;
    this.currentStep = 1;
    this.updateQueryParams(1);
    this.cdr.markForCheck();
    this.loadCartridges();
  }

  onConfirmSelection(): void {
    if (this.canProceedFromSelection) {
      this.steps[1].completed = true;
      this.currentStep = 2;
      this.updateQueryParams(2);
      this.cdr.markForCheck();
    }
  }

  onNext(): void {
    const navigationResult = this.navigationService.canProceedToNextStep(
      this.currentStep,
      this.canProceedFromSelection,
      this.orderSubmissionState.submittingOrder
    );

    if (!navigationResult.canProceed) {
      return;
    }

    // Step 0: Allowance selection
    if (this.currentStep === 0) {
      this.onConfirmAllowanceSelection();
      return;
    }

    // Step 3: Review -> Submit
    if (this.currentStep === 3) {
      this.onSubmitOrder();
      return;
    }

    if (navigationResult.nextStep !== undefined && this.currentStep < this.steps.length - 1) {
      this.steps[this.currentStep].completed = true;
      this.currentStep = navigationResult.nextStep;
      this.updateQueryParams(this.currentStep);
      this.cdr.markForCheck();
    }
  }

  onUsePurposeIdChange(value: number | null): void {
    this.requestPurposeState.selectedRequestPurposeId = value;
    this.updateUsePurposeFromSelection(value);
  }

  onPrevious(): void {
    const previousStep = this.navigationService.canGoToPreviousStep(this.currentStep);
    if (previousStep !== null) {
      this.currentStep = previousStep;
      this.updateQueryParams(this.currentStep);
      this.cdr.markForCheck();
    }
  }

  // Computed reserve details based on selected items
  get selectedItemsReserveDetails(): any[] {
    const selectedItemIds = this.cartridgeState.selectedEntries.map(entry => entry.id);
    return filterReserveDetailsBySelectedItems(
      this.reserveDetailsState.reserveDetailsByItem,
      selectedItemIds
    );
  }

  get selectedTotalReserve(): number {
    return computeTotalReserve(this.selectedItemsReserveDetails);
  }

  get selectedAvailableReserve(): number {
    return computeAvailableReserve(this.selectedItemsReserveDetails);
  }

  get selectedOrderedQuantity(): number {
    return computeOrderedQuantity(this.selectedItemsReserveDetails);
  }

  get selectedUsedQuantity(): number {
    return computeUsedQuantity(this.selectedItemsReserveDetails);
  }

  onSubmitOrder(): void {
    if (this.orderSubmissionState.submittingOrder) {
      return;
    }

    const submissionData = this.submissionService.buildSubmissionData(
      this.cartridgeState,
      this.requestPurposeState,
      this.usageFormData,
      this.reviewFormData,
      this.fromReserve,
      this.userContextState.currentUserDepartmentId,
      this.DEFAULT_DEPARTMENT_ID,
      this.DEFAULT_REQUEST_PURPOSE_ID,
      this.DEFAULT_REQUEST_TYPE_ID
    );

    const validation = this.orderSubmissionService.validateOrder(submissionData);
    if (!validation.isValid) {
      this.orderSubmissionState.orderSubmitError = validation.error ?? 'Validation failed';
      this.currentStep = 3;
      this.updateQueryParams(3);
      this.cdr.markForCheck();
      return;
    }

    // Show confirmation dialog
    this.submissionService.loadConfirmationDialogConfig().subscribe(config => {
      this.confirmDialogConfig = config;
      this.showConfirmDialog = true;
      this.cdr.markForCheck();
    });
  }

  onConfirmSubmit(): void {
    this.showConfirmDialog = false;
    this.cdr.markForCheck();
    this.submitOrderRequest();
  }

  onCancelConfirm(): void {
    this.showConfirmDialog = false;
    this.cdr.markForCheck();
  }

  private submitOrderRequest(): void {
    const submissionData = this.submissionService.buildSubmissionData(
      this.cartridgeState,
      this.requestPurposeState,
      this.usageFormData,
      this.reviewFormData,
      this.fromReserve,
      this.userContextState.currentUserDepartmentId,
      this.DEFAULT_DEPARTMENT_ID,
      this.DEFAULT_REQUEST_PURPOSE_ID,
      this.DEFAULT_REQUEST_TYPE_ID
    );

    this.submissionService
      .submitOrder(submissionData, this.usageFormFiles, this.orderSubmissionState)
      .subscribe({
        next: (result) => {
          this.orderSubmissionState.submittingOrder = false;
          if (result.success) {
            this.orderSubmissionState.createdOrderId = result.orderId ?? null;
            this.orderSubmissionState.orderNumber = result.orderNumber ?? null;
            this.orderSubmissionState.orderSubmitted = true;
            this.steps[3].completed = true;
            this.steps[4].completed = true;
            this.currentStep = 4;
            this.updateQueryParams(4);
          } else {
            const errorMsg = result.error || 'Failed to submit order. Please try again.';
            this.orderSubmissionState.orderSubmitError = errorMsg;
            this.currentStep = 3;
            this.updateQueryParams(3);
            this.translate.get('toast.error').subscribe(title => {
              this.toastService.error(errorMsg, title);
            });
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.orderSubmissionState.submittingOrder = false;
          const errorMsg = ErrorHandler.resolveOrderSubmissionError(undefined, error, 'Failed to submit order');
          this.orderSubmissionState.orderSubmitError = errorMsg;
          this.currentStep = 3;
          this.updateQueryParams(3);
          this.translate.get('toast.error').subscribe(title => {
            this.toastService.error(errorMsg, title);
          });
          this.cdr.markForCheck();
        }
      });
  }

  onTrackOrder(): void {
    // Reset form and navigate to dashboard
    this.resetForm();
    this.router.navigate(['/dashboard']);
  }

  private clearQueryParams(): void {
    // Navigate to the same route without query params to reset state
    // Use replaceUrl to avoid adding to browser history
    this.router.navigate(['/new-issue-request'], {
      queryParams: {},
      replaceUrl: true
    });
  }

  private syncRequesterNameFromUserDetails(): void {
    this.reviewFormData.requesterName = syncRequesterNameUtil(this.userContextState.currentUserDetails);
  }

  private requestPurposeOptionsMap: Map<number, { usePurpose: string }> = new Map();

  private rebuildRequestPurposeOptions(): void {
    this.requestPurposeOptionsMap = this.dataService.rebuildRequestPurposeOptions(this.requestPurposeState);
  }

  private rebuildOrderPriorities(): void {
    this.filterOptions.orderPriorities = this.dataService.rebuildOrderPriorities();
  }

  private updateUsePurposeFromSelection(id: number | null): void {
    this.dataService.updateUsePurposeFromSelection(id, this.requestPurposeOptionsMap, this.usageFormData);
  }

  private getDepartmentIdForRequest(): number {
    return getDepartmentIdForRequestUtil(
      this.userContextState.currentUserDepartmentId,
      this.DEFAULT_DEPARTMENT_ID
    );
  }

  private resetForm(): void {
    this.currentStep = 0;
    this.steps.forEach(s => s.completed = false);
    this.filterState = {
      selectedItemType: 'Ammunition',
      selectedAmmunitionType: '',
      selectedBulletDiameter: '',
      selectedLinked: '',
      selectedNature: '',
      selectedNSN: '',
      searchTerm: '',
      selectedWeaponType: '',
      selectedCaliber: '',
      selectedExplosiveType: '',
      selectedUNNumber: ''
    };
    this.cartridgeState.selectedEntries = [];
    this.cartridgeState.allCartridges = [];
    this.cartridgeState.filteredCartridges = [];
    this.cartridgeState.selectedCartridgeForView = null;
    this.cartridgeState.showCartridgeDetails = false;
    this.cartridgeState.loadingCartridges = false;
    this.cartridgeState.catalogPageLoading = false;
    this.cartridgeState.cartridgeError = null;
    this.cartridgeState.selectedCartridgesCache.clear();
    this.cartridgeState.catalogPagination = {
      page: 1,
      pageSize: defaultPageSize,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };
    this.fromReserve = 'Yes'; // Reset to default
    this.usageFormData = {
      usePurpose: '',
      usageLocation: '',
      numberOfOfficers: null,
      numberOfOtherRanks: null,
      usageDateFrom: '',
      usageTimeFrom: '',
      usageDateTo: '',
      usageTimeTo: '',
      orderPriority: ''
    };
    this.usageFormFiles = [];
    this.requestPurposeState.selectedRequestPurposeId = null;
    this.updateUsePurposeFromSelection(null);
    this.reserveDetailsState = {
      totalReserve: 0,
      availableReserve: 0,
      orderedQuantity: 0,
      usedQuantity: 0,
      loadingReserveDetails: false,
      reserveDetailsByItem: []
    };
    this.allowanceError = null;
    this.showConfirmDialog = false;
    // Reset order submission state
    this.orderSubmissionState = {
      submittingOrder: false,
      orderSubmitError: null,
      createdOrderId: null,
      orderNumber: null,
      orderSubmitted: false
    };
    this.reviewFormData = {
      requesterName: '',
      requesterComments: '',
      orderType: 'New Issue Request',
      orderDocument: ''
    };
    this.pendingSelections = null;
    this.syncRequesterNameFromUserDetails();
  }
}
