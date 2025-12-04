import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { UserContextService } from '@services/user-context.service';
import { BackendUserDto } from '@models/backend-user.model';
import { BackendAuthService } from '@services/backend-auth.service';
import { AuthenticatedUser } from '@models/auth.model';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { CartridgeDataService } from '@services/cartridge-data.service';
import { OrderSubmissionService } from '@services/order-submission.service';
import { APIOperationResponse } from '@models/api-response.model';
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
import { toNumber, normalizeArrayResponse, getLocalizedNameFromItem, resolveUserDisplayName, getAmmunitionTypeId } from '@utils/index';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

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
    HasPermissionDirective
  ],
  templateUrl: './new-issue-request.component.html',
  styleUrls: ['./new-issue-request.component.css']
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
    private userContextService: UserContextService,
    private backendAuthService: BackendAuthService,
    private apiService: ApiService,
    private translate: TranslateService,
    private cartridgeDataService: CartridgeDataService,
    private orderSubmissionService: OrderSubmissionService
  ) {}

  // Grouped state objects
  filterState: FilterState = {
    selectedItemType: 'Ammunition',
    selectedAmmunitionType: '',
    selectedBulletDiameter: '',
    selectedCaseLength: '',
    selectedLinked: '',
    selectedNature: '',
    selectedNSN: '',
    searchTerm: ''
  };

  filterOptions: FilterOptions = {
    itemTypeOptions: ['Ammunition', 'Explosives', 'Weapons'],
    ammunitionTypeOptions: ['Small', 'Medium', 'Large'],
    bulletDiameters: [],
    caseLengths: [],
    linkedOptions: ['Linked', 'Not Linked'],
    natureOptions: [],
    orderPriorities: ['High Priority', 'Medium Priority', 'Low Priority']
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
    return this.cartridgeState.selectedEntries
      .map(entry => {
        const cartridge = this.cartridgeState.allCartridges.find(c => c.id === entry.id);
        if (cartridge) {
          return { ...cartridge, quantity: entry.quantity };
        }
        return {
          id: entry.id,
          name: `#${entry.id}`,
          selected: true,
          quantity: entry.quantity
        } as Cartridge;
      });
  }

  get canProceedFromSelection(): boolean {
    const hasSelection = this.cartridgeState.selectedEntries.length > 0;
    const quantitiesValid = this.cartridgeState.selectedEntries.every(entry => entry.quantity > 0);
    return hasSelection && quantitiesValid;
  }

  get currentRequesterName(): string {

    return resolveUserDisplayName(
      this.userContextState.currentUserDetails?.nameEn,
      this.userContextState.currentUserDetails?.nameAr,
      this.userContextState.currentUserDetails?.userName
    ) || this.userContextState.fallbackRequesterName || this.reviewFormData.requesterName || '';
  }

  ngOnInit(): void {
    this.initializeUserContext();
    this.initializeStepFromQueryParams();
    this.loadRequestPurposes();
    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.rebuildRequestPurposeOptions();
        this.updateUsePurposeFromSelection(this.requestPurposeState.selectedRequestPurposeId);
      });
    // Don't load cartridges yet - wait for allowance selection
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeUserContext(): void {
    this.userContextState.isAdminUser = this.userContextService.isAdminUser();
    this.userContextState.lockRequesterName = !this.userContextState.isAdminUser;

    this.backendAuthService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => this.applyAuthenticatedUserContext(user));

    this.userContextService
      .getCurrentUserDetails()
      .pipe(takeUntil(this.destroy$))
      .subscribe(details => {
        this.userContextState.currentUserDetails = details;
        this.applyBackendUserDetails(details);
      });
  }

  private loadCartridges(): void {
    this.cartridgeState.loadingCartridges = true;
    this.cartridgeState.cartridgeError = null;

    if (this.fromReserve === 'Yes') {
      this.loadAllowanceItems();
    } else {
      this.loadAllAmmunition();
    }
  }

  private loadAllAmmunition(): void {
    this.cartridgeDataService.loadAllAmmunition().subscribe({
      next: (result) => {
        this.cartridgeState.allCartridges = result.cartridges;
        this.buildFilterOptions();
        this.filterCartridges();
        this.cartridgeState.loadingCartridges = false;
        if (result.error) {
          this.cartridgeState.cartridgeError = result.error;
        } else {
          // Restore selections after cartridges are loaded
          this.restoreSelections();
        }
      },
      error: (error) => {
        this.cartridgeState.allCartridges = [];
        this.cartridgeState.filteredCartridges = [];
        this.cartridgeState.loadingCartridges = false;
        this.cartridgeState.cartridgeError = error.error || 'Failed to load ammunition catalog. Please try again.';
      }
    });
  }

  private loadAllowanceItems(): void {
    // Validate department
    if (!this.userContextState.currentUserDepartmentId) {
      this.cartridgeState.cartridgeError = 'Department not found for current user. Please contact support.';
      this.cartridgeState.loadingCartridges = false;
      return;
    }

    this.cartridgeDataService.loadAllowanceItems(this.userContextState.currentUserDepartmentId).subscribe({
      next: (result) => {
        this.cartridgeState.allCartridges = result.cartridges;
        this.buildFilterOptions();
        this.filterCartridges();
        this.cartridgeState.loadingCartridges = false;
        if (result.error) {
          this.cartridgeState.cartridgeError = result.error;
        } else {
          // Load reserve details after loading allowance items
          this.loadReserveDetails();
          // Restore selections after cartridges are loaded
          this.restoreSelections();
        }
      },
      error: (error) => {
        this.cartridgeState.allCartridges = [];
        this.cartridgeState.filteredCartridges = [];
        this.cartridgeState.loadingCartridges = false;
        this.cartridgeState.cartridgeError = error.error || 'Failed to load allowance items. Please try again.';
      }
    });
  }

  private loadReserveDetails(): void {
    if (!this.userContextState.currentUserDepartmentId) {
      return;
    }

    this.reserveDetailsState.loadingReserveDetails = true;
    this.cartridgeDataService.loadReserveDetails(this.userContextState.currentUserDepartmentId).subscribe({
      next: (result) => {
        this.reserveDetailsState.totalReserve = result.totalReserve;
        this.reserveDetailsState.availableReserve = result.availableReserve;
        this.reserveDetailsState.orderedQuantity = result.orderedQuantity;
        this.reserveDetailsState.usedQuantity = result.usedQuantity;
        this.reserveDetailsState.reserveDetailsByItem = result.reserveDetailsByItem;
        this.reserveDetailsState.loadingReserveDetails = false;
      },
      error: () => {
        this.reserveDetailsState.loadingReserveDetails = false;
        // Keep default values of 0
        this.reserveDetailsState.reserveDetailsByItem = [];
      }
    });
  }

  private loadRequestPurposes(): void {
    this.requestPurposeState.loadingRequestPurposes = true;

    this.apiService
      .getWithAuth<APIOperationResponse<RequestPurposeDto[]>>(
        API_ENDPOINTS.REQUEST_PURPOSES.FOR_ORDER
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const purposes = normalizeArrayResponse<RequestPurposeDto>(response);
          this.requestPurposeState.requestPurposesSource = purposes;
          this.rebuildRequestPurposeOptions();
          this.requestPurposeState.loadingRequestPurposes = false;
          this.updateUsePurposeFromSelection(this.requestPurposeState.selectedRequestPurposeId);
        },
        error: () => {
          this.requestPurposeState.requestPurposesSource = [];
          this.requestPurposeState.requestPurposeOptions = [];
          this.requestPurposeState.loadingRequestPurposes = false;
          this.updateUsePurposeFromSelection(null);
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
    const existingIndex = this.cartridgeState.selectedEntries.findIndex(entry => entry.id === cartridge.id);
    if (existingIndex >= 0) {
      this.cartridgeState.selectedEntries[existingIndex].quantity = quantity;
    } else {
      this.cartridgeState.selectedEntries.push({ id: cartridge.id, quantity });
    }

    const target = this.cartridgeState.allCartridges.find(c => c.id === cartridge.id);
    if (target) {
      target.added = true;
      target.selected = true;
      target.quantity = quantity;
    }

    // Persist selections to query params
    this.persistSelections();
  }

  private buildFilterOptions(): void {
    const options = this.cartridgeDataService.buildFilterOptions(this.cartridgeState.allCartridges);
    this.filterOptions.bulletDiameters = options.bulletDiameters;
    this.filterOptions.caseLengths = options.caseLengths;
    this.filterOptions.natureOptions = options.natureOptions;
  }

  private initializeStepFromQueryParams(): void {
    this.route.queryParams.subscribe(params => {
      const stepParam = params['step'];
      if (stepParam !== undefined) {
        const step = parseInt(stepParam, 10);
        if (!isNaN(step) && step >= 0 && step < this.steps.length) {
          this.currentStep = step;

          // Restore fromReserve from query params if available
          if (params['fromReserve'] !== undefined) {
            this.fromReserve = params['fromReserve'];
          }

          // Store pending selections from query params to restore after cartridges load
          const selectionsParam = params['selections'];
          if (selectionsParam) {
            try {
              this.pendingSelections = JSON.parse(selectionsParam);
            } catch (error) {
              console.error('Failed to parse selections from query params:', error);
              this.pendingSelections = null;
            }
          } else {
            this.pendingSelections = null;
          }

          // If we're on step 1 or later, we need to load cartridges
          // (step 0 is allowance selection, step 1 is cartridge selection)
          if (step >= 1 && this.cartridgeState.allCartridges.length === 0 && !this.cartridgeState.loadingCartridges) {
            this.loadCartridges();
          }

          // Ensure requester name is synced when navigating to review step (step 3)
          if (step === 3) {
            this.syncRequesterNameFromUserDetails();
          }
        }
      }
    });
  }

  private updateQueryParams(step: number): void {
    const queryParams: any = {
      step: step,
      fromReserve: this.fromReserve
    };

    // Persist selected entries if there are any
    if (this.cartridgeState.selectedEntries.length > 0) {
      queryParams.selections = JSON.stringify(this.cartridgeState.selectedEntries);
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Persists selected entries to query params
   */
  private persistSelections(): void {
    const queryParams: any = {};
    if (this.cartridgeState.selectedEntries.length > 0) {
      queryParams.selections = JSON.stringify(this.cartridgeState.selectedEntries);
    } else {
      // Remove selections param if no selections
      queryParams.selections = null;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Restores selected entries from pending selections and updates cartridge state
   */
  private restoreSelections(): void {
    if (!this.pendingSelections || !Array.isArray(this.pendingSelections) || this.pendingSelections.length === 0) {
      return;
    }

    // Restore selected entries
    this.cartridgeState.selectedEntries = this.pendingSelections;

    // Update cartridge state to reflect selections
    this.pendingSelections.forEach(entry => {
      const cartridge = this.cartridgeState.allCartridges.find(c => c.id === entry.id);
      if (cartridge) {
        cartridge.selected = true;
        cartridge.added = true;
        cartridge.quantity = entry.quantity;
      }
    });

    // Clear pending selections after restoration
    this.pendingSelections = null;
  }

  filterCartridges(): void {
    // Get numeric ID for ammunition type filter
    const selectedAmmunitionTypeId = this.filterState.selectedAmmunitionType
      ? getAmmunitionTypeId(this.filterState.selectedAmmunitionType)
      : null;

    this.cartridgeState.filteredCartridges = this.cartridgeState.allCartridges.filter(cartridge => {
      const diameterLabel = cartridge.bulletDiameterLabel ?? '';
      const caseLabel = cartridge.caseLengthLabel ?? '';
      const linkedLabel = cartridge.linkedLabel ?? '';
      const natureLabel = cartridge.natureLabel ?? '';
      const nsn = cartridge.ncn ?? '';

      const byDiameter = !this.filterState.selectedBulletDiameter || this.filterState.selectedBulletDiameter === diameterLabel;
      const byCase = !this.filterState.selectedCaseLength || this.filterState.selectedCaseLength === caseLabel;
      const byLinked = !this.filterState.selectedLinked || this.filterState.selectedLinked === linkedLabel;
      const byNature = !this.filterState.selectedNature || this.filterState.selectedNature === natureLabel;
      // NSN filter - search by text (case-insensitive)
      const nsnFilterLower = this.filterState.selectedNSN?.toLowerCase() ?? '';
      const byNSN = !nsnFilterLower || (nsn && nsn.toLowerCase().includes(nsnFilterLower));

      // Ammunition type filter (search by numeric ID: 1=Small, 2=Medium, 3=Large)
      const byAmmunitionType = !selectedAmmunitionTypeId ||
        (cartridge.ammunitionType !== undefined && cartridge.ammunitionType === selectedAmmunitionTypeId);

      // Search filter
      const searchLower = this.filterState.searchTerm.toLowerCase();
      const bySearch = !this.filterState.searchTerm ||
        (cartridge.name?.toLowerCase().includes(searchLower)) ||
        (cartridge.itemNo?.toLowerCase().includes(searchLower)) ||
        (cartridge.productId?.toLowerCase().includes(searchLower)) ||
        (cartridge.ncn?.toLowerCase().includes(searchLower));

      return byDiameter && byCase && byLinked && byNature && byNSN && byAmmunitionType && bySearch;
    });
  }

  // Handlers invoked from child component outputs
  onBulletDiameterChange(value: string): void {
    this.filterState.selectedBulletDiameter = value;
    this.filterCartridges();
  }

  onCaseLengthChange(value: string): void {
    this.filterState.selectedCaseLength = value;
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
  }

  onCloseCartridgeDetails(): void {
    this.cartridgeState.showCartridgeDetails = false;
    this.cartridgeState.selectedCartridgeForView = null;
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
  }

  onRemoveSelectedCartridge(cartridgeId: number): void {
    this.cartridgeState.selectedEntries = this.cartridgeState.selectedEntries.filter(entry => entry.id !== cartridgeId);
    const target = this.cartridgeState.allCartridges.find(c => c.id === cartridgeId);
    if (target) {
      target.selected = false;
      target.added = false;
      target.quantity = null;
    }

    // Persist selections to query params
    this.persistSelections();
  }

  onAllowanceError(errorMessage: string): void {
    this.allowanceError = errorMessage;
    // Clear error after 5 seconds
    setTimeout(() => {
      this.allowanceError = null;
    }, 5000);
  }

  onClearFilters(): void {
    this.filterState.selectedItemType = 'Ammunition';
    this.filterState.selectedAmmunitionType = '';
    this.filterState.selectedBulletDiameter = '';
    this.filterState.selectedCaseLength = '';
    this.filterState.selectedLinked = '';
    this.filterState.selectedNature = '';
    this.filterState.selectedNSN = '';
    this.filterCartridges();
  }



  onItemTypeChange(value: string): void {
    this.filterState.selectedItemType = value;

    if (value !== 'Ammunition') {
      this.filterState.selectedAmmunitionType = '';
    }
    this.filterCartridges();
  }

  onAmmunitionTypeChange(value: string): void {
    this.filterState.selectedAmmunitionType = value;
    this.filterCartridges();
  }

  onStepChange(step: number): void {
    this.currentStep = step;
    this.updateQueryParams(step);
  }

  onFromReserveChange(value: string): void {
    this.fromReserve = value;

    this.updateQueryParams(this.currentStep);
  }

  onConfirmAllowanceSelection(): void {
    this.steps[0].completed = true;
    this.currentStep = 1;
    this.updateQueryParams(1);

    this.loadCartridges();
  }

  onConfirmSelection(): void {
    if (this.canProceedFromSelection) {
      this.steps[1].completed = true;
      this.currentStep = 2;
      this.updateQueryParams(2);
    }
  }

  onNext(): void {
    if (this.orderSubmissionState.submittingOrder) {
      return;
    }

    // Step 0: Allowance selection
    if (this.currentStep === 0) {
      this.onConfirmAllowanceSelection();
      return;
    }

    // Step 1: Cartridge selection
    if (this.currentStep === 1 && !this.canProceedFromSelection) {
      return;
    }

    // Step 3: Review -> Submit
    if (this.currentStep === 3) {
      this.onSubmitOrder();
      return;
    }

    if (this.currentStep < this.steps.length - 1) {
      this.steps[this.currentStep].completed = true;
      this.currentStep++;
      this.updateQueryParams(this.currentStep);
    }
  }

  onUsePurposeIdChange(value: number | null): void {
    this.requestPurposeState.selectedRequestPurposeId = value;
    this.updateUsePurposeFromSelection(value);
  }

  onPrevious(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateQueryParams(this.currentStep);
    }
  }

  // Computed reserve details based on selected items
  get selectedItemsReserveDetails(): any[] {
    if (this.cartridgeState.selectedEntries.length === 0) {
      return this.reserveDetailsState.reserveDetailsByItem;
    }

    const selectedItemIds = this.cartridgeState.selectedEntries.map(entry => entry.id);
    return this.reserveDetailsState.reserveDetailsByItem.filter(item => selectedItemIds.includes(item.itemId));
  }

  get selectedTotalReserve(): number {
    return this.selectedItemsReserveDetails.reduce((sum, item) => sum + (item.totalReserve || 0), 0);
  }

  get selectedAvailableReserve(): number {
    return this.selectedItemsReserveDetails.reduce((sum, item) => sum + (item.availableReserve || 0), 0);
  }

  get selectedOrderedQuantity(): number {
    return this.selectedItemsReserveDetails.reduce((sum, item) => sum + (item.orderedQuantity || 0), 0);
  }

  get selectedUsedQuantity(): number {
    return this.selectedItemsReserveDetails.reduce((sum, item) => sum + (item.usedQuantity || 0), 0);
  }

  onSubmitOrder(): void {
    if (this.orderSubmissionState.submittingOrder) {
      return;
    }

    const submissionData = {
      selectedEntries: this.cartridgeState.selectedEntries,
      selectedRequestPurposeId: this.requestPurposeState.selectedRequestPurposeId,
      usePurpose: this.usageFormData.usePurpose,
      usageDateFrom: this.usageFormData.usageDateFrom,
      usageTimeFrom: this.usageFormData.usageTimeFrom,
      usageDateTo: this.usageFormData.usageDateTo,
      usageTimeTo: this.usageFormData.usageTimeTo,
      usageLocation: this.usageFormData.usageLocation,
      orderPriority: this.usageFormData.orderPriority,
      numberOfOfficers: this.usageFormData.numberOfOfficers,
      numberOfOtherRanks: this.usageFormData.numberOfOtherRanks,
      requesterComments: this.reviewFormData.requesterComments,
      fromReserve: this.fromReserve,
      departmentId: this.getDepartmentIdForRequest(),
      defaultRequestPurposeId: this.DEFAULT_REQUEST_PURPOSE_ID,
      defaultRequestTypeId: this.DEFAULT_REQUEST_TYPE_ID,
      orderType: this.reviewFormData.orderType
    };

    const validation = this.orderSubmissionService.validateOrder(submissionData);
    if (!validation.isValid) {
      this.orderSubmissionState.orderSubmitError = validation.error ?? 'Validation failed';
      this.currentStep = 3;
      this.updateQueryParams(3);
      return;
    }

    const payload = this.orderSubmissionService.buildOrderPayload(submissionData);
    this.orderSubmissionState.submittingOrder = true;
    this.orderSubmissionState.orderSubmitError = null;

    this.orderSubmissionService.submitOrder(payload).subscribe({
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
      },
      error: (error) => {
        this.orderSubmissionState.submittingOrder = false;
        this.orderSubmissionState.orderSubmitError = error.error || 'Failed to submit order. Please try again.';
        this.currentStep = 3;
        this.updateQueryParams(3);
      }
    });
  }

  onTrackOrder(): void {
    // Reset form and navigate to dashboard
    this.resetForm();
    this.router.navigate(['/dashboard']);
  }

  private applyAuthenticatedUserContext(user: AuthenticatedUser | null): void {
    if (!user) {
      return;
    }

    this.applyUserContext({
      nameEn: user.nameEn,
      nameAr: user.nameAr,
      userName: user.userName,
      departmentId: user.departmentId
    });

    // Update requester name if backend details not yet available (fallback)
    if (!this.userContextState.currentUserDetails) {
      this.syncRequesterNameFromUserDetails();
    }
  }

  private applyBackendUserDetails(details: BackendUserDto | null): void {
    if (!details) {
      return;
    }

    this.applyUserContext({
      nameEn: details.nameEn,
      nameAr: details.nameAr,
      userName: details.userName,
      departmentId: details.departmentId
    });

   
    this.syncRequesterNameFromUserDetails();
  }

  private applyUserContext(context: {
    nameEn?: string | null;
    nameAr?: string | null;
    userName?: string | null;
    departmentId?: number | string | null;
  }): void {
    const departmentId = toNumber(context.departmentId);
    if (departmentId !== null) {
      this.userContextState.currentUserDepartmentId = departmentId;
    }

    // Set RequesterId to the current user's ID (string)
    const currentUser = this.backendAuthService.getCurrentUser();
    if (currentUser?.id) {
      this.userContextState.currentUserRequesterId = currentUser.id;
    } else {
      this.userContextState.currentUserRequesterId = null;
    }

    const preferredName = resolveUserDisplayName(context.nameEn, context.nameAr, context.userName);
    if (preferredName) {
      this.userContextState.fallbackRequesterName = preferredName;
    }
  }

  /**
   * Syncs requester name from user details to reviewFormData
   * Called when user details are loaded or updated
   * Single source of truth for updating the name
   */
  private syncRequesterNameFromUserDetails(): void {
    // Prioritize currentUserDetails from /Users/me API
    const preferredName = resolveUserDisplayName(
      this.userContextState.currentUserDetails?.nameEn,
      this.userContextState.currentUserDetails?.nameAr,
      this.userContextState.currentUserDetails?.userName
    ) || this.userContextState.fallbackRequesterName;

    // Update reviewFormData only if we have a valid name
    if (preferredName) {
      this.reviewFormData.requesterName = preferredName;
    }
  }

  private getPreferredRequesterName(): string {
    const user = this.userContextState.currentUserDetails;
    if (user) {
      const name = getLocalizedName(user, getCurrentLang(this.translate));
      if (name && name.trim().length > 0) {
        return name;
      }
    }

    return this.userContextState.currentUserDetails?.userName ||
      this.userContextState.fallbackRequesterName ||
      'Name';
  }

  private getDepartmentIdForRequest(): number {
    if (this.userContextState.currentUserDepartmentId != null) {
      return this.userContextState.currentUserDepartmentId;
    }
    return this.DEFAULT_DEPARTMENT_ID;
  }

  private getRequesterIdForRequest(): string | null {
    return this.userContextState.currentUserRequesterId;
  }

  resetForm(): void {
    this.currentStep = 0;
    this.orderSubmissionState.orderSubmitted = false;
    this.steps.forEach(step => step.completed = false);

    // Reset cartridge state
    this.cartridgeState.selectedEntries = [];
    this.cartridgeState.allCartridges.forEach(c => {
      c.selected = false;
      c.added = false;
      c.quantity = null;
    });
    this.cartridgeState.filteredCartridges = [...this.cartridgeState.allCartridges];

    // Reset filter state
    this.filterState.selectedBulletDiameter = '';
    this.filterState.selectedCaseLength = '';
    this.filterState.selectedLinked = '';
    this.filterState.selectedNature = '';
    this.filterState.selectedNSN = '';
    this.filterState.selectedItemType = 'Ammunition';
    this.filterState.selectedAmmunitionType = '';
    this.filterState.searchTerm = '';

    // Reset allowance selection
    this.fromReserve = 'Yes';

    // Reset usage form data
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

    // Reset request purpose state
    this.requestPurposeState.selectedRequestPurposeId = null;

    // Reset review form data
    // Sync name from /Users/me API data
    this.syncRequesterNameFromUserDetails();
    if (!this.reviewFormData.requesterName) {
      // Fallback if no user details available
      this.reviewFormData.requesterName = this.getPreferredRequesterName();
    }
    this.reviewFormData.requesterComments = '';

    // Reset order submission state
    this.orderSubmissionState.orderSubmitError = null;
    this.orderSubmissionState.createdOrderId = null;
    this.orderSubmissionState.orderNumber = null;
    this.orderSubmissionState.submittingOrder = false;

    // Reset reserve details state
    this.reserveDetailsState = {
      totalReserve: 0,
      availableReserve: 0,
      orderedQuantity: 0,
      usedQuantity: 0,
      loadingReserveDetails: false,
      reserveDetailsByItem: []
    };

    this.updateQueryParams(0);
  }

  private rebuildRequestPurposeOptions(): void {
    const currentLang = this.translate.currentLang || this.translate.defaultLang || 'en';
    this.requestPurposeState.requestPurposeOptions = this.requestPurposeState.requestPurposesSource.map(purpose => ({
      label: getLocalizedNameFromItem(purpose, currentLang),
      value: purpose.id
    }));
  }

  private updateUsePurposeFromSelection(value: number | null): void {
    if (value === null || value === undefined) {
      this.usageFormData.usePurpose = '';
      this.requestPurposeState.selectedRequestPurposeId = null;
      return;
    }

    const match = this.requestPurposeState.requestPurposesSource.find(purpose => purpose.id === value);
    if (match) {
      this.requestPurposeState.selectedRequestPurposeId = match.id;
      const currentLang = this.translate.currentLang || this.translate.defaultLang || 'en';
      this.usageFormData.usePurpose = getLocalizedNameFromItem(match, currentLang);
      return;
    }

    this.requestPurposeState.selectedRequestPurposeId = null;
    this.usageFormData.usePurpose = '';
  }
}
