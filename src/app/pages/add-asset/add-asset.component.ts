import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Save, X } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { LookupService, SupplierDto, NatureOptionDto, HccDto, CountryDto, ManufacturerDto } from '@services/lookup.service';
import { DepotDto } from '@models/depot.model';
import { AmmunitionCreateDto, AmmunitionReadDto } from '@models/ammunition.model';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';

interface AssetForm {
  name: string;
  itemNo: string;
  partNo: string;
  batchNo: string;
  hccId: string;
  bulletDiameter: string;
  bulletDiameterUnitId: string;
  caseLength: string;
  caseLengthUnitId: string;
  isLinked: string;
  primer: string;
  totalWeight: string;
  nsn: string;
  caseTypeId: string;
  propellantId: string;
  compatibilityId: string;
  hazardDivisionId: string;
  expiryDate: string;
  readyForIssue: boolean;
  // Optional
  natureOptionId: string;
  primaryPurposId: string;
  projectileColorId: string;
  projectailMaterialId: string;
  image?: File;
}

@Component({
  selector: 'app-add-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CardComponent, ButtonComponent, LucideAngularModule, DropdownComponent],
  templateUrl: './add-asset.component.html',
  styleUrls: ['./add-asset.component.css']
})
export class AddAssetComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;

  previewUrl: string | null = null;
  private destroy$ = new Subject<void>();

  // Lookup data
  hccs: HccDto[] = [];
  units: any[] = [];
  caseTypes: any[] = [];
  propellants: any[] = [];
  compatibilities: any[] = [];
  hazardDivisions: any[] = [];
  natureOptions: NatureOptionDto[] = [];
  primaryPurposes: any[] = [];
  projectileColors: any[] = [];
  projectailMaterials: any[] = [];
  readonly lookupOptionLabel = (option: DropdownOption<any> | any) => this.getLocalizedName(this.unwrapOption(option));
  readonly linkedOptions = [
    { label: 'common.no', value: 'false' },
    { label: 'common.yes', value: 'true' }
  ];
  readonly readyForIssueOptions = [
    { label: 'common.yes', value: true },
    { label: 'common.no', value: false }
  ];

  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  formSubmitted = false; // Track if form has been submitted to show validation

  constructor(
    private translationService: TranslationService,
    private lookupService: LookupService,
    private apiService: ApiService,
    private toastService: ToastService,
    private router: Router
  ) {}

  assetForm: AssetForm = {
    name: '',
    itemNo: '',
    partNo: '',
    batchNo: '',
    hccId: '',
    bulletDiameter: '',
    bulletDiameterUnitId: '',
    caseLength: '',
    caseLengthUnitId: '',
    isLinked: 'false',
    primer: '',
    totalWeight: '',
    nsn: '',
    caseTypeId: '',
    propellantId: '',
    compatibilityId: '',
    hazardDivisionId: '',
    expiryDate: '',
    readyForIssue: true,
    natureOptionId: '',
    primaryPurposId: '',
    projectileColorId: '',
    projectailMaterialId: '',
    image: undefined
  };

  ngOnInit(): void {
    this.loadLookupData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLookupData(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      hccs: this.lookupService.getHccs(),
      units: this.lookupService.getUnits(),
      caseTypes: this.lookupService.getCaseTypes(),
      propellants: this.lookupService.getPropellants(),
      compatibilities: this.lookupService.getCompatibilities(),
      hazardDivisions: this.lookupService.getHazardDivisions(),
      natureOptions: this.lookupService.getNatureOptions(),
      primaryPurposes: this.lookupService.getPrimaryPurposes(),
      projectileColors: this.lookupService.getColors(),
      projectailMaterials: this.lookupService.getProjectailMaterials()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.hccs = data.hccs;
          this.units = data.units;
          this.caseTypes = data.caseTypes;
          this.propellants = data.propellants;
          this.compatibilities = data.compatibilities;
          this.hazardDivisions = data.hazardDivisions;
          this.natureOptions = data.natureOptions;
          this.primaryPurposes = data.primaryPurposes;
          this.projectileColors = data.projectileColors;
          this.projectailMaterials = data.projectailMaterials;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading lookup data:', error);
          this.errorMessage = 'Failed to load lookup data. Please try again.';
          this.loading = false;
        }
      });
  }

  private getLocalizedName(entity: any): string {
    if (!entity) {
      return '';
    }

    if (typeof entity === 'string') {
      return entity;
    }

    if (typeof entity === 'number') {
      return String(entity);
    }

    const currentLang = this.translationService.getCurrentLanguage ? this.translationService.getCurrentLanguage() : 'en';
    if (currentLang === 'ar') {
      return entity.nameAr || entity.nameEN || entity.nameEn || entity.label || '';
    }
    return entity.nameEn || entity.nameEN || entity.nameAr || entity.label || '';
  }

  private unwrapOption<T>(option: DropdownOption<T> | T): T {
    if (option && typeof option === 'object' && option !== null && 'value' in option) {
      return option.value as T;
    }
    return option as T;
  }

  onSubmit(): void {
    // Mark form as submitted to trigger validation highlighting
    this.formSubmitted = true;

    if (!this.validateForm()) {
      // Scroll to error message
      setTimeout(() => {
        const errorElement = document.querySelector('.bg-red-100');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    // Build DTO matching backend expectations
    const ammunitionDto: any = {
      name: this.assetForm.name.trim(),
      partNo: this.assetForm.partNo.trim(),
      itemNo: this.assetForm.itemNo.trim(),
      batchNo: this.assetForm.batchNo.trim(),
      hccId: parseInt(this.assetForm.hccId),
      bulletDiameter: parseFloat(this.assetForm.bulletDiameter),
      bulletDiameterUnitId: parseInt(this.assetForm.bulletDiameterUnitId),
      caseLength: parseFloat(this.assetForm.caseLength),
      caseLengthUnitId: parseInt(this.assetForm.caseLengthUnitId),
      isLinked: this.assetForm.isLinked === 'true',
      primer: this.assetForm.primer.trim(),
      totalWeight: parseFloat(this.assetForm.totalWeight),
      caseTypeId: parseInt(this.assetForm.caseTypeId),
      propellantId: parseInt(this.assetForm.propellantId),
      compatibilityId: parseInt(this.assetForm.compatibilityId),
      hazardDivisionId: parseInt(this.assetForm.hazardDivisionId),
      readyForIssue: this.assetForm.readyForIssue
    };

    // Add optional fields only if they have values
    if (this.assetForm.nsn && this.assetForm.nsn.trim()) {
      ammunitionDto.nsn = this.assetForm.nsn.trim();
    }

    if (this.assetForm.expiryDate) {
      ammunitionDto.expiryDate = this.assetForm.expiryDate;
    }

    if (this.assetForm.natureOptionId && parseInt(this.assetForm.natureOptionId) > 0) {
      ammunitionDto.natureOptionId = parseInt(this.assetForm.natureOptionId);
    }

    if (this.assetForm.primaryPurposId && parseInt(this.assetForm.primaryPurposId) > 0) {
      ammunitionDto.primaryPurposId = parseInt(this.assetForm.primaryPurposId);
    }

    if (this.assetForm.projectileColorId && parseInt(this.assetForm.projectileColorId) > 0) {
      ammunitionDto.projectileColorId = parseInt(this.assetForm.projectileColorId);
    }

    if (this.assetForm.projectailMaterialId && parseInt(this.assetForm.projectailMaterialId) > 0) {
      ammunitionDto.projectailMaterialId = parseInt(this.assetForm.projectailMaterialId);
    }

    this.apiService.postWithAuth<APIOperationResponse<AmmunitionReadDto>>('/Ammunition', ammunitionDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            const successMessage = this.translationService.getTranslation('addAsset.successMessage');
            const successTitle = this.translationService.getTranslation('toast.success');
            const successText = successMessage && successMessage !== 'addAsset.successMessage'
              ? successMessage
              : 'Asset created successfully';
            this.toastService.success(successText, successTitle);
            console.log('Asset created:', response.data);
            setTimeout(() => {
              this.router.navigate(['/asset-list']);
            }, 800);
          } else {
            const fallback = 'Failed to create asset';
            this.errorMessage = response.message || fallback;
            const errorTitle = this.translationService.getTranslation('toast.error');
            this.toastService.error(this.errorMessage ?? fallback, errorTitle);
          }
          this.submitting = false;
        },
        error: (error) => {
          console.error('Error creating asset:', error);
          const fallback = 'Failed to create asset. Please try again.';
          this.errorMessage = error?.message || fallback;
          const errorTitle = this.translationService.getTranslation('toast.error');
          this.toastService.error(this.errorMessage ?? fallback, errorTitle);
          this.submitting = false;
        }
      });
  }

  validateForm(): boolean {
    // Clear previous error
    this.errorMessage = null;

    // Required field validations matching backend
    if (!this.assetForm.name || this.assetForm.name.trim().length === 0) {
      this.errorMessage = 'Name is required';
      return false;
    }
    if (this.assetForm.name.length > 200) {
      this.errorMessage = 'Name cannot exceed 200 characters';
      return false;
    }

    if (!this.assetForm.itemNo || this.assetForm.itemNo.trim().length === 0) {
      this.errorMessage = 'Item number is required';
      return false;
    }
    if (this.assetForm.itemNo.length > 100) {
      this.errorMessage = 'Item number cannot exceed 100 characters';
      return false;
    }

    if (!this.assetForm.batchNo || this.assetForm.batchNo.trim().length === 0) {
      this.errorMessage = 'Batch number is required';
      return false;
    }
    if (this.assetForm.batchNo.length > 100) {
      this.errorMessage = 'Batch number cannot exceed 100 characters';
      return false;
    }

    if (!this.assetForm.hccId || parseInt(this.assetForm.hccId) <= 0) {
      this.errorMessage = 'HCC is required';
      return false;
    }

    if (this.assetForm.partNo && this.assetForm.partNo.length > 100) {
      this.errorMessage = 'Part number cannot exceed 100 characters';
      return false;
    }

    // Numeric validations
    const bulletDiameter = parseFloat(this.assetForm.bulletDiameter);
    if (!this.assetForm.bulletDiameter || isNaN(bulletDiameter) || bulletDiameter <= 0) {
      this.errorMessage = 'Bullet diameter must be greater than 0';
      return false;
    }

    if (!this.assetForm.bulletDiameterUnitId || parseInt(this.assetForm.bulletDiameterUnitId) <= 0) {
      this.errorMessage = 'Bullet diameter unit is required';
      return false;
    }

    const caseLength = parseFloat(this.assetForm.caseLength);
    if (!this.assetForm.caseLength || isNaN(caseLength) || caseLength <= 0) {
      this.errorMessage = 'Case length must be greater than 0';
      return false;
    }

    if (!this.assetForm.caseLengthUnitId || parseInt(this.assetForm.caseLengthUnitId) <= 0) {
      this.errorMessage = 'Case length unit is required';
      return false;
    }

    if (!this.assetForm.primer || this.assetForm.primer.trim().length === 0) {
      this.errorMessage = 'Primer is required';
      return false;
    }

    if (this.assetForm.primer && this.assetForm.primer.length > 100) {
      this.errorMessage = 'Primer cannot exceed 100 characters';
      return false;
    }

    const totalWeight = parseFloat(this.assetForm.totalWeight);
    if (!this.assetForm.totalWeight || isNaN(totalWeight) || totalWeight <= 0) {
      this.errorMessage = 'Total weight must be greater than 0';
      return false;
    }

    if (!this.assetForm.caseTypeId || parseInt(this.assetForm.caseTypeId) <= 0) {
      this.errorMessage = 'Case type is required';
      return false;
    }

    if (!this.assetForm.propellantId || parseInt(this.assetForm.propellantId) <= 0) {
      this.errorMessage = 'Propellant is required';
      return false;
    }

    if (!this.assetForm.compatibilityId || parseInt(this.assetForm.compatibilityId) <= 0) {
      this.errorMessage = 'Compatibility is required';
      return false;
    }

    if (!this.assetForm.hazardDivisionId || parseInt(this.assetForm.hazardDivisionId) <= 0) {
      this.errorMessage = 'Hazard division is required';
      return false;
    }

    // Expiry date validation (must be in the future if provided)
    if (this.assetForm.expiryDate) {
      const expiryDate = new Date(this.assetForm.expiryDate);
      const now = new Date();
      if (expiryDate <= now) {
        this.errorMessage = 'Expiry date must be in the future';
        return false;
      }
    }

    // Optional field validations (only validate if provided)
    if (this.assetForm.natureOptionId && parseInt(this.assetForm.natureOptionId) <= 0) {
      this.errorMessage = 'Nature option ID must be greater than 0 when provided';
      return false;
    }

    if (this.assetForm.primaryPurposId && parseInt(this.assetForm.primaryPurposId) <= 0) {
      this.errorMessage = 'Primary purpose ID must be greater than 0 when provided';
      return false;
    }

    if (this.assetForm.projectileColorId && parseInt(this.assetForm.projectileColorId) <= 0) {
      this.errorMessage = 'Projectile color ID must be greater than 0 when provided';
      return false;
    }

    if (this.assetForm.projectailMaterialId && parseInt(this.assetForm.projectailMaterialId) <= 0) {
      this.errorMessage = 'Projectile material ID must be greater than 0 when provided';
      return false;
    }

    return true;
  }

  onCancel(): void {
    this.resetForm();
  }

  triggerFileInput(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.assetForm.image = file;
      this.generatePreview(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      this.assetForm.image = file;
      this.generatePreview(file);
    }
  }

  private generatePreview(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.previewUrl = null;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Get CSS classes for input field based on validation state
   */
  getInputClass(isInvalid: boolean | null | undefined, isDirty: boolean | null | undefined, isTouched: boolean | null | undefined): string {
    const baseClasses = 'flex-1 px-4 py-2.5 bg-white rounded-lg border text-sm text-[#23272E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2';
    
    const showError = !!isInvalid && (!!isDirty || !!isTouched || this.formSubmitted);

    if (showError) {
      return `${baseClasses} border-red-500 focus:ring-red-500`;
    }
    
    return `${baseClasses} focus:ring-[var(--color-brand)]`;
  }

  /**
   * Check if validation error should be shown
   */
  shouldShowError(isInvalid: boolean | null | undefined, isDirty: boolean | null | undefined, isTouched: boolean | null | undefined): boolean {
    return !!isInvalid && (!!isDirty || !!isTouched || this.formSubmitted);
  }

  private resetForm(): void {
    this.assetForm = {
      name: '',
      itemNo: '',
      partNo: '',
      batchNo: '',
      hccId: '',
      bulletDiameter: '',
      bulletDiameterUnitId: '',
      caseLength: '',
      caseLengthUnitId: '',
      isLinked: 'false',
      primer: '',
      totalWeight: '',
      nsn: '',
      caseTypeId: '',
      propellantId: '',
      compatibilityId: '',
      hazardDivisionId: '',
      expiryDate: '',
      readyForIssue: true,
      natureOptionId: '',
      primaryPurposId: '',
      projectileColorId: '',
      projectailMaterialId: '',
      image: undefined
    };
    this.previewUrl = null;
    this.errorMessage = null;
    this.formSubmitted = false; // Reset validation state
  }
}
