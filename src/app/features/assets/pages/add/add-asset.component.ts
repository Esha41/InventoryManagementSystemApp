import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Save, X } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { LookupService, NatureOptionDto } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { AmmunitionCreateDto, AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto, CreateUpdateWeaponDto } from '@models/weapon.model';
import { ExplosiveDto, CreateUpdateExplosiveDto } from '@models/explosive.model';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { DropdownOption, DropdownComponent } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';

interface AssetForm {
  name: string;
  itemNo: string;
  partNo: string;
  // Shared
  armNumber: string;
  totalWeight: string;
  nsn: string;
  price: string;
  minimumQuantity: string;
  unNumber: string;
  distribution: string;
  referenceNo: string;
  classificationId: string;
  typeId: string;
  notes: string;
  image?: File;

  // Ammunition specific
  bulletDiameter: string;
  bulletDiameterUnitId: string;
  isLinked: string;
  primer: string;
  caseTypeId: string;
  propellantId: string;
  compatibilityId: string;
  hazardDivisionId: string;
  natureOptionId: string;
  primaryPurposId: string;
  projectileColorId: string;
  projectailMaterialId: string;

  // Weapon specific
  caliber: string;
  caliberUnitId: string;
  yearOfManufacture: string;
  countryOfManufactureId: string;
  model: string;

  // Explosive specific
  explosiveType: string;
  netExplosiveQuantity: string;
  netExplosiveQuantityUnitId: string;
  unit: string; // ExplosiveUnit enum: 1 = Gram, 3 = Meter
}

type AssetType = 'ammunition' | 'weapon' | 'explosive';

