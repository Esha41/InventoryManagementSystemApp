import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { StepperComponent, Step } from '@components/stepper/stepper.component';
import { CartridgeDetailsComponent } from './components/cartridge-details/cartridge-details.component';
import { CartridgeListComponent, Cartridge } from './components/cartridge-list/cartridge-list.component';
import { UsageFormComponent } from './components/usage-form/usage-form.component';
import { ReviewFormComponent } from './components/review-form/review-form.component';
import { AllowanceSelectionComponent } from './components/allowance-selection/allowance-selection.component';
import { OrderSuccessComponent } from './components/order-success/order-success.component';
import { ErrorBannerComponent } from './components/error-banner/error-banner.component';
import { Subject, takeUntil } from 'rxjs';
import { CartridgeDataService } from '@services/cartridge-data.service';
import { OrderSubmissionService } from '@services/order-submission.service';
import { APIOperationResponse } from '@models/api-response.model';
import { IssueRequestFilterService } from '@services/issue-request-filter.service';
import { IssueRequestStateService } from '@services/issue-request-state.service';
import { IssueRequestDataService } from '@services/issue-request-data.service';
import { IssueRequestNavigationService } from '@services/issue-request-navigation.service';
import { IssueRequestUserContextService } from '@services/issue-request-user-context.service';
import { IssueRequestCartridgeLoaderService } from '@services/issue-request-cartridge-loader.service';
import { IssueRequestCartridgeManagementService } from '@services/issue-request-cartridge-management.service';
import { IssueRequestSubmissionService } from '@services/issue-request-submission.service';
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
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { getWeaponTypeOptions } from '@utils/weapon.utils';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';
import { ConfirmationDialogComponent, ConfirmationType } from '@components/confirmation-dialog/confirmation-dialog.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
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
    ButtonComponent,
    StepperComponent,
    CartridgeDetailsComponent,
    CartridgeListComponent,
    UsageFormComponent,
    ReviewFormComponent,
    AllowanceSelectionComponent,
    OrderSuccessComponent,
    ErrorBannerComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    HasPermissionDirective,
    ConfirmationDialogComponent
  ],
  templateUrl: './new-issue-request.component.html',
  styleUrls: ['./new-issue-request.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewIssueRequestComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
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
    private cdr: ChangeDetectorRef
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
    ammunitionTypeOptions: ['Small', 'Medium', 'Large'], // These map to backend Enums often
    bulletDiameters: [],
    linkedOptions: ['Linked', 'Not Linked'],
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
    cartridgeError: null,
    selectedEntries: []
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
      this.cartridgeState.allCartridges
    );
  }

  get displayedItemTypeOptions(): string[] {
    if (this.fromReserve === 'Yes') {
      return this.filterOptions.itemTypeOptions.filter(opt => opt !== 'Weapon');
    }
    return this.filterOptions.itemTypeOptions;
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

  private loadCartridges(): void {
    this.cartridgeState.loadingCartridges = true;
    this.cartridgeState.cartridgeError = null;
    this.cdr.markForCheck();

    const type = this.filterState.selectedItemType;
    const isAllowance = this.fromReserve === 'Yes';
    const deptId = this.userContextState.currentUserDepartmentId;

    this.cartridgeLoaderService
      .loadCartridges(type, isAllowance, deptId)
      .subscribe({
        next: (result: any) => {
          this.cartridgeState.allCartridges = result.cartridges;
          this.buildFilterOptions(); // rebuilds dynamic filters like Diameter/Nature
          this.filterCartridges();

          // Load reserve details if from allowance
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
    if (!this.cartridgeState.loadingCartridges) {
      this.loadCartridges();
    }
  }

  onCartridgeAdded(event: { cartridge: Cartridge; quantity: number }): void {
    const { cartridge, quantity } = event;
    this.cartridgeManagementService.addCartridge(cartridge, quantity, this.cartridgeState);
    this.cartridgeManagementService.persistSelections(this.cartridgeState.selectedEntries);
    this.cdr.markForCheck();
  }

  private buildFilterOptions(): void {
    const options = this.cartridgeDataService.buildFilterOptions(this.cartridgeState.allCartridges);
    this.filterOptions.bulletDiameters = options.bulletDiameters;
    this.filterOptions.natureOptions = options.natureOptions;
    // Weapon/Explosive types are static/enum based loaded in OnInit
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
    this.cartridgeState.filteredCartridges = this.filterService.filterCartridges(
      this.cartridgeState.allCartridges,
      this.filterState
    );
    this.cdr.markForCheck();
  }

  // Handlers invoked from child component outputs
  onBulletDiameterChange(value: string): void {
    this.filterState.selectedBulletDiameter = value;
    this.filterCartridges();
  }

  onLinkedChange(value: string): void {
    this.filterState.selectedLinked = value;
    this.filterCartridges();
  }

  onNatureChange(value: string): void {
    this.filterState.selectedNature = value;
    this.filterCartridges();
  }

  onNSNChange(value: string): void {
    this.filterState.selectedNSN = value;
    this.filterCartridges();
  }

  onSearchChange(value: string): void {
    this.filterState.searchTerm = value;
    this.filterCartridges();
  }

  onCartridgeClick(cartridge: Cartridge): void {
    this.cartridgeState.selectedCartridgeForView = cartridge;
    this.cartridgeState.showCartridgeDetails = true;
    this.cdr.markForCheck();
  }

  onCloseCartridgeDetails(): void {
    this.cartridgeState.showCartridgeDetails = false;
    this.cartridgeState.selectedCartridgeForView = null;
    this.cdr.markForCheck();
  }

  onSelectCartridge(): void {
    if (!this.cartridgeState.selectedCartridgeForView) {
      return;
    }

    const cartridge = this.cartridgeState.allCartridges.find(c => c.id === this.cartridgeState.selectedCartridgeForView?.id) || this.cartridgeState.selectedCartridgeForView;
    const quantity = cartridge.quantity && cartridge.quantity > 0 ? cartridge.quantity : 1;
    this.onCartridgeAdded({ cartridge, quantity });

    this.cartridgeState.showCartridgeDetails = false;
    this.cartridgeState.selectedCartridgeForView = null;
    this.cdr.markForCheck();
  }

  onRemoveSelectedCartridge(cartridgeId: number): void {
    this.cartridgeManagementService.removeCartridge(cartridgeId, this.cartridgeState);
    this.cartridgeManagementService.persistSelections(this.cartridgeState.selectedEntries);
    this.cdr.markForCheck();
  }

  onAllowanceError(errorMessage: string): void {
    this.allowanceError = errorMessage;
    this.cdr.markForCheck();
    // Clear error after 5 seconds
    setTimeout(() => {
      this.allowanceError = null;
      this.cdr.markForCheck();
    }, 5000);
  }

  onClearFilters(): void {
    this.filterService.clearFilters(this.filterState, this.filterState.selectedItemType);
    this.filterCartridges();
  }



  onItemTypeChange(value: string): void {
    const prev = this.filterState.selectedItemType;
    if (prev !== value) {
      this.filterState.selectedItemType = value;
      // Reset filters
      this.onClearFilters();

      // RELOAD data for new type
      // Reset cartridge loading state?
      this.cartridgeState.allCartridges = [];
      this.loadCartridges();
    }
  }

  onAmmunitionTypeChange(value: string): void {
    this.filterState.selectedAmmunitionType = value;
    this.filterCartridges();
  }

  onWeaponTypeChange(value: string): void {
    this.filterState.selectedWeaponType = value;
    this.filterCartridges();
  }

  onCaliberChange(value: string): void {
    this.filterState.selectedCaliber = value;
    this.filterCartridges();
  }

  onExplosiveTypeChange(value: string): void {
    this.filterState.selectedExplosiveType = value;
    this.filterCartridges();
  }

  onUnNumberChange(value: string): void {
    this.filterState.selectedUNNumber = value;
    this.filterCartridges();
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
            this.orderSubmissionState.orderSubmitError = result.error || 'Failed to submit order. Please try again.';
            this.currentStep = 3;
            this.updateQueryParams(3);
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.orderSubmissionState.submittingOrder = false;
          this.orderSubmissionState.orderSubmitError = error.error || 'Failed to submit order. Please try again.';
          this.currentStep = 3;
          this.updateQueryParams(3);
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
    this.cartridgeState.selectedEntries = [];
    this.cartridgeState.allCartridges = [];
    this.cartridgeState.filteredCartridges = [];
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
  }
}
