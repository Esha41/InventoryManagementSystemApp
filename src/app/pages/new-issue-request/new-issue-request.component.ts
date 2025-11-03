import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { StepperComponent, Step } from '@components/stepper/stepper.component';
import { CartridgeDetailsComponent, CartridgeDetails } from './components/cartridge-details/cartridge-details.component';
import { CartridgeListComponent, Cartridge } from './components/cartridge-list/cartridge-list.component';
import { AmmunitionService } from '@services/ammunition.service';
import { UsageFormComponent } from './components/usage-form/usage-form.component';
import { ReviewFormComponent } from './components/review-form/review-form.component';

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
    private ammunitionService: AmmunitionService
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
  selectedPriority = 'High Priority';
  quantity: number | null = null;

  cartridges: Cartridge[] = [];
  private ammunitionRaw: any[] = [];

  filteredCartridges: Cartridge[] = [];
  selectedCartridgeForView: CartridgeDetails | null = null;
  showCartridgeDetails: boolean = false;

  ngOnInit(): void {
    this.loadCartridges();
    this.initializeStepFromQueryParams();
  }

  private loadCartridges(): void {
    this.ammunitionService.getAll<any>().subscribe({
      next: (items) => {
        this.ammunitionRaw = items || [];
        this.cartridges = this.ammunitionRaw.map((x: any) => ({
          name: x.name || x.itemNo || 'Ammunition',
          selected: false,
          productId: x.itemNo,
          ncn: x.nsn?.nameEn || x.nsn?.nameAr,
          primaryPurpose: x.primaryPurpos?.nameEn || x.primaryPurpos?.nameAr,
          projectileColor: x.projectileColor?.nameEn || x.projectileColor?.nameAr,
          totalWeight: x.totalWeight ? `${x.totalWeight} g` : undefined,
          projectileMaterial: x.projectailMaterial?.nameEn || x.projectailMaterial?.nameAr,
          caseType: x.caseType?.nameEn || x.caseType?.nameAr,
          primer: x.primer,
          propellant: x.propellant?.nameEn || x.propellant?.nameAr,
          hazardDivision: x.hazardDivision?.nameEn || x.hazardDivision?.nameAr,
          capabilityGroup: x.compatibility?.nameEn || x.compatibility?.nameAr
        }));
        this.buildFilterOptions();
        this.filterCartridges();
      },
      error: () => {
        this.cartridges = [];
        this.filterCartridges();
      }
    });
  }

  private buildFilterOptions(): void {
    const diameters = new Set<string>();
    const caseLens = new Set<string>();
    const natures = new Set<string>();

    for (const x of this.ammunitionRaw) {
      const diameterLabel = x.bulletDiameter != null
        ? `${x.bulletDiameter}${x.bulletDiameterUnit?.nameEn ? ' ' + x.bulletDiameterUnit.nameEn : ''}`
        : undefined;
      if (diameterLabel) diameters.add(diameterLabel);

      const caseLabel = x.caseLength != null
        ? `${x.bulletDiameter ?? ''}${x.bulletDiameter ? ' x ' : ''}${x.caseLength}`
        : undefined;
      if (caseLabel) caseLens.add(caseLabel);

      const natureLabel = x.natureOption?.nameEn || x.natureOption?.nameAr;
      if (natureLabel) natures.add(natureLabel);
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
    this.filteredCartridges = this.ammunitionRaw
      .filter((x: any) => {
        const diameterLabel = x.bulletDiameter != null
          ? `${x.bulletDiameter}${x.bulletDiameterUnit?.nameEn ? ' ' + x.bulletDiameterUnit.nameEn : ''}`
          : '';
        const caseLabel = x.caseLength != null
          ? `${x.bulletDiameter ?? ''}${x.bulletDiameter ? ' x ' : ''}${x.caseLength}`
          : '';
        const natureLabel = x.natureOption?.nameEn || x.natureOption?.nameAr || '';
        const linkedLabel = x.isLinked ? 'Linked' : 'Not Linked';

        const byDiameter = !this.selectedBulletDiameter || this.selectedBulletDiameter === diameterLabel;
        const byCase = !this.selectedCaseLength || this.selectedCaseLength === caseLabel;
        const byLinked = !this.selectedLinked || this.selectedLinked === linkedLabel;
        const byNature = !this.selectedNature || this.selectedNature === natureLabel;
        return byDiameter && byCase && byLinked && byNature;
      })
      .map((x: any) => ({
        name: x.name || x.itemNo || 'Ammunition',
        selected: false,
        productId: x.itemNo,
        ncn: x.nsn?.nameEn || x.nsn?.nameAr,
        primaryPurpose: x.primaryPurpos?.nameEn || x.primaryPurpos?.nameAr,
        projectileColor: x.projectileColor?.nameEn || x.projectileColor?.nameAr,
        totalWeight: x.totalWeight ? `${x.totalWeight} g` : undefined,
        projectileMaterial: x.projectailMaterial?.nameEn || x.projectailMaterial?.nameAr,
        caseType: x.caseType?.nameEn || x.caseType?.nameAr,
        primer: x.primer,
        propellant: x.propellant?.nameEn || x.propellant?.nameAr,
        hazardDivision: x.hazardDivision?.nameEn || x.hazardDivision?.nameAr,
        capabilityGroup: x.compatibility?.nameEn || x.compatibility?.nameAr
      }));
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
    // Show detailed view instead of toggling selection
    this.selectedCartridgeForView = cartridge;
    this.showCartridgeDetails = true;
  }

  onCloseCartridgeDetails(): void {
    this.showCartridgeDetails = false;
    this.selectedCartridgeForView = null;
  }

  onSelectCartridge(): void {
    if (this.selectedCartridgeForView) {
      const cartridge = this.cartridges.find(c => c.name === this.selectedCartridgeForView?.name);
      if (cartridge) {
        cartridge.selected = true;
      }
      this.showCartridgeDetails = false;
      this.selectedCartridgeForView = null;
    }
  }

  onClearFilters(): void {
    this.selectedBulletDiameter = '';
    this.selectedCaseLength = '';
    this.selectedLinked = '';
    this.selectedNature = '';
    this.selectedPriority = this.orderPriorities[0] || '';
    this.quantity = null;
    this.filterCartridges();
  }

  onStepChange(step: number): void {
    this.currentStep = step;
    this.updateQueryParams(step);
  }

  onConfirmSelection(): void {
    const hasSelection = this.cartridges.some(c => c.selected);
    if (hasSelection) {
      this.steps[0].completed = true;
      this.currentStep = 1;
      this.updateQueryParams(1);
    }
  }

  onNext(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.steps[this.currentStep].completed = true;
      this.currentStep++;
      this.updateQueryParams(this.currentStep);
      
      // Auto-submit order when reaching the Send step
      if (this.currentStep === 3) {
        this.onSubmitOrder();
      }
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

    this.orderSubmitted = true;
  }

  onTrackOrder(): void {
 
    console.log('Track Order clicked');
 
  }

  resetForm(): void {
    this.currentStep = 0;
    this.orderSubmitted = false;
    this.steps.forEach(step => step.completed = false);
    this.cartridges.forEach(c => c.selected = false);
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
    this.updateQueryParams(0);
  }
}
