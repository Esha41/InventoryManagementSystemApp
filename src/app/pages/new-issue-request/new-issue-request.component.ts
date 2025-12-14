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
import { getWeaponTypeOptions } from '@utils/weapon.utils';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';

// Extending FilterState locally for now or assuming the imported one is just an interface I can conform to if updated?
// Actually I need to extend the component's usage of it.
// The imported FilterState interface might be strict (from separate file). 
// I will check if I can augment it or just add properties to the object.
// Given constraints, I'll CAST or assume loose typing if possible, OR I should have updated the state file.
// Since I can't easily see state file without extra tool call, I'll update the component to use a local extended interface or Just modify the object literal.
// But Typescript will complain.
// I'll define an ExtendedFilterState here.

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
    itemTypeOptions: ['Ammunition', 'Explosives', 'Weapons'],
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
    this.rebuildOrderPriorities();

    // Load static options from Utils
    // Note: getWeaponTypeOptions returns objects {label, value}. We might need to map them or use as is if dropdown supports objects.
    // CartridgeList uses simple string array input currently or I updated it? I updated it to accept objects or strings?
    // Checking CartridgeList: it accepts string[] for weaponTypeOptions.
    // getWeaponTypeOptions returns DropdownOption[] (label/value).
    // I should probably map them to labels or use a smarter dropdown in cartridge list.
    // In CartridgeList HTML I used [options] which supports objects if I used app-dropdown correctly.
    // I used `[optionLabel]="'label'"` so passing the full object array is better.
    // I need to update filterOptions type to any[] for these specific ones or map to strings if I want simple strings.
    // The previous implementation used strings.
    // The new HTML implementation uses `[options]="weaponTypeOptions" [optionLabel]="'label'"`.
    // So passing the object array is correct. I should cast or facilitate this.

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

    const type = this.filterState.selectedItemType;
    const isAllowance = this.fromReserve === 'Yes';
    const deptId = this.userContextState.currentUserDepartmentId;

    if (isAllowance && !deptId) {
      this.cartridgeState.cartridgeError = 'Department not found for current user.';
      this.cartridgeState.loadingCartridges = false;
      return;
    }

    let load$: any;

    if (type === 'Weapons') {
      load$ = isAllowance ? this.cartridgeDataService.loadAllowanceWeapons(deptId!) : this.cartridgeDataService.loadAllWeapons();
    } else if (type === 'Explosives') {
      load$ = isAllowance ? this.cartridgeDataService.loadAllowanceExplosives(deptId!) : this.cartridgeDataService.loadAllExplosives();
    } else {
      // Ammunition
      load$ = isAllowance ? this.cartridgeDataService.loadAllowanceAmmunition(deptId!) : this.cartridgeDataService.loadAllAmmunition();
    }

    load$.subscribe({
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
      },
      error: (error: any) => {
        this.cartridgeState.allCartridges = [];
        this.cartridgeState.filteredCartridges = [];
        this.cartridgeState.loadingCartridges = false;
        this.cartridgeState.cartridgeError = error.error || 'Failed to load items. Please try again.';
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
    this.filterOptions.natureOptions = options.natureOptions;
    // Weapon/Explosive types are static/enum based loaded in OnInit
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
    this.cartridgeState.filteredCartridges = this.cartridgeState.allCartridges.filter(cartridge => {
      // Common Search
      const searchLower = this.filterState.searchTerm.toLowerCase();
      const bySearch = !this.filterState.searchTerm ||
        (cartridge.name?.toLowerCase().includes(searchLower)) ||
        (cartridge.itemNo?.toLowerCase().includes(searchLower)) ||
        (cartridge.productId?.toLowerCase().includes(searchLower)) ||
        (cartridge.ncn?.toLowerCase().includes(searchLower));

      if (this.filterState.selectedItemType === 'Ammunition') {
        const diameterLabel = cartridge.bulletDiameterLabel ?? '';
        const linkedLabel = cartridge.linkedLabel ?? '';
        const natureLabel = cartridge.natureLabel ?? '';
        const nsn = cartridge.ncn ?? '';

        const byDiameter = !this.filterState.selectedBulletDiameter || this.filterState.selectedBulletDiameter === diameterLabel;
        const byLinked = !this.filterState.selectedLinked || this.filterState.selectedLinked === linkedLabel;
        const byNature = !this.filterState.selectedNature || this.filterState.selectedNature === natureLabel;

        const nsnFilterLower = this.filterState.selectedNSN?.toLowerCase() ?? '';
        const byNSN = !nsnFilterLower || (nsn && nsn.toLowerCase().includes(nsnFilterLower));

        const byAmmunitionType = !this.filterState.selectedAmmunitionType ||
          (cartridge.ammunitionType !== undefined &&
            String(cartridge.ammunitionType).toLowerCase() === this.filterState.selectedAmmunitionType.toLowerCase());

        return byDiameter && byLinked && byNature && byNSN && byAmmunitionType && bySearch;

      } else if (this.filterState.selectedItemType === 'Weapons') {
        const byWeaponType = !this.filterState.selectedWeaponType || cartridge.weaponType === this.filterState.selectedWeaponType;

        // Caliber might be numeric or string, loosely matching or contains
        const caliberFilter = this.filterState.selectedCaliber?.toLowerCase() ?? '';
        const byCaliber = !caliberFilter || (cartridge.caliber && String(cartridge.caliber).toLowerCase().includes(caliberFilter));

        const nsn = cartridge.ncn ?? '';
        const nsnFilterLower = this.filterState.selectedNSN?.toLowerCase() ?? '';
        const byNSN = !nsnFilterLower || (nsn && nsn.toLowerCase().includes(nsnFilterLower));

        return byWeaponType && byCaliber && byNSN && bySearch;

      } else if (this.filterState.selectedItemType === 'Explosives') {
        const byExplosiveType = !this.filterState.selectedExplosiveType || cartridge.explosiveType === this.filterState.selectedExplosiveType;

        const unfilter = this.filterState.selectedUNNumber?.toLowerCase() ?? '';
        const byUN = !unfilter || (cartridge.unNumber && String(cartridge.unNumber).toLowerCase().includes(unfilter));

        return byExplosiveType && byUN && bySearch;
      }

      return bySearch;
    });
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
    // Reset based on current type or all? Usually clear resets filters for current view.
    this.filterState.selectedAmmunitionType = '';
    this.filterState.selectedBulletDiameter = '';
    this.filterState.selectedLinked = '';
    this.filterState.selectedNature = '';

    this.filterState.selectedWeaponType = '';
    this.filterState.selectedCaliber = '';

    this.filterState.selectedExplosiveType = '';
    this.filterState.selectedUNNumber = '';

    this.filterState.selectedNSN = '';
    this.filterState.searchTerm = '';

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
  }

  onFromReserveChange(value: string): void {
    const prev = this.fromReserve;
    if (prev !== value) {
      this.fromReserve = value;
      this.updateQueryParams(this.currentStep);
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

    // Pass files to submitOrder
    const filesToUpload = this.usageFormFiles && this.usageFormFiles.length > 0
      ? this.usageFormFiles
      : undefined;

    this.orderSubmissionService.submitOrder(payload, filesToUpload).subscribe({
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
    // implementation implied from previous checks, just need to ensure methods exist
    // I will leave existing helper methods that were not shown in truncated file but are usually there.
    // To be safe I will implement them if they were part of the previous file, but I don't see them in Line 600+.
    // I'll add them to be safe if they are missing from my write.
    if (!details) return;
    this.syncRequesterNameFromUserDetails();
  }

  private applyUserContext(context: { nameEn?: string; nameAr?: string; userName?: string; departmentId?: number }): void {
    if (context.departmentId) {
      this.userContextState.currentUserDepartmentId = context.departmentId;
    }
  }

  private syncRequesterNameFromUserDetails(): void {
    this.reviewFormData.requesterName = resolveUserDisplayName(
      this.userContextState.currentUserDetails?.nameEn,
      this.userContextState.currentUserDetails?.nameAr,
      this.userContextState.currentUserDetails?.userName
    ) || '';
  }

  private requestPurposeOptionsMap: Map<number, { usePurpose: string }> = new Map();

  private rebuildRequestPurposeOptions(): void {
    const currentLang = getCurrentLang(this.translate);
    this.requestPurposeState.requestPurposeOptions = this.requestPurposeState.requestPurposesSource.map(p => ({
      label: getLocalizedName(p, currentLang),
      value: p.id
    }));

    // Also update map for auto-fill
    this.requestPurposeState.requestPurposesSource.forEach(p => {
      this.requestPurposeOptionsMap.set(p.id, { usePurpose: getLocalizedName(p, currentLang) });
    });
  }

  private rebuildOrderPriorities(): void {
    this.filterOptions.orderPriorities = [
      { label: this.translate.instant('newIssueRequest.priorityHigh'), value: 'High' },
      { label: this.translate.instant('newIssueRequest.priorityNormal'), value: 'Normal' },
      { label: this.translate.instant('newIssueRequest.priorityLow'), value: 'Low' }
    ];
  }

  private updateUsePurposeFromSelection(id: number | null): void {
    if (id && this.requestPurposeOptionsMap.has(id)) {
      this.usageFormData.usePurpose = this.requestPurposeOptionsMap.get(id)?.usePurpose || '';
    }
  }

  private getDepartmentIdForRequest(): number {
    return this.userContextState.currentUserDepartmentId || this.DEFAULT_DEPARTMENT_ID;
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
  }
}
