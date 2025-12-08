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
import { LookupService, SupplierDto, NatureOptionDto, CountryDto, ManufacturerDto } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { DepotDto } from '@models/depot.model';
import { AmmunitionCreateDto, AmmunitionReadDto } from '@models/ammunition.model';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';

interface AssetForm {
  name: string;
  itemNo: string;
  partNo: string;
  armNumber: string;
  // batchNo, readyForIssue, and expiryDate removed - not in backend CreateUpdateAmmunitionDto
  bulletDiameter: string;
  bulletDiameterUnitId: string;
  isLinked: string;
  primer: string;
  totalWeight: string;
  nsn: string;
  caseTypeId: string;
  propellantId: string;
  compatibilityId: string;
  hazardDivisionId: string;
  // Optional
  natureOptionId: string;
  primaryPurposId: string;
  projectileColorId: string;
  projectailMaterialId: string;
  price: string;
  minimumQuantity: string;
  image?: File;
}

@Component({
  selector: 'app-add-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CardComponent, ButtonComponent, LucideAngularModule, DropdownComponent, HasPermissionDirective, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './add-asset.component.html',
  styleUrls: ['./add-asset.component.css']
})
export class AddAssetComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;

  previewUrl: string | null = null;
  private destroy$ = new Subject<void>();

  // Lookup data
  units: LookupItem[] = [];
  caseTypes: LookupItem[] = [];
  propellants: LookupItem[] = [];
  compatibilities: LookupItem[] = [];
  hazardDivisions: LookupItem[] = [];
  natureOptions: NatureOptionDto[] = [];
  primaryPurposes: LookupItem[] = [];
  projectileColors: LookupItem[] = [];
  projectailMaterials: LookupItem[] = [];
  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) => this.getLocalizedName(this.unwrapOption(option));
  readonly linkedOptions = [
    { label: 'common.no', value: 'false' },
    { label: 'common.yes', value: 'true' }
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
    private router: Router,
    private translateService: TranslateService
  ) { }

  assetForm: AssetForm = {
    name: '',
    itemNo: '',
    partNo: '',
    armNumber: '',
    // batchNo, readyForIssue, and expiryDate removed - not in backend CreateUpdateAmmunitionDto
    bulletDiameter: '',
    bulletDiameterUnitId: '',
    isLinked: 'false',
    primer: '',
    totalWeight: '',
    nsn: '',
    caseTypeId: '',
    propellantId: '',
    compatibilityId: '',
    hazardDivisionId: '',
    natureOptionId: '',
    primaryPurposId: '',
    projectileColorId: '',
    projectailMaterialId: '',
    price: '',
    minimumQuantity: '',
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

  private getLocalizedName(entity: LookupItem | string | number | { nameAr?: string; nameEn?: string; nameEN?: string; label?: string } | null | undefined): string {
    if (!entity) {
      return '';
    }

    if (typeof entity === 'string') {
      return entity;
    }

    if (typeof entity === 'number') {
      return String(entity);
    }

    if (typeof entity === 'object' && 'label' in entity && typeof entity.label === 'string') {
      return entity.label;
    }

    return getLocalizedName(entity, getCurrentLang(this.translateService));
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
    // Only Name and Item No are required, all other fields are optional
    const ammunitionDto = {
      name: this.assetForm.name.trim(),
      itemNo: this.assetForm.itemNo.trim()
    } as AmmunitionCreateDto;

    // Add optional fields only if they have values
    if (this.assetForm.partNo && this.assetForm.partNo.trim()) {
      ammunitionDto.partNo = this.assetForm.partNo.trim();
    }

    if (this.assetForm.bulletDiameter && !isNaN(parseFloat(this.assetForm.bulletDiameter)) && parseFloat(this.assetForm.bulletDiameter) > 0) {
      ammunitionDto.bulletDiameter = parseFloat(this.assetForm.bulletDiameter);
    }

    if (this.assetForm.bulletDiameterUnitId && parseInt(this.assetForm.bulletDiameterUnitId) > 0) {
      ammunitionDto.bulletDiameterUnitId = parseInt(this.assetForm.bulletDiameterUnitId);
    }

    if (this.assetForm.armNumber && this.assetForm.armNumber.trim()) {
      ammunitionDto.armNumber = this.assetForm.armNumber.trim();
    }

    if (this.assetForm.isLinked) {
      ammunitionDto.isLinked = this.assetForm.isLinked === 'true';
    }

    if (this.assetForm.primer && this.assetForm.primer.trim()) {
      ammunitionDto.primer = this.assetForm.primer.trim();
    }

    if (this.assetForm.totalWeight && !isNaN(parseFloat(this.assetForm.totalWeight)) && parseFloat(this.assetForm.totalWeight) > 0) {
      ammunitionDto.totalWeight = parseFloat(this.assetForm.totalWeight);
    }

    if (this.assetForm.caseTypeId && parseInt(this.assetForm.caseTypeId) > 0) {
      ammunitionDto.caseTypeId = parseInt(this.assetForm.caseTypeId);
    }

    if (this.assetForm.propellantId && parseInt(this.assetForm.propellantId) > 0) {
      ammunitionDto.propellantId = parseInt(this.assetForm.propellantId);
    }

    if (this.assetForm.compatibilityId && parseInt(this.assetForm.compatibilityId) > 0) {
      ammunitionDto.compatibilityId = parseInt(this.assetForm.compatibilityId);
    }

    if (this.assetForm.hazardDivisionId && parseInt(this.assetForm.hazardDivisionId) > 0) {
      ammunitionDto.hazardDivisionId = parseInt(this.assetForm.hazardDivisionId);
    }

    // Add optional fields only if they have values
    if (this.assetForm.nsn && this.assetForm.nsn.trim()) {
      ammunitionDto.nsn = this.assetForm.nsn.trim();
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

    if (this.assetForm.price) {
      const priceStr = String(this.assetForm.price).trim();
      if (priceStr && parseFloat(priceStr) > 0) {
        ammunitionDto.price = parseFloat(priceStr);
      }
    }

    if (this.assetForm.minimumQuantity) {
      const minQtyStr = String(this.assetForm.minimumQuantity).trim();
      if (minQtyStr && parseInt(minQtyStr) > 0) {
        ammunitionDto.minimumQuantity = parseInt(minQtyStr);
      }
    }

    // Create FormData to match backend [FromForm] binding
    const formData = new FormData();

    // Append required fields
    formData.append('Name', ammunitionDto.name);
    formData.append('ItemNo', ammunitionDto.itemNo);

    // Append optional fields only if they exist
    if (ammunitionDto.partNo) {
      formData.append('PartNo', ammunitionDto.partNo);
    }
    if (ammunitionDto.bulletDiameter) {
      formData.append('BulletDiameter', ammunitionDto.bulletDiameter.toString());
    }
    if (ammunitionDto.bulletDiameterUnitId) {
      formData.append('BulletDiameterUnitId', ammunitionDto.bulletDiameterUnitId.toString());
    }
    if (ammunitionDto.armNumber) {
      formData.append('ArmNumber', ammunitionDto.armNumber);
    }
    if (ammunitionDto.isLinked !== undefined) {
      formData.append('IsLinked', ammunitionDto.isLinked.toString());
    }
    if (ammunitionDto.primer) {
      formData.append('Primer', ammunitionDto.primer);
    }
    if (ammunitionDto.totalWeight) {
      formData.append('TotalWeight', ammunitionDto.totalWeight.toString());
    }
    if (ammunitionDto.caseTypeId) {
      formData.append('CaseTypeId', ammunitionDto.caseTypeId.toString());
    }
    if (ammunitionDto.propellantId) {
      formData.append('PropellantId', ammunitionDto.propellantId.toString());
    }
    if (ammunitionDto.compatibilityId) {
      formData.append('CompatibilityId', ammunitionDto.compatibilityId.toString());
    }
    if (ammunitionDto.hazardDivisionId) {
      formData.append('HazardDivisionId', ammunitionDto.hazardDivisionId.toString());
    }

    // Optional fields
    if (ammunitionDto.nsn) {
      formData.append('Nsn', ammunitionDto.nsn);
    }
    if (ammunitionDto.natureOptionId) {
      formData.append('NatureOptionId', ammunitionDto.natureOptionId.toString());
    }
    if (ammunitionDto.primaryPurposId) {
      formData.append('PrimaryPurposId', ammunitionDto.primaryPurposId.toString());
    }
    if (ammunitionDto.projectileColorId) {
      formData.append('ProjectileColorId', ammunitionDto.projectileColorId.toString());
    }
    if (ammunitionDto.projectailMaterialId) {
      formData.append('ProjectailMaterialId', ammunitionDto.projectailMaterialId.toString());
    }
    if (ammunitionDto.price) {
      formData.append('Price', ammunitionDto.price.toString());
    }
    if (ammunitionDto.minimumQuantity) {
      formData.append('MinimumQuantity', ammunitionDto.minimumQuantity.toString());
    }

    // Append file(s) if present
    if (this.assetForm.image) {
      formData.append('files', this.assetForm.image);
    }

    const request = this.apiService.postWithAuth<APIOperationResponse<AmmunitionReadDto>>('/Ammunition', formData);

    request.pipe(takeUntil(this.destroy$))
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
        error: (error: unknown) => {
          console.error('Error creating asset:', error);
          let errorMsg = ErrorHandler.extractErrorMessage(error, 'Failed to create asset. Please try again.');
          errorMsg = ErrorHandler.handleDuplicateError(errorMsg, 'Item No');

          this.errorMessage = errorMsg;
          const errorTitle = this.translationService.getTranslation('toast.error');
          this.toastService.error(errorMsg, errorTitle);
          this.submitting = false;
        }
      });
  }

  validateForm(): boolean {
    // Clear previous error
    this.errorMessage = null;

    // Only Name and Item No are required
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
      if (!this.isValidImageType(file)) {
        const errorTitle = this.translationService.getTranslation('toast.error');
        this.toastService.error('Only JPG, JPEG, and PNG image files are allowed.', errorTitle || 'Invalid File Type');
        // Clear the file input
        input.value = '';
        this.assetForm.image = undefined;
        this.previewUrl = null;
        return;
      }
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
      if (!this.isValidImageType(file)) {
        const errorTitle = this.translationService.getTranslation('toast.error');
        this.toastService.error('Only JPG, JPEG, and PNG image files are allowed.', errorTitle || 'Invalid File Type');
        this.assetForm.image = undefined;
        this.previewUrl = null;
        return;
      }
      this.assetForm.image = file;
      this.generatePreview(file);
    }
  }

  private isValidImageType(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    return validTypes.includes(file.type.toLowerCase()) ||
      validExtensions.includes(fileExtension);
  }

  private generatePreview(file: File): void {
    if (!this.isValidImageType(file)) {
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
      armNumber: '',
      // batchNo, readyForIssue, and expiryDate removed - not in backend CreateUpdateAmmunitionDto
      bulletDiameter: '',
      bulletDiameterUnitId: '',
      isLinked: 'false',
      primer: '',
      totalWeight: '',
      nsn: '',
      caseTypeId: '',
      propellantId: '',
      compatibilityId: '',
      hazardDivisionId: '',
      natureOptionId: '',
      primaryPurposId: '',
      projectileColorId: '',
      projectailMaterialId: '',
      price: '',
      minimumQuantity: '',
      image: undefined
    };
    this.previewUrl = null;
    this.errorMessage = null;
    this.formSubmitted = false; // Reset validation state
  }
}
