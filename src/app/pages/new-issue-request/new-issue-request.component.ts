import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
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
export class NewIssueRequestComponent implements OnInit {
  currentStep = 0;
  steps: Step[] = [
    { label: 'newIssueRequest.selection', completed: false },
    { label: 'newIssueRequest.usage', completed: false },
    { label: 'newIssueRequest.review', completed: false },
    { label: 'newIssueRequest.send', completed: false }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ammunitionService: AmmunitionService,
    private orderService: OrderService
  ) {}

  // Step 1: Selection filters (populated from API)
  bulletDiameters: string[] = [];
  caseLengths: string[] = [];
  linkedOptions: string[] = ['Linked', 'Not Linked'];
  natureOptions: string[] = [];
  orderPriorities = ['High Priority', 'Medium Priority', 'Low Priority'];

  selectedBulletDiameter = '';
  selectedCaseLength = '';
  selectedLinked = '';
  selectedNature = '';
  selectedPriority = '';

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
    const hasPriority = !!this.selectedPriority;
    const quantitiesValid = this.selectedEntries.every(entry => entry.quantity > 0);
    return hasSelection && hasPriority && quantitiesValid;
  }

  ngOnInit(): void {
    this.loadCartridges();
    this.initializeStepFromQueryParams();
  }

  private loadCartridges(): void {
    this.loadingCartridges = true;
    this.cartridgeError = null;

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
        }
      }
    });
  }

  private updateQueryParams(step: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: step },
      queryParamsHandling: 'merge'
    });
  }

  filterCartridges(): void {
    this.filteredCartridges = this.allCartridges.filter(cartridge => {
      const diameterLabel = cartridge.bulletDiameterLabel ?? '';
      const caseLabel = cartridge.caseLengthLabel ?? '';
      const linkedLabel = cartridge.linkedLabel ?? '';
      const natureLabel = cartridge.natureLabel ?? '';

      const byDiameter = !this.selectedBulletDiameter || this.selectedBulletDiameter === diameterLabel;
      const byCase = !this.selectedCaseLength || this.selectedCaseLength === caseLabel;
      const byLinked = !this.selectedLinked || this.selectedLinked === linkedLabel;
      const byNature = !this.selectedNature || this.selectedNature === natureLabel;
      return byDiameter && byCase && byLinked && byNature;
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
    this.selectedBulletDiameter = '';
    this.selectedCaseLength = '';
    this.selectedLinked = '';
    this.selectedNature = '';
    this.selectedPriority = '';
    this.filterCartridges();
  }

  onStepChange(step: number): void {
    this.currentStep = step;
    this.updateQueryParams(step);
  }

  onConfirmSelection(): void {
    if (this.canProceedFromSelection) {
      this.steps[0].completed = true;
      this.currentStep = 1;
      this.updateQueryParams(1);
    }
  }

  onNext(): void {
    if (this.submittingOrder) {
      return;
    }

    if (this.currentStep === 0 && !this.canProceedFromSelection) {
      return;
    }

    if (this.currentStep === 2) {
      this.onSubmitOrder();
      return;
    }

    if (this.currentStep < this.steps.length - 1) {
      this.steps[this.currentStep].completed = true;
      this.currentStep++;
      this.updateQueryParams(this.currentStep);
    }
  }

  onPrevious(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateQueryParams(this.currentStep);
    }
  }

  // Step 2: Usage form data
  fromReserve: string = 'Yes';
  usePurpose: string = '';
  annualDiscardSpecialOps: string = '';
  usageLocation: string = '';
  numberOfOfficers: number | null = null;
  numberOfOtherRanks: number | null = null;
  usageDate: string = '';
  usageTime: string = '';

  // Reserve details (read-only)
  totalReserve = 150000;
  availableReserve = 100000;
  orderedQuantity = 50000;
  utilizedQuantity = 50000;

  // Step 3: Review - Requester Details
  requesterName: string = 'Name';
  requesterComments: string = 'None';

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
      this.currentStep = 2;
      this.updateQueryParams(2);
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
      priority: this.mapPriorityToEnum(this.selectedPriority),
      notes: this.requesterComments || '',
      departmentId: this.DEFAULT_DEPARTMENT_ID,
      requestTypeId: this.DEFAULT_REQUEST_TYPE_ID,
      requesterId: null,
      recieverId: null,
      depotId: null,
      requestPurposeId: this.DEFAULT_REQUEST_PURPOSE_ID,
      isFromAllowance: this.fromReserve === 'Yes',
      usageDate: usageDateTime.toISOString(),
      usageTime: this.formatUsageTime(usageDateTime),
      usagePurpose: this.usePurpose || 'General usage',
      annualDiscard: this.parseOptionalInteger(this.annualDiscardSpecialOps),
      usageLocation: this.usageLocation || 'N/A',
      numberOfOfficer: this.numberOfOfficers ?? null,
      numberOfOtherRank: this.numberOfOtherRanks ?? null,
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
        this.steps[2].completed = true;
        this.steps[3].completed = true;
        this.currentStep = 3;
        this.updateQueryParams(3);
      },
      error: (error: unknown) => {
        this.submittingOrder = false;
        const message = this.resolveHttpErrorMessage(error);
        this.orderSubmitError = message;
      }
    });
  }

  onTrackOrder(): void {
 
    console.log('Track Order clicked');
 
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
    this.selectedPriority = '';
    this.selectedBulletDiameter = '';
    this.selectedCaseLength = '';
    this.selectedLinked = '';
    this.selectedNature = '';
    this.fromReserve = 'Yes';
    this.usePurpose = '';
    this.annualDiscardSpecialOps = '';
    this.usageLocation = '';
    this.numberOfOfficers = null;
    this.numberOfOtherRanks = null;
    this.usageDate = '';
    this.usageTime = '';
    this.requesterName = 'Name';
    this.requesterComments = 'None';
    this.orderSubmitError = null;
    this.createdOrderId = null;
    this.orderNumber = null;
    this.submittingOrder = false;
    this.updateQueryParams(0);
  }

  private validateBeforeSubmit(): string | null {
    if (this.selectedEntries.length === 0) {
      return 'Please select at least one cartridge before submitting the order.';
    }
    const invalidItem = this.selectedEntries.find(entry => !entry.id || entry.id <= 0 || entry.quantity <= 0);
    if (invalidItem) {
      return 'Selected cartridge is missing required information.';
    }
    if (!this.selectedPriority) {
      return 'Order priority is required.';
    }
    if (!this.usePurpose) {
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
    return null;
  }

  private mapPriorityToEnum(priorityLabel: string): number {
    const normalized = (priorityLabel || '').toLowerCase();
    if (normalized.includes('medium')) return 2;
    if (normalized.includes('low')) return 3;
    return 1; // default high
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
      ncn: dto.nsn?.nameEn || dto.nsn?.nameAr,
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
      natureLabel
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
}
