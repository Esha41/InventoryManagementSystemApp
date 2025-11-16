import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { StepperComponent, Step } from '@components/stepper/stepper.component';
import { CartridgeDetailsComponent } from './components/cartridge-details/cartridge-details.component';
import { CartridgeListComponent, Cartridge } from './components/cartridge-list/cartridge-list.component';
import { AmmunitionService } from '@services/ammunition.service';
import { UsageFormComponent } from './components/usage-form/usage-form.component';
import { ReviewFormComponent } from './components/review-form/review-form.component';
import { OrderService, CreateOrderRequest } from '../../core/services/order.service';
import { APIOperationResponse } from '@models/api-response.model';
import { UserContextService } from '@services/user-context.service';
import { BackendUserDto } from '@models/backend-user.model';
import { BackendAuthService } from '@services/backend-auth.service';
import { AuthenticatedUser } from '@models/auth.model';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { DropdownOption } from '@components/dropdown/dropdown.component';

interface RequestPurposeDto {
  id: number;
  nameEn?: string | null;
  nameAr?: string | null;
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
    ReviewFormComponent
  ],
  templateUrl: './new-issue-request.component.html',
  styleUrls: ['./new-issue-request.component.css']
})
export class NewIssueRequestComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
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
    private ammunitionService: AmmunitionService,
    private orderService: OrderService,
    private userContextService: UserContextService,
    private backendAuthService: BackendAuthService,
    private apiService: ApiService,
    private translate: TranslateService
  ) {}

  // Step 1: Selection filters (populated from API)
  itemTypeOptions: string[] = ['Ammunition', 'Explosives', 'Weapons'];
  ammunitionTypeOptions: string[] = ['Small', 'Medium', 'Large']; // Display values: Small=1, Medium=2, Large=3
  bulletDiameters: string[] = [];
  caseLengths: string[] = [];
  linkedOptions: string[] = ['Linked', 'Not Linked'];
  natureOptions: string[] = [];
  orderPriorities: string[] = ['High Priority', 'Medium Priority', 'Low Priority'];
  requestPurposeOptions: DropdownOption<number>[] = [];
  selectedRequestPurposeId: number | null = null;
  loadingRequestPurposes = false;

  selectedItemType = 'Ammunition';
  selectedAmmunitionType = ''; // Will store 'Small', 'Medium', or 'Large', but filter by numeric ID (1, 2, 3)
  selectedBulletDiameter = '';
  selectedCaseLength = '';
  selectedLinked = '';
  selectedNature = '';
  searchTerm = '';

  private allCartridges: Cartridge[] = [];
  filteredCartridges: Cartridge[] = [];
  selectedCartridgeForView: Cartridge | null = null;
  showCartridgeDetails: boolean = false;

  loadingCartridges = false;
  cartridgeError: string | null = null;

  submittingOrder = false;
  orderSubmitError: string | null = null;
  createdOrderId: number | null = null;
  orderNumber: string | null = null;

  private selectedEntries: Array<{ id: number; quantity: number }> = [];

  private readonly DEFAULT_DEPARTMENT_ID = 1;
  private readonly DEFAULT_REQUEST_PURPOSE_ID = 1;
  private readonly DEFAULT_REQUEST_TYPE_ID = 1;
  private currentUserDetails: BackendUserDto | null = null;
  private currentUserDepartmentId: number | null = null;
  private currentUserRequesterId: string | null = null;
  private fallbackRequesterName = '';
  isAdminUser = false;
  lockRequesterName = false;
  private requestPurposesSource: RequestPurposeDto[] = [];

  get selectedCartridges(): Cartridge[] {
    return this.selectedEntries
      .map(entry => {
        const cartridge = this.allCartridges.find(c => c.id === entry.id);
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
    const hasSelection = this.selectedEntries.length > 0;
    const quantitiesValid = this.selectedEntries.every(entry => entry.quantity > 0);
    return hasSelection && quantitiesValid;
  }

  ngOnInit(): void {
    this.initializeUserContext();
    this.initializeStepFromQueryParams();
    this.loadRequestPurposes();
    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.rebuildRequestPurposeOptions();
        this.updateUsePurposeFromSelection(this.selectedRequestPurposeId);
      });
    // Don't load cartridges yet - wait for allowance selection
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeUserContext(): void {
    this.isAdminUser = this.userContextService.isAdminUser();
    this.lockRequesterName = !this.isAdminUser;

    this.backendAuthService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => this.applyAuthenticatedUserContext(user));

    this.userContextService
      .getCurrentUserDetails()
      .pipe(takeUntil(this.destroy$))
      .subscribe(details => {
        this.currentUserDetails = details;
        this.applyBackendUserDetails(details);
      });
  }

  private loadCartridges(): void {
    this.loadingCartridges = true;
    this.cartridgeError = null;

    if (this.fromReserve === 'Yes') {
      this.loadAllowanceItems();
    } else {
      this.loadAllAmmunition();
    }
  }

  private loadAllAmmunition(): void {
    this.ammunitionService.getAll<any>().subscribe({
      next: (items) => {
        const mapped = (items || []).map((x: any) => this.mapAmmunitionToCartridge(x));
        this.allCartridges = mapped;
        this.buildFilterOptions();
        this.filterCartridges();
        this.loadingCartridges = false;
      },
      error: () => {
        this.allCartridges = [];
        this.filteredCartridges = [];
        this.loadingCartridges = false;
        this.cartridgeError = 'Failed to load ammunition catalog. Please try again.';
      }
    });
  }

  private loadAllowanceItems(): void {
    // Validate department
    if (!this.currentUserDepartmentId) {
      this.cartridgeError = 'Department not found for current user. Please contact support.';
      this.loadingCartridges = false;
      return;
    }

    const currentYear = new Date().getFullYear();
    const endpoint = API_ENDPOINTS.ALLOWANCE.BY_DEPARTMENT_AND_YEAR(this.currentUserDepartmentId, currentYear);
    
    this.apiService.getWithAuth<any>(endpoint).subscribe({
      next: (response) => {
        const allowanceItems = response.data?.items || response.data?.Items || [];
        
        if (allowanceItems.length === 0) {
          this.cartridgeError = 'No allowance items found for your department this year. Please contact your administrator.';
          this.allCartridges = [];
          this.filteredCartridges = [];
          this.loadingCartridges = false;
          return;
        }

        // Fetch full ammunition details for each allowance item
        const itemIds = allowanceItems.map((item: any) => item.itemId);
        this.ammunitionService.getAll<any>().subscribe({
          next: (allAmmunition) => {
            const allowanceAmmunition = allAmmunition.filter((ammo: any) => 
              itemIds.includes(ammo.id)
            );
            const mapped = allowanceAmmunition.map((x: any) => this.mapAmmunitionToCartridge(x));
            this.allCartridges = mapped;
            this.buildFilterOptions();
            this.filterCartridges();
            this.loadingCartridges = false;
            
            // Load reserve details after loading allowance items
            this.loadReserveDetails();
          },
          error: () => {
            this.allCartridges = [];
            this.filteredCartridges = [];
            this.loadingCartridges = false;
            this.cartridgeError = 'Failed to load ammunition details. Please try again.';
          }
        });
      },
      error: () => {
        this.allCartridges = [];
        this.filteredCartridges = [];
        this.loadingCartridges = false;
        this.cartridgeError = 'Failed to load allowance items. Please try again.';
      }
    });
  }

  private loadReserveDetails(): void {
    if (!this.currentUserDepartmentId) {
      return;
    }

    this.loadingReserveDetails = true;
    const currentYear = new Date().getFullYear();
    const endpoint = API_ENDPOINTS.ALLOWANCE.RESERVE_DETAILS(this.currentUserDepartmentId, currentYear);
    
    this.apiService.getWithAuth<any>(endpoint).subscribe({
      next: (response) => {
        if (response.succeeded && response.data) {
          this.totalReserve = response.data.totalReserve || 0;
          this.availableReserve = response.data.totalAvailableReserve || 0;
          this.orderedQuantity = response.data.totalOrderedQuantity || 0;
          this.utilizedQuantity = response.data.totalUtilizedQuantity || 0;
          this.reserveDetailsByItem = response.data.items || [];
        }
        this.loadingReserveDetails = false;
      },
      error: () => {
        this.loadingReserveDetails = false;
        // Keep default values of 0
        this.reserveDetailsByItem = [];
      }
    });
  }

  private loadRequestPurposes(): void {
    this.loadingRequestPurposes = true;

    this.apiService
      .getWithAuth<APIOperationResponse<RequestPurposeDto[]>>(
        API_ENDPOINTS.REQUEST_PURPOSES.FOR_ORDER
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const purposes = this.normalizeRequestPurposesResponse(response);
          this.requestPurposesSource = purposes;
          this.rebuildRequestPurposeOptions();
          this.loadingRequestPurposes = false;
          this.updateUsePurposeFromSelection(this.selectedRequestPurposeId);
        },
        error: () => {
          this.requestPurposesSource = [];
          this.requestPurposeOptions = [];
          this.loadingRequestPurposes = false;
          this.updateUsePurposeFromSelection(null);
        }
      });
  }

  retryLoadCartridges(): void {
    if (!this.loadingCartridges) {
      this.loadCartridges();
    }
  }

  onCartridgeAdded(event: { cartridge: Cartridge; quantity: number }): void {
    const { cartridge, quantity } = event;
    const existingIndex = this.selectedEntries.findIndex(entry => entry.id === cartridge.id);
    if (existingIndex >= 0) {
      this.selectedEntries[existingIndex].quantity = quantity;
    } else {
      this.selectedEntries.push({ id: cartridge.id, quantity });
    }

    const target = this.allCartridges.find(c => c.id === cartridge.id);
    if (target) {
      target.added = true;
      target.selected = true;
      target.quantity = quantity;
    }
  }

  private buildFilterOptions(): void {
    const diameters = new Set<string>();
    const caseLens = new Set<string>();
    const natures = new Set<string>();

    for (const cartridge of this.allCartridges) {
      if (cartridge.bulletDiameterLabel) {
        diameters.add(cartridge.bulletDiameterLabel);
      }
      if (cartridge.caseLengthLabel) {
        caseLens.add(cartridge.caseLengthLabel);
      }
      if (cartridge.natureLabel) {
        natures.add(cartridge.natureLabel);
      }
    }

    this.bulletDiameters = Array.from(diameters);
    this.caseLengths = Array.from(caseLens);
    this.natureOptions = Array.from(natures);
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
          
          // If we're on step 1 or later, we need to load cartridges
          // (step 0 is allowance selection, step 1 is cartridge selection)
          if (step >= 1 && this.allCartridges.length === 0 && !this.loadingCartridges) {
            this.loadCartridges();
          }
        }
      }
    });
  }

  private updateQueryParams(step: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { 
        step: step,
        fromReserve: this.fromReserve 
      },
      queryParamsHandling: 'merge'
    });
  }

  filterCartridges(): void {
    // Get numeric ID for ammunition type filter
    const selectedAmmunitionTypeId = this.selectedAmmunitionType 
      ? this.getAmmunitionTypeId(this.selectedAmmunitionType) 
      : null;

    this.filteredCartridges = this.allCartridges.filter(cartridge => {
      const diameterLabel = cartridge.bulletDiameterLabel ?? '';
      const caseLabel = cartridge.caseLengthLabel ?? '';
      const linkedLabel = cartridge.linkedLabel ?? '';
      const natureLabel = cartridge.natureLabel ?? '';

      const byDiameter = !this.selectedBulletDiameter || this.selectedBulletDiameter === diameterLabel;
      const byCase = !this.selectedCaseLength || this.selectedCaseLength === caseLabel;
      const byLinked = !this.selectedLinked || this.selectedLinked === linkedLabel;
      const byNature = !this.selectedNature || this.selectedNature === natureLabel;
      
      // Ammunition type filter (search by numeric ID: 1=Small, 2=Medium, 3=Large)
      const byAmmunitionType = !selectedAmmunitionTypeId || 
        (cartridge.ammunitionType !== undefined && cartridge.ammunitionType === selectedAmmunitionTypeId);
      
      // Search filter
      const searchLower = this.searchTerm.toLowerCase();
      const bySearch = !this.searchTerm || 
        (cartridge.name?.toLowerCase().includes(searchLower)) ||
        (cartridge.itemNo?.toLowerCase().includes(searchLower)) ||
        (cartridge.productId?.toLowerCase().includes(searchLower)) ||
        (cartridge.ncn?.toLowerCase().includes(searchLower));
      
      return byDiameter && byCase && byLinked && byNature && byAmmunitionType && bySearch;
    });
  }

  // Handlers invoked from child component outputs
  onBulletDiameterChange(value: string): void {
    this.selectedBulletDiameter = value;
    this.filterCartridges();
  }

  onCaseLengthChange(value: string): void {
    this.selectedCaseLength = value;
    this.filterCartridges();
  }

  onLinkedChange(value: string): void {
    this.selectedLinked = value;
    this.filterCartridges();
  }

  onNatureChange(value: string): void {
    this.selectedNature = value;
    this.filterCartridges();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.filterCartridges();
  }

  onCartridgeClick(cartridge: Cartridge): void {
    this.selectedCartridgeForView = cartridge;
    this.showCartridgeDetails = true;
  }

  onCloseCartridgeDetails(): void {
    this.showCartridgeDetails = false;
    this.selectedCartridgeForView = null;
  }

  onSelectCartridge(): void {
    if (!this.selectedCartridgeForView) {
      return;
    }

    const cartridge = this.allCartridges.find(c => c.id === this.selectedCartridgeForView?.id) || this.selectedCartridgeForView;
    const quantity = cartridge.quantity && cartridge.quantity > 0 ? cartridge.quantity : 1;
    this.onCartridgeAdded({ cartridge, quantity });

    this.showCartridgeDetails = false;
    this.selectedCartridgeForView = null;
  }

  onRemoveSelectedCartridge(cartridgeId: number): void {
    this.selectedEntries = this.selectedEntries.filter(entry => entry.id !== cartridgeId);
    const target = this.allCartridges.find(c => c.id === cartridgeId);
    if (target) {
      target.selected = false;
      target.added = false;
      target.quantity = null;
    }
  }

  onClearFilters(): void {
    this.selectedItemType = 'Ammunition';
    this.selectedAmmunitionType = '';
    this.selectedBulletDiameter = '';
    this.selectedCaseLength = '';
    this.selectedLinked = '';
    this.selectedNature = '';
    this.filterCartridges();
  }


  private getAmmunitionTypeId(displayText: string): number | null {
    switch (displayText) {
      case 'Small':
        return 1;
      case 'Medium':
        return 2;
      case 'Large':
        return 3;
      default:
        return null;
    }
  }

  onItemTypeChange(value: string): void {
    this.selectedItemType = value;
  
    if (value !== 'Ammunition') {
      this.selectedAmmunitionType = '';
    }
    this.filterCartridges();
  }

  onAmmunitionTypeChange(value: string): void {
    this.selectedAmmunitionType = value;
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
    if (this.submittingOrder) {
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
    this.selectedRequestPurposeId = value;
    this.updateUsePurposeFromSelection(value);
  }

  onPrevious(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateQueryParams(this.currentStep);
    }
  }

  // Step 1: Allowance Selection
  fromReserve: string = 'Yes';

  // Step 3: Usage form data
  usePurpose: string = '';
  annualDiscardSpecialOps: string = '';
  usageLocation: string = '';
  numberOfOfficers: number | null = null;
  numberOfOtherRanks: number | null = null;
  usageDate: string = '';
  usageTime: string = '';
  orderPriority: string = '';

  // Reserve details (calculated dynamically)
  totalReserve = 0;
  availableReserve = 0;
  orderedQuantity = 0;
  utilizedQuantity = 0;
  loadingReserveDetails = false;
  reserveDetailsByItem: any[] = [];
  
  // Computed reserve details based on selected items
  get selectedItemsReserveDetails(): any[] {
    if (this.selectedEntries.length === 0) {
      return this.reserveDetailsByItem;
    }
    
    const selectedItemIds = this.selectedEntries.map(entry => entry.id);
    return this.reserveDetailsByItem.filter(item => selectedItemIds.includes(item.itemId));
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
  
  get selectedUtilizedQuantity(): number {
    return this.selectedItemsReserveDetails.reduce((sum, item) => sum + (item.utilizedQuantity || 0), 0);
  }

  // Step 3: Review - Requester Details
  requesterName: string = 'Name';
  requesterComments: string = '';

  // Step 3: Review - Order Details
  orderType: string = 'New Issue Request';
  orderDocument: string = ''; // Will store file path/name

  // Step 4: Send
  orderSubmitted: boolean = false;

  onSubmitOrder(): void {
    if (this.submittingOrder) {
      return;
    }

    const validationError = this.validateBeforeSubmit();
    if (validationError) {
      this.orderSubmitError = validationError;
      this.currentStep = 3; // Step 3 is Review (was 2 before we added Allowance Selection step)
      this.updateQueryParams(3);
      return;
    }

    const usageDateTime = this.combineDateAndTime(this.usageDate, this.usageTime);
    const requestItems = this.selectedEntries.map(entry => ({
      itemId: entry.id,
      quantity: entry.quantity,
      notes: ''
    }));

    const orderNumber = this.generateOrderNumber();

    const payload: CreateOrderRequest = {
      orderNo: orderNumber,
      requestNo: orderNumber,
      reason: this.usePurpose || this.orderType || 'New Order Issue',
      notes: this.requesterComments || '',
      departmentId: this.getDepartmentIdForRequest(),
      requestTypeId: this.DEFAULT_REQUEST_TYPE_ID,
      requesterId: null, 
      recieverId: null, 
      depotId: null,
      requestPurposeId: this.selectedRequestPurposeId ?? this.DEFAULT_REQUEST_PURPOSE_ID,
      isFromAllowance: this.fromReserve === 'Yes',
      usageDate: usageDateTime.toISOString(),
      usageTime: this.formatUsageTime(usageDateTime),
      usagePurpose: this.usePurpose || 'General usage',
      annualDiscard: this.parseOptionalInteger(this.annualDiscardSpecialOps),
      usageLocation: this.usageLocation || 'N/A',
      numberOfOfficer: this.numberOfOfficers ?? null,
      numberOfOtherRank: this.numberOfOtherRanks ?? null,
      priority: this.mapPriorityToEnum(this.orderPriority),
      requestItems
    };

    console.groupCollapsed('[NewIssueRequest] createOrder payload');
    console.log('Payload', payload);
    console.groupEnd();

    this.submittingOrder = true;
    this.orderSubmitError = null;

    this.orderService.createOrder(payload).subscribe({
      next: (response: APIOperationResponse<number>) => {
        this.submittingOrder = false;

        if (!response?.succeeded) {
          const backendMessage = response?.message || this.extractFirstError(response) || 'Failed to submit order. Please try again.';
          this.orderSubmitError = backendMessage;
          return;
        }

        this.createdOrderId = (response.data ?? null) as number | null;
        this.orderNumber = payload.orderNo;
        this.orderSubmitted = true;
        this.steps[3].completed = true; // Step 3: Review
        this.steps[4].completed = true; // Step 4: Send
        this.currentStep = 4; // Move to final step (Send)
        this.updateQueryParams(4);
      },
      error: (error: unknown) => {
        this.submittingOrder = false;
        const message = this.resolveHttpErrorMessage(error);
        this.orderSubmitError = message;
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
  }

  private applyUserContext(context: {
    nameEn?: string | null;
    nameAr?: string | null;
    userName?: string | null;
    departmentId?: number | string | null;
  }): void {
    const departmentId = this.toNumber(context.departmentId);
    if (departmentId !== null) {
      this.currentUserDepartmentId = departmentId;
    }

    // Set RequesterId to the current user's ID (string)
    const currentUser = this.backendAuthService.getCurrentUser();
    if (currentUser?.id) {
      this.currentUserRequesterId = currentUser.id;
    } else {
      this.currentUserRequesterId = null;
    }

    const preferredName = this.resolveRequesterDisplayName(context.nameEn, context.nameAr, context.userName);
    if (preferredName) {
      this.fallbackRequesterName = preferredName;
      if (this.lockRequesterName) {
        this.requesterName = preferredName;
      }
    }
  }

  private resolveRequesterDisplayName(
    nameEn?: string | null,
    nameAr?: string | null,
    userName?: string | null
  ): string | null {
    if (nameEn && nameEn.trim().length > 0) {
      return nameEn;
    }
    if (nameAr && nameAr.trim().length > 0) {
      return nameAr;
    }
    if (userName && userName.trim().length > 0) {
      return userName;
    }
    return null;
  }

  private getPreferredRequesterName(): string {
    const name =
      this.currentUserDetails?.nameEn ||
      this.currentUserDetails?.nameAr ||
      this.currentUserDetails?.userName ||
      this.fallbackRequesterName;

    if (name && name.trim().length > 0) {
      return name;
    }

    return 'Name';
  }

  private getDepartmentIdForRequest(): number {
    if (this.currentUserDepartmentId != null) {
      return this.currentUserDepartmentId;
    }
    return this.DEFAULT_DEPARTMENT_ID;
  }

  private getRequesterIdForRequest(): string | null {
    return this.currentUserRequesterId;
  }

  resetForm(): void {
    this.currentStep = 0;
    this.orderSubmitted = false;
    this.steps.forEach(step => step.completed = false);
    this.selectedEntries = [];
    this.allCartridges.forEach(c => {
      c.selected = false;
      c.added = false;
      c.quantity = null;
    });
    this.filteredCartridges = [...this.allCartridges];
    this.selectedBulletDiameter = '';
    this.selectedCaseLength = '';
    this.selectedLinked = '';
    this.selectedNature = '';
    this.fromReserve = 'Yes';
    this.usePurpose = '';
    this.selectedRequestPurposeId = null;
    this.annualDiscardSpecialOps = '';
    this.usageLocation = '';
    this.numberOfOfficers = null;
    this.numberOfOtherRanks = null;
    this.usageDate = '';
    this.usageTime = '';
    this.orderPriority = '';
    this.requesterName = this.lockRequesterName
      ? this.getPreferredRequesterName()
      : 'Name';
    this.requesterComments = '';
    this.orderSubmitError = null;
    this.createdOrderId = null;
    this.orderNumber = null;
    this.submittingOrder = false;
    this.totalReserve = 0;
    this.availableReserve = 0;
    this.orderedQuantity = 0;
    this.utilizedQuantity = 0;
    this.reserveDetailsByItem = [];
    this.updateQueryParams(0);
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private validateBeforeSubmit(): string | null {
    if (this.selectedEntries.length === 0) {
      return 'Please select at least one cartridge before submitting the order.';
    }
    const invalidItem = this.selectedEntries.find(entry => !entry.id || entry.id <= 0 || entry.quantity <= 0);
    if (invalidItem) {
      return 'Selected cartridge is missing required information.';
    }
    if (this.selectedRequestPurposeId === null) {
      return 'Usage purpose is required.';
    }
    if (!this.usageLocation) {
      return 'Usage location is required.';
    }
    if (!this.usageDate) {
      return 'Usage date is required.';
    }
    if (!this.usageTime) {
      return 'Usage time is required.';
    }
    if (!this.orderPriority) {
      return 'Order priority is required.';
    }
    return null;
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now();
    return `ORD-${timestamp}`;
  }

  private combineDateAndTime(dateStr: string, timeStr: string): Date {
    const datePart = dateStr || new Date().toISOString().substring(0, 10);
    const timePart = (timeStr && timeStr.length >= 5) ? timeStr : '00:00';
    const isoString = `${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`;
    return new Date(isoString);
  }

  private formatUsageTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  private parseOptionalInteger(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numeric = typeof value === 'number' ? value : parseInt(value, 10);
    return Number.isNaN(numeric) ? null : numeric;
  }

  private mapAmmunitionToCartridge(dto: any): Cartridge {
    const bulletDiameterLabel = this.buildMeasurementLabel(dto.bulletDiameter, dto.bulletDiameterUnit);
    const caseLengthLabel = this.buildMeasurementLabel(dto.caseLength, dto.caseLengthUnit);
    const linkedLabel = dto.isLinked ? 'Linked' : 'Not Linked';
    const natureLabel = dto.natureOption?.nameEn || dto.natureOption?.nameAr;

    return {
      id: Number(dto.id) || 0,
      name: dto.name || dto.itemNo || 'Ammunition',
      selected: false,
      added: false,
      quantity: null,
      itemNo: dto.itemNo,
      productId: dto.itemNo,
      ncn: dto.nsn || undefined,
      primaryPurpose: dto.primaryPurpos?.nameEn || dto.primaryPurpos?.nameAr,
      projectileColor: dto.projectileColor?.nameEn || dto.projectileColor?.nameAr,
      totalWeight: dto.totalWeight ? `${dto.totalWeight} g` : undefined,
      projectileMaterial: dto.projectailMaterial?.nameEn || dto.projectailMaterial?.nameAr,
      caseType: dto.caseType?.nameEn || dto.caseType?.nameAr,
      primer: dto.primer,
      propellant: dto.propellant?.nameEn || dto.propellant?.nameAr,
      hazardDivision: dto.hazardDivision?.nameEn || dto.hazardDivision?.nameAr,
      capabilityGroup: dto.compatibility?.nameEn || dto.compatibility?.nameAr,
      bulletDiameterLabel,
      caseLengthLabel,
      linkedLabel,
      natureLabel,
      ammunitionType: dto.ammunitionType ? Number(dto.ammunitionType) : undefined
    };
  }

  private buildMeasurementLabel(value: any, unit: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return undefined;
    }
    const unitName = unit?.nameEn || unit?.nameAr;
    return unitName ? `${numeric} ${unitName}` : `${numeric}`;
  }

  private resolveHttpErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = error.error?.message || error.error?.Message || error.error?.title || error.message;
      if (backendMessage) {
        return backendMessage;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Failed to submit order. Please try again.';
  }

  private extractFirstError(response: APIOperationResponse<number> | undefined): string | null {
    if (!response) {
      return null;
    }
    const errors = (response as any)?.errors;
    if (!errors) {
      return null;
    }
    if (Array.isArray(errors) && errors.length > 0) {
      return errors[0].description || errors[0];
    }
    if (typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      const value = (errors as Record<string, any>)[firstKey];
      if (Array.isArray(value) && value.length > 0) {
        return value[0];
      }
      if (typeof value === 'string') {
        return value;
      }
    }
    return null;
  }

  private mapPriorityToEnum(priorityLabel: string): number {
    const normalized = (priorityLabel || '').toLowerCase();
    if (normalized.includes('medium')) return 2;
    if (normalized.includes('low')) return 3;
    return 1; // default high
  }

  private rebuildRequestPurposeOptions(): void {
    this.requestPurposeOptions = this.requestPurposesSource.map(purpose => ({
      label: this.getLocalizedRequestPurposeName(purpose),
      value: purpose.id
    }));
  }

  private normalizeRequestPurposesResponse(
    response: APIOperationResponse<RequestPurposeDto[]> | RequestPurposeDto[] | null | undefined
  ): RequestPurposeDto[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    const payload = response as APIOperationResponse<RequestPurposeDto[]>;
    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    const nested = (payload as any)?.data?.items;
    if (Array.isArray(nested)) {
      return nested as RequestPurposeDto[];
    }

    return [];
  }

  private getLocalizedRequestPurposeName(purpose: RequestPurposeDto): string {
    const currentLang = this.translate.currentLang || this.translate.defaultLang || 'en';
    if (currentLang === 'ar') {
      return purpose.nameAr?.trim() || purpose.nameEn?.trim() || '';
    }
    return purpose.nameEn?.trim() || purpose.nameAr?.trim() || '';
  }

  private updateUsePurposeFromSelection(value: number | null): void {
    if (value === null || value === undefined) {
      this.usePurpose = '';
      this.selectedRequestPurposeId = null;
      return;
    }

    const match = this.requestPurposesSource.find(purpose => purpose.id === value);
    if (match) {
      this.selectedRequestPurposeId = match.id;
      this.usePurpose = this.getLocalizedRequestPurposeName(match);
      return;
    }

    this.selectedRequestPurposeId = null;
    this.usePurpose = '';
  }
}