@Component({
  selector: 'app-add-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CardComponent, LucideAngularModule, DropdownComponent, HasPermissionDirective, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './add-asset.component.html',
  styleUrls: ['./add-asset.component.css']
})
export class AddAssetComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;

  previewUrl: string | null = null;
  private destroy$ = new Subject<void>();

  activeTab: AssetType = 'ammunition';

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
  classifications: LookupItem[] = [];
  itemTypes: LookupItem[] = [];
  countries: LookupItem[] = [];

  // Enum Options
  explosiveTypeOptions = getExplosiveTypeOptions();

  // ExplosiveUnit enum options: 1 = Gram, 3 = Meter
  explosiveUnitOptions = [
    { label: 'Gram', value: '1' },
    { label: 'Meter', value: '3' }
  ];

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) => this.getLocalizedName(this.unwrapOption(option));
  readonly explosiveUnitOptionLabel = (option: DropdownOption<string> | string): string => {
    if (typeof option === 'string') {
      return option;
    }
    return (option as any).label || '';
  };
  readonly linkedOptions = [
    { label: 'common.no', value: 'false' },
    { label: 'common.yes', value: 'true' }
  ];

  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  formSubmitted = false;

  constructor(
    private translationService: TranslationService,
    private lookupService: LookupService,
    private apiService: ApiService,
    private ammunitionsService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private translateService: TranslateService
  ) { }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  assetForm: AssetForm = this.getInitialForm();

  private getInitialForm(): AssetForm {
    return {
      name: '',
      itemNo: '',
      partNo: '',
      armNumber: '',
      totalWeight: '',
      nsn: '',
      price: '',
      minimumQuantity: '',
      unNumber: '',
      distribution: '',
      referenceNo: '',
      classificationId: '',
      typeId: '',
      notes: '',
      image: undefined,

      // Ammunition
      bulletDiameter: '',
      bulletDiameterUnitId: '',
      isLinked: 'false',
      primer: '',
      caseTypeId: '',
      propellantId: '',
      compatibilityId: '',
      hazardDivisionId: '',
      natureOptionId: '',
      primaryPurposId: '',
      projectileColorId: '',
      projectailMaterialId: '',

      // Weapon
      caliber: '',
      caliberUnitId: '',
      yearOfManufacture: '',
      countryOfManufactureId: '',
      model: '',

      // Explosive
      explosiveType: '',
      netExplosiveQuantity: '',
      netExplosiveQuantityUnitId: '',
      unit: '1' // Default to Gram (ExplosiveUnit enum: 1 = Gram, 3 = Meter)
    };
  }

  ngOnInit(): void {
    // Check for tab query parameter
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const tab = params['tab'];
      if (tab && (tab === 'ammunition' || tab === 'weapon' || tab === 'explosive')) {
        this.activeTab = tab;
      }
    });

    this.loadLookupData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setActiveTab(tab: AssetType) {
    this.activeTab = tab;
    this.formSubmitted = false;
    this.errorMessage = null;
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
      projectailMaterials: this.lookupService.getProjectailMaterials(),
      classifications: this.lookupService.getLookupItems('Classification'),
      itemTypes: this.lookupService.getLookupItems('ItemType'),
      countries: this.lookupService.getCountries()
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
          this.classifications = data.classifications;
          this.itemTypes = data.itemTypes;
          this.countries = data.countries;
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Failed to load lookup data. Please try again.';
          this.loading = false;
        }
      });
  }

  private getLocalizedName(entity: LookupItem | string | number | { nameAr?: string; nameEn?: string; nameEN?: string; label?: string } | null | undefined): string {
    if (!entity) return '';
    if (typeof entity === 'string') return entity;
    if (typeof entity === 'number') return String(entity);
    if (typeof entity === 'object' && 'label' in entity && typeof entity.label === 'string') return entity.label;
    return getLocalizedName(entity, getCurrentLang(this.translateService));
  }

  private unwrapOption<T>(option: DropdownOption<T> | T): T {
    if (option && typeof option === 'object' && option !== null && 'value' in option) {
      return option.value as T;
    }
    return option as T;
  }

  onSubmit(): void {
    this.formSubmitted = true;
    if (!this.validateForm()) {
      setTimeout(() => {
        const errorElement = document.querySelector('.bg-red-100');
        if (errorElement) errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    if (this.activeTab === 'ammunition') {
      this.submitAmmunition();
    } else if (this.activeTab === 'weapon') {
      this.submitWeapon();
    } else if (this.activeTab === 'explosive') {
      this.submitExplosive();
    }
  }

  private submitAmmunition() {
    const dto: AmmunitionCreateDto = {
      name: this.assetForm.name.trim(),
      itemNo: this.assetForm.itemNo.trim()
    };

    if (this.assetForm.partNo?.trim()) dto.partNo = this.assetForm.partNo.trim();
    if (this.assetForm.armNumber?.trim()) dto.armNumber = this.assetForm.armNumber.trim();
    if (this.assetForm.primer?.trim()) dto.primer = this.assetForm.primer.trim();
    if (this.assetForm.nsn?.trim()) dto.nsn = this.assetForm.nsn.trim();

    if (this.assetForm.bulletDiameter) dto.bulletDiameter = parseFloat(this.assetForm.bulletDiameter);
    if (this.assetForm.bulletDiameterUnitId) dto.bulletDiameterUnitId = parseInt(this.assetForm.bulletDiameterUnitId);
    if (this.assetForm.totalWeight) dto.totalWeight = parseFloat(this.assetForm.totalWeight);
    if (this.assetForm.caseTypeId) dto.caseTypeId = parseInt(this.assetForm.caseTypeId);
    if (this.assetForm.propellantId) dto.propellantId = parseInt(this.assetForm.propellantId);
    if (this.assetForm.compatibilityId) dto.compatibilityId = parseInt(this.assetForm.compatibilityId);
    if (this.assetForm.hazardDivisionId) dto.hazardDivisionId = parseInt(this.assetForm.hazardDivisionId);
    if (this.assetForm.natureOptionId) dto.natureOptionId = parseInt(this.assetForm.natureOptionId);
    if (this.assetForm.primaryPurposId) dto.primaryPurposId = parseInt(this.assetForm.primaryPurposId);
    if (this.assetForm.projectileColorId) dto.projectileColorId = parseInt(this.assetForm.projectileColorId);
    if (this.assetForm.projectailMaterialId) dto.projectailMaterialId = parseInt(this.assetForm.projectailMaterialId);
    if (this.assetForm.distribution?.trim()) dto.distribution = this.assetForm.distribution.trim();
    if (this.assetForm.unNumber?.trim()) dto.unNumber = this.assetForm.unNumber.trim();
    if (this.assetForm.referenceNo?.trim()) dto.referenceNo = this.assetForm.referenceNo.trim();
    if (this.assetForm.classificationId) dto.classificationId = parseInt(this.assetForm.classificationId);
    if (this.assetForm.typeId) dto.typeId = parseInt(this.assetForm.typeId);
    if (this.assetForm.notes?.trim()) dto.notes = this.assetForm.notes.trim();
    if (this.assetForm.price) dto.price = parseFloat(this.assetForm.price);
    if (this.assetForm.minimumQuantity) dto.minimumQuantity = parseInt(this.assetForm.minimumQuantity);
    if (this.assetForm.isLinked) dto.isLinked = this.assetForm.isLinked === 'true';

    const formData = new FormData();
    Object.keys(dto).forEach(key => {
      const val = dto[key as keyof AmmunitionCreateDto];
      if (val !== undefined && val !== null) {
        const capKey = key.charAt(0).toUpperCase() + key.slice(1);
        formData.append(capKey, val.toString());
      }
    });

    if (this.assetForm.image) {
      formData.append('files', this.assetForm.image);
    }

    const request = this.apiService.postWithAuth<APIOperationResponse<AmmunitionReadDto>>('/Ammunition', formData);
    request.pipe(takeUntil(this.destroy$)).subscribe(this.getSubmitObserver());
  }

  private submitWeapon() {
    const dto: CreateUpdateWeaponDto = {
      name: this.assetForm.name.trim(),
      itemNo: this.assetForm.itemNo.trim()
    };

    if (this.assetForm.partNo?.trim()) dto.partNo = this.assetForm.partNo.trim();
    if (this.assetForm.nsn?.trim()) dto.nsn = this.assetForm.nsn.trim();
    if (this.assetForm.distribution?.trim()) dto.distribution = this.assetForm.distribution.trim();
    if (this.assetForm.referenceNo?.trim()) dto.referenceNo = this.assetForm.referenceNo.trim();
    if (this.assetForm.unNumber?.trim()) dto.unNumber = this.assetForm.unNumber.trim();
    if (this.assetForm.notes?.trim()) dto.notes = this.assetForm.notes.trim();
    if (this.assetForm.classificationId) dto.classificationId = parseInt(this.assetForm.classificationId);
    if (this.assetForm.typeId) dto.typeId = parseInt(this.assetForm.typeId);
    if (this.assetForm.caliber?.trim()) dto.caliber = this.assetForm.caliber.trim();
    if (this.assetForm.caliberUnitId) dto.caliberUnitId = parseInt(this.assetForm.caliberUnitId);
    if (this.assetForm.yearOfManufacture) dto.yearOfManufacture = parseInt(this.assetForm.yearOfManufacture);
    if (this.assetForm.countryOfManufactureId) dto.countryOfManufactureId = parseInt(this.assetForm.countryOfManufactureId);
    if (this.assetForm.model?.trim()) dto.model = this.assetForm.model.trim();
    if (this.assetForm.price) dto.price = parseFloat(this.assetForm.price);
    if (this.assetForm.minimumQuantity) dto.minimumQuantity = parseInt(this.assetForm.minimumQuantity);

    const formData = new FormData();
    Object.keys(dto).forEach(key => {
      const val = dto[key as keyof CreateUpdateWeaponDto];
      if (val !== undefined && val !== null) {
        const capKey = key.charAt(0).toUpperCase() + key.slice(1);
        formData.append(capKey, val.toString());
      }
    });

    if (this.assetForm.image) {
      formData.append('files', this.assetForm.image);
    }

    const request = this.apiService.postWithAuth<APIOperationResponse<WeaponDto>>('/Weapon', formData);
    request.pipe(takeUntil(this.destroy$)).subscribe(this.getSubmitObserver());
  }

  private submitExplosive() {
    const dto: CreateUpdateExplosiveDto = {
      name: this.assetForm.name.trim(),
      itemNo: this.assetForm.itemNo.trim()
    };

    if (this.assetForm.partNo?.trim()) dto.partNo = this.assetForm.partNo.trim();
    if (this.assetForm.nsn?.trim()) dto.nsn = this.assetForm.nsn.trim();
    if (this.assetForm.price) dto.price = parseFloat(this.assetForm.price);
    if (this.assetForm.minimumQuantity) dto.minimumQuantity = parseInt(this.assetForm.minimumQuantity);
    if (this.assetForm.distribution?.trim()) dto.distribution = this.assetForm.distribution.trim();
    if (this.assetForm.referenceNo?.trim()) dto.referenceNo = this.assetForm.referenceNo.trim();
    if (this.assetForm.unNumber?.trim()) dto.unNumber = this.assetForm.unNumber.trim();
    if (this.assetForm.notes?.trim()) dto.notes = this.assetForm.notes.trim();
    if (this.assetForm.classificationId) dto.classificationId = parseInt(this.assetForm.classificationId);
    if (this.assetForm.typeId) dto.typeId = parseInt(this.assetForm.typeId);
    if (this.assetForm.hazardDivisionId) dto.hazardDivisionId = parseInt(this.assetForm.hazardDivisionId);
    if (this.assetForm.unit) dto.unit = parseInt(this.assetForm.unit);

    const formData = new FormData();
    Object.keys(dto).forEach(key => {
      const val = dto[key as keyof CreateUpdateExplosiveDto];
      if (val !== undefined && val !== null) {
        const capKey = key.charAt(0).toUpperCase() + key.slice(1);
        formData.append(capKey, val.toString());
      }
    });

    if (this.assetForm.image) {
      formData.append('files', this.assetForm.image);
    }

    const request = this.apiService.postWithAuth<APIOperationResponse<ExplosiveDto>>('/Explosive', formData);
    request.pipe(takeUntil(this.destroy$)).subscribe(this.getSubmitObserver());
  }

  private getSubmitObserver() {
    return {
      next: (response: APIOperationResponse<any>) => {
        if (response.succeeded) {
          const successMessage = this.translationService.getTranslation('addAsset.successMessage');
          this.toastService.success(successMessage || 'Asset created successfully', this.translationService.getTranslation('toast.success'));
          setTimeout(() => {
            this.router.navigate(['/asset-list']);
          }, 800);
        } else {
          this.errorMessage = response.message || 'Failed to create asset';
          this.toastService.error(this.errorMessage || '', this.translationService.getTranslation('toast.error'));
        }
        this.submitting = false;
      },
      error: (error: unknown) => {
        let errorMsg = ErrorHandler.extractErrorMessage(error, 'Failed to create asset. Please try again.');
        this.errorMessage = errorMsg;
        this.toastService.error(errorMsg, this.translationService.getTranslation('toast.error'));
        this.submitting = false;
      }
    };
  }

  validateForm(): boolean {
    this.errorMessage = null;

    // Common validations
    if (!this.assetForm.name || !this.assetForm.name.trim()) {
      this.errorMessage = 'Name is required';
      return false;
    }
    if (!this.assetForm.itemNo || !this.assetForm.itemNo.trim()) {
      this.errorMessage = 'Item number is required';
      return false;
    }

    return true;
  }

  onCancel(): void {
    this.resetForm();
  }

  private resetForm(): void {
    const currentTab = this.activeTab;
    this.assetForm = this.getInitialForm();
    this.previewUrl = null;
    this.errorMessage = null;
    this.formSubmitted = false;
    this.activeTab = currentTab;
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
        this.translateService.get(['toast.onlyImageFilesAllowed', 'toast.error']).subscribe(translations => {
          this.toastService.error(translations['toast.onlyImageFilesAllowed'], translations['toast.error']);
        });
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
        this.translateService.get(['toast.onlyImageFilesAllowed', 'toast.error']).subscribe(translations => {
          this.toastService.error(translations['toast.onlyImageFilesAllowed'], translations['toast.error']);
        });
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

  getInputClass(isInvalid: boolean | null | undefined, isDirty: boolean | null | undefined, isTouched: boolean | null | undefined): string {
    const baseClasses = 'w-full px-4 py-2.5 bg-white rounded-lg border text-sm text-[#23272E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2';
    const showError = !!isInvalid && (!!isDirty || !!isTouched || this.formSubmitted);

    if (showError) {
      return `${baseClasses} border-red-500 focus:ring-red-500`;
    }

    return `${baseClasses} focus:ring-[var(--color-brand)]`;
  }

  shouldShowError(isInvalid: boolean | null | undefined, isDirty: boolean | null | undefined, isTouched: boolean | null | undefined): boolean {
    return !!isInvalid && (!!isDirty || !!isTouched || this.formSubmitted);
  }
}
