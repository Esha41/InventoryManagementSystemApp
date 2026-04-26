import {
  Component,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Optional,
  Inject
} from '@angular/core';
import { Cartridge } from '@models/cartridge.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StepperComponent, Step } from '@components/stepper/stepper.component';
import { UsageFormComponent } from './components/usage-form/usage-form.component';
import { ReviewFormComponent } from './components/review-form/review-form.component';
import { AllowanceSelectionComponent } from './components/allowance-selection/allowance-selection.component';
import { OrderSuccessComponent } from './components/order-success/order-success.component';
import { StepSelectionComponent } from './components/step-selection/step-selection.component';
import { ErrorBannerComponent } from './components/error-banner/error-banner.component';
import { Subject, takeUntil } from 'rxjs';
import { CartridgeDataService } from '@assets/services/cartridge-data.service';
import { IssueRequestStateService } from '@requests/services/issue-request-state.service';
import { IssueRequestDataService } from '@requests/services/issue-request-data.service';
import { IssueRequestNavigationService } from '@requests/services/issue-request-navigation.service';
import { IssueRequestUserContextService } from '@requests/services/issue-request-user-context.service';
import { IssueRequestCartridgeManagementService } from '@requests/services/issue-request-cartridge-management.service';
import { IssueRequestSubmissionService } from '@requests/services/issue-request-submission.service';
import {
  IssueRequestCatalogOrchestratorService,
  CatalogOrchestratorContext,
  CatalogLoadHooks
} from '@requests/services/issue-request-catalog-orchestrator.service';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import {
  ExtendedFilterState,
  ExtendedFilterOptions,
  CartridgeState,
  UsageFormData,
  ReserveDetailsState,
  UserContextState,
  RequestPurposeState,
  OrderSubmissionState,
  ReviewFormData,
  ConfirmDialogConfig,
  createInitialFilterState,
  createInitialFilterOptions,
  createInitialCartridgeState,
  createInitialUsageFormData,
  createInitialReserveDetailsState,
  createInitialUserContextState,
  createInitialRequestPurposeState,
  createInitialOrderSubmissionState,
  createInitialReviewFormData,
  createInitialConfirmDialogConfig
} from './new-issue-request.state';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { getWeaponTypeOptions } from '@utils/weapon.utils';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';
import { ConfirmationDialogComponent } from '@components/confirmation-dialog/confirmation-dialog.component';
import {
  mapSelectedEntriesToCartridges,
  filterReserveDetailsBySelectedItems,
  computeTotalReserve,
  computeAvailableReserve,
  computeOrderedQuantity,
  computeUsedQuantity,
  resolveCurrentRequesterName,
  syncRequesterNameFromUserDetails as syncRequesterNameUtil,
  hasWeaponInSelection,
  getDisplayedItemTypeOptions,
  getDisplayedUsePurposeOptions,
  canProceedFromSelection
} from '@requests/utils/issue-request.utils';

@Component({
  selector: 'app-new-issue-request',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
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
  private pendingSelections: Array<{ id: number; quantity: number }> | null = null;
  /** Triggers a debounced server refilter; wired up in ngOnInit. */
  private requestServerRefilter: () => void = () => undefined;
  private requestPurposeOptionsMap: Map<number, { usePurpose: string }> = new Map();

  private readonly DEFAULT_DEPARTMENT_ID = 1;
  private readonly DEFAULT_REQUEST_PURPOSE_ID = 1;
  private readonly DEFAULT_REQUEST_TYPE_ID = 1;
  /** Training Order (ID 4) is not valid for weapon orders. */
  private static readonly TRAINING_ORDER_ID = 4;

  currentStep = 0;
  steps: Step[] = [
    { label: 'newIssueRequest.allowanceSelection', completed: false },
    { label: 'newIssueRequest.selection', completed: false },
    { label: 'newIssueRequest.usage', completed: false },
    { label: 'newIssueRequest.review', completed: false },
    { label: 'newIssueRequest.send', completed: false }
  ];

  filterState: ExtendedFilterState = createInitialFilterState();
  filterOptions: ExtendedFilterOptions = createInitialFilterOptions();
  cartridgeState: CartridgeState = createInitialCartridgeState();
  usageFormData: UsageFormData = createInitialUsageFormData();
  usageFormFiles: File[] = [];
  reserveDetailsState: ReserveDetailsState = createInitialReserveDetailsState();
  userContextState: UserContextState = createInitialUserContextState();
  requestPurposeState: RequestPurposeState = createInitialRequestPurposeState();
  orderSubmissionState: OrderSubmissionState = createInitialOrderSubmissionState();
  reviewFormData: ReviewFormData = createInitialReviewFormData();
  confirmDialogConfig: ConfirmDialogConfig = createInitialConfirmDialogConfig();

  showConfirmDialog = false;
  fromReserve: string = 'Yes';
  allowanceError: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private cartridgeDataService: CartridgeDataService,
    private stateService: IssueRequestStateService,
    private dataService: IssueRequestDataService,
    private navigationService: IssueRequestNavigationService,
    private issueRequestUserContextService: IssueRequestUserContextService,
    private cartridgeManagementService: IssueRequestCartridgeManagementService,
    private submissionService: IssueRequestSubmissionService,
    private catalogOrchestrator: IssueRequestCatalogOrchestratorService,
    private cdr: ChangeDetectorRef,
    @Optional() @Inject(ONBOARDING_TOUR) private onboardingTourService: IOnboardingTourProvider | null
  ) { }

  // ---- Computed view state -------------------------------------------------

  get selectedCartridges(): Cartridge[] {
    return mapSelectedEntriesToCartridges(
      this.cartridgeState.selectedEntries,
      this.cartridgeState.allCartridges,
      this.cartridgeState.selectedCartridgesCache
    );
  }

  get displayedItemTypeOptions(): string[] {
    return getDisplayedItemTypeOptions(this.filterOptions.itemTypeOptions, this.fromReserve);
  }

  get displayedUsePurposeOptions(): DropdownOption<number>[] {
    return getDisplayedUsePurposeOptions(
      this.requestPurposeState.requestPurposeOptions,
      this.selectedCartridges,
      NewIssueRequestComponent.TRAINING_ORDER_ID
    );
  }

  get canProceedFromSelection(): boolean {
    return canProceedFromSelection(this.cartridgeState.selectedEntries);
  }

  get currentRequesterName(): string {
    return resolveCurrentRequesterName(
      this.userContextState.currentUserDetails,
      this.userContextState.fallbackRequesterName,
      this.reviewFormData.requesterName
    );
  }

  get selectedItemsReserveDetails(): any[] {
    const selectedItemIds = this.cartridgeState.selectedEntries.map(entry => entry.id);
    return filterReserveDetailsBySelectedItems(this.reserveDetailsState.reserveDetailsByItem, selectedItemIds);
  }

  get selectedTotalReserve(): number { return computeTotalReserve(this.selectedItemsReserveDetails); }
  get selectedAvailableReserve(): number { return computeAvailableReserve(this.selectedItemsReserveDetails); }
  get selectedOrderedQuantity(): number { return computeOrderedQuantity(this.selectedItemsReserveDetails); }
  get selectedUsedQuantity(): number { return computeUsedQuantity(this.selectedItemsReserveDetails); }

  // ---- Lifecycle -----------------------------------------------------------

  ngAfterViewInit(): void {
    setTimeout(() => this.onboardingTourService?.checkAndStartPageTour('issue-request'), 300);
  }

  ngOnInit(): void {
    this.initializeUserContext();
    this.initializeStepFromQueryParams();
    this.loadRequestPurposes();
    this.rebuildOrderPriorities();

    this.filterOptions.weaponTypeOptions = getWeaponTypeOptions() as any;
    this.filterOptions.explosiveTypeOptions = getExplosiveTypeOptions() as any;

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.rebuildRequestPurposeOptions();
        this.rebuildOrderPriorities();
        this.updateUsePurposeFromSelection(this.requestPurposeState.selectedRequestPurposeId);
      });

    this.requestServerRefilter = this.catalogOrchestrator.setupFilterDebounce(
      () => this.catalogCtx,
      this.destroy$,
      () => this.catalogHooks
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- Catalog orchestration (delegates to orchestrator) -------------------

  private get catalogCtx(): CatalogOrchestratorContext {
    return {
      cartridgeState: this.cartridgeState,
      filterState: this.filterState,
      filterOptions: this.filterOptions,
      fromReserve: this.fromReserve,
      departmentId: this.userContextState.currentUserDepartmentId,
      cdr: this.cdr
    };
  }

  /**
   * Hooks fed to every catalog load. `onAfterLoad` always runs once data
   * arrives (even on a soft error response) and is where allowance-mode
   * reserve details get refreshed; `onLoadSuccess` only fires on a clean
   * response and restores any selections persisted in the URL.
   */
  private get catalogHooks(): CatalogLoadHooks {
    return {
      onAfterLoad: () => {
        if (this.fromReserve === 'Yes' && this.userContextState.currentUserDepartmentId) {
          this.loadReserveDetails();
        }
      },
      onLoadSuccess: () => {
        if (this.pendingSelections) {
          this.catalogOrchestrator.restoreSelections(this.pendingSelections, this.catalogCtx);
          this.pendingSelections = null;
        }
      }
    };
  }

  private loadCartridges(): void {
    this.catalogOrchestrator.loadCartridges(this.catalogCtx, this.catalogHooks);
  }

  retryLoadCartridges(): void {
    if (!this.cartridgeState.loadingCartridges && !this.cartridgeState.catalogPageLoading) {
      this.loadCartridges();
    }
  }

  applyCatalogSearch(searchTerm?: string): void {
    this.catalogOrchestrator.applyCatalogSearch(searchTerm, this.catalogCtx, this.catalogHooks);
  }

  onCatalogPageNext(): void {
    this.catalogOrchestrator.onCatalogPageNext(this.catalogCtx, this.catalogHooks);
  }

  onCatalogPagePrev(): void {
    this.catalogOrchestrator.onCatalogPagePrev(this.catalogCtx, this.catalogHooks);
  }

  filterCartridges(): void {
    this.catalogOrchestrator.filterCartridges(this.catalogCtx);
  }

  onFilterSidebarChange(): void {
    if (this.fromReserve !== 'No') {
      this.filterCartridges();
      return;
    }
    this.requestServerRefilter();
  }

  onClearFilters(): void {
    this.catalogOrchestrator.handleClearFilters(this.catalogCtx, this.catalogHooks);
  }

  onItemTypeChange(value: string): void {
    this.catalogOrchestrator.handleItemTypeChange(value, this.catalogCtx, this.catalogHooks);
  }

  onFromReserveChange(value: string): void {
    if (this.fromReserve === value) {
      return;
    }
    this.fromReserve = value;

    // Switching to reserve while a weapon is selected isn't valid; revert
    // the catalog to ammunition and clear filters before reloading.
    if (value === 'Yes' && this.filterState.selectedItemType === 'Weapon') {
      this.filterState.selectedItemType = 'Ammunition';
      this.onClearFilters();
    }

    this.updateQueryParams(this.currentStep);
    this.cdr.markForCheck();
    if (this.currentStep >= 1) {
      this.loadCartridges();
    }
  }

  // ---- Selection handlers --------------------------------------------------

  onCartridgeAdded(event: { cartridge: Cartridge; quantity: number }): void {
    const { cartridge, quantity } = event;
    this.cartridgeState.selectedCartridgesCache.set(cartridge.id, { ...cartridge });
    this.cartridgeManagementService.addCartridge(cartridge, quantity, this.cartridgeState);
    this.cartridgeManagementService.persistSelections(this.cartridgeState.selectedEntries);

    // Adding a weapon while Training Order is the active use-purpose clears
    // the use-purpose; Training Order is invalid for weapon requests.
    const isWeapon = hasWeaponInSelection([cartridge]);
    if (isWeapon && this.requestPurposeState.selectedRequestPurposeId === NewIssueRequestComponent.TRAINING_ORDER_ID) {
      this.requestPurposeState.selectedRequestPurposeId = null;
      this.usageFormData.usePurpose = '';
    }
    this.cdr.markForCheck();
  }

  onRemoveSelectedCartridge(cartridgeId: number): void {
    this.cartridgeState.selectedCartridgesCache.delete(cartridgeId);
    this.cartridgeManagementService.removeCartridge(cartridgeId, this.cartridgeState);
    this.cartridgeManagementService.persistSelections(this.cartridgeState.selectedEntries);
    this.cdr.markForCheck();
  }

  // ---- Step navigation -----------------------------------------------------

  onStepChange(step: number): void {
    this.currentStep = step;
    this.updateQueryParams(step);
    this.cdr.markForCheck();
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

    if (this.currentStep === 0) {
      this.onConfirmAllowanceSelection();
      return;
    }

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

  onPrevious(): void {
    const previousStep = this.navigationService.canGoToPreviousStep(this.currentStep);
    if (previousStep !== null) {
      this.currentStep = previousStep;
      this.updateQueryParams(this.currentStep);
      this.cdr.markForCheck();
    }
  }

  onUsePurposeIdChange(value: number | null): void {
    this.requestPurposeState.selectedRequestPurposeId = value;
    this.updateUsePurposeFromSelection(value);
  }

  // ---- Submission ---------------------------------------------------------

  onSubmitOrder(): void {
    if (this.orderSubmissionState.submittingOrder) {
      return;
    }

    // Pre-validate before showing the confirmation dialog so the user sees
    // the error inline on step 3 instead of confirming a doomed submission.
    const validation = this.submissionService.validateSubmission(this.buildRunSubmissionContext());
    if (!validation.isValid) {
      this.orderSubmissionState.orderSubmitError = validation.error ?? 'Validation failed';
      this.currentStep = 3;
      this.updateQueryParams(3);
      this.cdr.markForCheck();
      return;
    }

    this.submissionService.loadConfirmationDialogConfig().subscribe(config => {
      this.confirmDialogConfig = config;
      this.showConfirmDialog = true;
      this.cdr.markForCheck();
    });
  }

  private buildRunSubmissionContext() {
    return {
      cartridgeState: this.cartridgeState,
      requestPurposeState: this.requestPurposeState,
      usageFormData: this.usageFormData,
      reviewFormData: this.reviewFormData,
      fromReserve: this.fromReserve,
      currentUserDepartmentId: this.userContextState.currentUserDepartmentId,
      defaultDepartmentId: this.DEFAULT_DEPARTMENT_ID,
      defaultRequestPurposeId: this.DEFAULT_REQUEST_PURPOSE_ID,
      defaultRequestTypeId: this.DEFAULT_REQUEST_TYPE_ID,
      files: this.usageFormFiles,
      orderSubmissionState: this.orderSubmissionState
    };
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
    this.submissionService.runSubmission(
      this.buildRunSubmissionContext(),
      {
        onSuccess: (orderId, orderNumber) => {
          this.orderSubmissionState.createdOrderId = orderId;
          this.orderSubmissionState.orderNumber = orderNumber;
          this.orderSubmissionState.orderSubmitted = true;
          this.steps[3].completed = true;
          this.steps[4].completed = true;
          this.currentStep = 4;
          this.updateQueryParams(4);
          this.cdr.markForCheck();
        },
        onValidationFailure: (message) => {
          this.orderSubmissionState.orderSubmitError = message;
          this.currentStep = 3;
          this.updateQueryParams(3);
          this.cdr.markForCheck();
        },
        onTransportError: (message) => {
          this.orderSubmissionState.orderSubmitError = message;
          this.currentStep = 3;
          this.updateQueryParams(3);
          this.cdr.markForCheck();
        }
      }
    );
  }

  onTrackOrder(): void {
    this.resetForm();
    this.router.navigate(['/dashboard']);
  }

  // ---- Data + auxiliary flows ---------------------------------------------

  private initializeUserContext(): void {
    this.issueRequestUserContextService.initializeUserContext(
      this.userContextState,
      this.destroy$,
      () => this.syncRequesterNameFromUserDetails()
    );
  }

  private initializeStepFromQueryParams(): void {
    this.stateService
      .getQueryParamsState(this.steps.length)
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
       
        if (params.step === 4 && !this.orderSubmissionState.orderSubmitted) {
          this.resetForm();
          this.clearQueryParams();
          this.cdr.markForCheck();
          return;
        }

      
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

        if (params.step >= 1 && this.cartridgeState.allCartridges.length === 0 && !this.cartridgeState.loadingCartridges) {
          this.loadCartridges();
        }

        if (params.step === 3) {
          this.syncRequesterNameFromUserDetails();
        }
        this.cdr.markForCheck();
      });
  }

  private updateQueryParams(step: number): void {
    this.stateService.updateQueryParams(step, this.fromReserve, this.cartridgeState.selectedEntries);
  }

  private clearQueryParams(): void {
    this.router.navigate(['/requests/new-issue-request'], {
      queryParams: {},
      replaceUrl: true
    });
  }

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

  private rebuildRequestPurposeOptions(): void {
    this.requestPurposeOptionsMap = this.dataService.rebuildRequestPurposeOptions(this.requestPurposeState);
  }

  private rebuildOrderPriorities(): void {
    this.filterOptions.orderPriorities = this.dataService.rebuildOrderPriorities();
  }

  private updateUsePurposeFromSelection(id: number | null): void {
    this.dataService.updateUsePurposeFromSelection(id, this.requestPurposeOptionsMap, this.usageFormData);
  }

  private syncRequesterNameFromUserDetails(): void {
    this.reviewFormData.requesterName = syncRequesterNameUtil(this.userContextState.currentUserDetails);
  }
  
  private resetForm(): void {
    this.currentStep = 0;
    this.steps.forEach(s => s.completed = false);
    this.filterState = createInitialFilterState();
    this.cartridgeState = createInitialCartridgeState();
    this.fromReserve = 'Yes';
    this.usageFormData = createInitialUsageFormData();
    this.usageFormFiles = [];
    this.requestPurposeState.selectedRequestPurposeId = null;
    this.updateUsePurposeFromSelection(null);
    this.reserveDetailsState = createInitialReserveDetailsState();
    this.allowanceError = null;
    this.showConfirmDialog = false;
    this.orderSubmissionState = createInitialOrderSubmissionState();
    this.reviewFormData = createInitialReviewFormData();
    this.pendingSelections = null;
    this.syncRequesterNameFromUserDetails();
  }
}
