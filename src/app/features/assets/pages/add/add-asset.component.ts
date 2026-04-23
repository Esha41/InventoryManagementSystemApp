import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { LucideAngularModule, Save, X } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { OnboardingTourService } from '@features/onboarding/services/onboarding-tour.service';
import { LookupService, NatureOptionDto } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { AmmunitionCreateDto, AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto, CreateUpdateWeaponDto } from '@models/weapon.model';
import { ExplosiveDto, CreateUpdateExplosiveDto } from '@models/explosive.model';
import { ApiService } from '@services/api.service';
import { DropdownOption, DropdownComponent } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';
import { ItemType } from '@models/inventory.model';

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
  criticalQuantity: string;
  unNumber: string;
  distribution: string;
  referenceNo: string;
  classificationId: string;
  typeId: string;
  notes: string;
  image?: File;

  // Ammunition specific
  /** AmmunitionType enum as string: '1' | '2' | '3' */
  ammunitionType: string;
  bulletDiameter: string;
  bulletDiameterUnitId: string;
  isLinked: string;
  primer: string;
  caseTypeId: string;
  propellantId: string;
  compatibilityId: string;
  hazardDivisionId: string;
  natureOptionId: string;
  primaryPurposIds: number[];
  projectileColorId: string;
  projectailMaterialId: string;

  // Weapon specific
  /** WeaponCaliberCategory as string: '1' | '2' | '3' */
  weaponCaliberCategory: string;
  caliber: string;
  caliberUnitId: string;
  yearOfManufacture: string;
  countryOfManufactureId: string;
  model: string;

  // Explosive specific
  explosiveType: string;
  netExplosiveQuantity: string;
  netExplosiveQuantityUnitId: string;
  unitId: string; // Unit lookup ID
}

type AssetType = 'ammunition' | 'weapon' | 'explosive';

@Component({
  selector: 'app-add-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CardComponent, LucideAngularModule, DropdownComponent, HasPermissionDirective, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './add-asset.component.html',
  styleUrls: ['./add-asset.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddAssetComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly Save = Save;
  readonly X = X;

  @ViewChild('fileInput') private fileInputRef?: ElementRef<HTMLInputElement>;

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

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) => this.getLocalizedName(this.unwrapOption(option));
  readonly linkedOptions = [
    { label: 'common.no', value: 'false' },
    { label: 'common.yes', value: 'true' }
  ];

  /** AmmunitionType / WeaponCaliberCategory (Small=1, Medium=2, Large=3) */
  readonly ammunitionTypeClassOptions: { label: string; value: string }[] = [
    { label: 'newIssueRequest.ammunitionTypeSmall', value: '1' },
    { label: 'newIssueRequest.ammunitionTypeMedium', value: '2' },
    { label: 'newIssueRequest.ammunitionTypeLarge', value: '3' }
  ];

  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  formSubmitted = false;

  /** Field-specific validation errors (e.g. bulletDiameter, price, totalWeight) */
  fieldErrors: Record<string, string> = {};

  constructor(
    private translationService: TranslationService,
    private lookupService: LookupService,
    private apiService: ApiService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef,
    private onboardingTourService: OnboardingTourService
  ) { }

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
      criticalQuantity: '',
      unNumber: '',
      distribution: '',
      referenceNo: '',
      classificationId: '',
      typeId: '',
      notes: '',
      image: undefined,

      // Ammunition
      ammunitionType: '',
      bulletDiameter: '',
      bulletDiameterUnitId: '',
      isLinked: 'false',
      primer: '',
      caseTypeId: '',
      propellantId: '',
      compatibilityId: '',
      hazardDivisionId: '',
      natureOptionId: '',
      primaryPurposIds: [],
      projectileColorId: '',
      projectailMaterialId: '',

      // Weapon (default Small = 1)
      weaponCaliberCategory: '1',
      caliber: '',
      caliberUnitId: '',
      yearOfManufacture: '',
      countryOfManufactureId: '',
      model: '',

      // Explosive
      explosiveType: '',
      netExplosiveQuantity: '',
      netExplosiveQuantityUnitId: '',
      unitId: ''
    };
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.onboardingTourService.checkAndStartPageTour('add-asset'), 300);
  }

  ngOnInit(): void {
    // Check for tab query parameter
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const tab = params['tab'];
      if (tab && (tab === 'ammunition' || tab === 'weapon' || tab === 'explosive')) {
        const tabTyped = tab as AssetType;
        const tabChanged = this.activeTab !== tabTyped;
        this.activeTab = tabTyped;
        if (tabChanged) {
          this.clearFormState();
          this.loadUnitsForTab(tabTyped);
        }
        this.cdr.markForCheck();
      }
    });

    this.loadLookupData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setActiveTab(tab: AssetType): void {
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    this.clearFormState();
    this.loadUnitsForTab(tab);
    this.cdr.markForCheck();
  }

  private clearFormState(): void {
    this.assetForm = this.getInitialForm();
    this.previewUrl = null;
    this.errorMessage = null;
    this.fieldErrors = {};
    this.formSubmitted = false;
    const el = this.fileInputRef?.nativeElement;
    if (el) {
      el.value = '';
    }
  }

  loadUnitsForTab(tab: AssetType): void {
    let itemType: number | undefined;
    if (tab === 'ammunition') {
      itemType = ItemType.Ammunition;
    } else if (tab === 'weapon') {
      itemType = ItemType.Weapon;
    } else if (tab === 'explosive') {
      itemType = ItemType.Explosive;
    }

    this.lookupService.getUnitsByItemType(itemType)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (units) => {
          this.units = units;
          this.cdr.markForCheck();
        },
        error: (error) => {
          const errorMsg = this.translationService.getTranslation('addAsset.errorLoadingUnits') || 'Failed to load units';
          this.toastService.error(errorMsg, this.translationService.getTranslation('toast.error'));
          console.error('Error loading units:', error);
        }
      });
  }

  loadLookupData(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
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
          this.cdr.markForCheck();
          // Load units for the active tab
          this.loadUnitsForTab(this.activeTab);
        },
        error: () => {
          this.errorMessage = 'Failed to load lookup data. Please try again.';
          this.loading = false;
          this.cdr.markForCheck();
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
    if (this.assetForm.caliber?.trim()) dto.caliber = this.assetForm.caliber.trim();
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
    if (this.assetForm.primaryPurposIds?.length) {
      dto.primaryPurposIds = [...this.assetForm.primaryPurposIds];
    }
    if (this.assetForm.projectileColorId) dto.projectileColorId = parseInt(this.assetForm.projectileColorId);
    if (this.assetForm.projectailMaterialId) dto.projectailMaterialId = parseInt(this.assetForm.projectailMaterialId);
    if (this.assetForm.distribution?.trim()) dto.distribution = this.assetForm.distribution.trim();
    if (this.assetForm.unNumber?.trim()) dto.unNumber = this.assetForm.unNumber.trim();
    if (this.assetForm.referenceNo?.trim()) dto.referenceNo = this.assetForm.referenceNo.trim();
    if (this.assetForm.classificationId) dto.classificationId = parseInt(this.assetForm.classificationId);
    if (this.assetForm.typeId) dto.typeId = parseInt(this.assetForm.typeId);
    if (this.assetForm.ammunitionType) dto.ammunitionType = parseInt(this.assetForm.ammunitionType, 10);
    if (this.assetForm.notes?.trim()) dto.notes = this.assetForm.notes.trim();
    if (this.assetForm.price) dto.price = parseFloat(this.assetForm.price);
    if (this.assetForm.minimumQuantity) dto.minimumQuantity = parseInt(this.assetForm.minimumQuantity);
    if (this.assetForm.criticalQuantity) dto.criticalQuantity = parseInt(this.assetForm.criticalQuantity, 10);
    if (this.assetForm.isLinked) dto.isLinked = this.assetForm.isLinked === 'true';

    const formData = new FormData();
    (Object.keys(dto) as (keyof AmmunitionCreateDto)[]).forEach(key => {
      const val = dto[key];
      if (val === undefined || val === null) return;
      const capKey = key.charAt(0).toUpperCase() + key.slice(1);
      if (key === 'primaryPurposIds' && Array.isArray(val)) {
        val.forEach(id => formData.append(capKey, id.toString()));
        return;
      }
      formData.append(capKey, val.toString());
    });

    if (this.assetForm.image) {
      formData.append('files', this.assetForm.image);
    }

    const request = this.apiService.post<AmmunitionReadDto>('/Ammunition', formData);
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
    if (this.assetForm.weaponCaliberCategory) dto.caliberCategory = parseInt(this.assetForm.weaponCaliberCategory, 10);
    if (this.assetForm.caliber?.trim()) dto.caliber = this.assetForm.caliber.trim();
    if (this.assetForm.caliberUnitId) dto.caliberUnitId = parseInt(this.assetForm.caliberUnitId);
    if (this.assetForm.yearOfManufacture) dto.yearOfManufacture = parseInt(this.assetForm.yearOfManufacture);
    if (this.assetForm.countryOfManufactureId) dto.countryOfManufactureId = parseInt(this.assetForm.countryOfManufactureId);
    if (this.assetForm.model?.trim()) dto.model = this.assetForm.model.trim();
    if (this.assetForm.price) dto.price = parseFloat(this.assetForm.price);
    if (this.assetForm.minimumQuantity) dto.minimumQuantity = parseInt(this.assetForm.minimumQuantity);
    if (this.assetForm.criticalQuantity) dto.criticalQuantity = parseInt(this.assetForm.criticalQuantity, 10);
    if (this.assetForm.primaryPurposIds?.length) {
      dto.primaryPurposIds = [...this.assetForm.primaryPurposIds];
    }

    const formData = new FormData();
    (Object.keys(dto) as (keyof CreateUpdateWeaponDto)[]).forEach(key => {
      const val = dto[key];
      if (val === undefined || val === null) return;
      const capKey = key.charAt(0).toUpperCase() + key.slice(1);
      if (key === 'primaryPurposIds' && Array.isArray(val)) {
        val.forEach(id => formData.append(capKey, id.toString()));
        return;
      }
      formData.append(capKey, val.toString());
    });

    if (this.assetForm.image) {
      formData.append('files', this.assetForm.image);
    }

    const request = this.apiService.post<WeaponDto>('/Weapon', formData);
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
    if (this.assetForm.criticalQuantity) dto.criticalQuantity = parseInt(this.assetForm.criticalQuantity, 10);
    if (this.assetForm.distribution?.trim()) dto.distribution = this.assetForm.distribution.trim();
    if (this.assetForm.referenceNo?.trim()) dto.referenceNo = this.assetForm.referenceNo.trim();
    if (this.assetForm.unNumber?.trim()) dto.unNumber = this.assetForm.unNumber.trim();
    if (this.assetForm.notes?.trim()) dto.notes = this.assetForm.notes.trim();
    if (this.assetForm.classificationId) dto.classificationId = parseInt(this.assetForm.classificationId);
    if (this.assetForm.typeId) dto.typeId = parseInt(this.assetForm.typeId);
    if (this.assetForm.hazardDivisionId) dto.hazardDivisionId = parseInt(this.assetForm.hazardDivisionId);
    if (this.assetForm.unitId) dto.unitId = parseInt(this.assetForm.unitId);
    if (this.assetForm.armNumber?.trim()) dto.armNumber = this.assetForm.armNumber.trim();
    if (this.assetForm.compatibilityId) dto.compatibilityId = parseInt(this.assetForm.compatibilityId);
    if (this.assetForm.primaryPurposIds?.length) {
      dto.primaryPurposIds = [...this.assetForm.primaryPurposIds];
    }

    const formData = new FormData();
    (Object.keys(dto) as (keyof CreateUpdateExplosiveDto)[]).forEach(key => {
      const val = dto[key];
      if (val === undefined || val === null) return;
      const capKey = key.charAt(0).toUpperCase() + key.slice(1);
      if (key === 'primaryPurposIds' && Array.isArray(val)) {
        val.forEach(id => formData.append(capKey, id.toString()));
        return;
      }
      formData.append(capKey, val.toString());
    });

    if (this.assetForm.image) {
      formData.append('files', this.assetForm.image);
    }

    const request = this.apiService.post<ExplosiveDto>('/Explosive', formData);
    request.pipe(takeUntil(this.destroy$)).subscribe(this.getSubmitObserver());
  }

  private getSubmitObserver() {
    return {
      next: (asset: AmmunitionReadDto | WeaponDto | ExplosiveDto) => {
        if (asset) {
          const successMessage = this.translationService.getTranslation('addAsset.successMessage');
          this.toastService.success(successMessage || 'Asset created successfully', this.translationService.getTranslation('toast.success'));
          setTimeout(() => {
            const queryParams: Record<string, string | number> = { tab: this.activeTab };
            const page = this.route.snapshot.queryParamMap.get('page');
            if (page) {
              const parsed = parseInt(page, 10);
              if (!isNaN(parsed) && parsed >= 1) {
                queryParams['page'] = parsed;
              }
            }
            this.router.navigate(['/asset-list'], { queryParams });
          }, 800);
        } else {
          const rawMsg = 'Failed to create asset';
          this.errorMessage = ErrorHandler.translateErrorMessage(rawMsg, this.translateService);
          this.toastService.error(this.errorMessage || '', this.translationService.getTranslation('toast.error'));
        }
        this.submitting = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        let errorMsg = ErrorHandler.extractAndTranslateErrorMessage(error, 'Failed to create asset. Please try again.', this.translateService);
        this.errorMessage = errorMsg;
        this.toastService.error(errorMsg, this.translationService.getTranslation('toast.error'));
        this.submitting = false;
        this.cdr.markForCheck();
      }
    };
  }

  validateForm(): boolean {
    this.errorMessage = null;
    this.fieldErrors = {};

    // Common validations
    if (!this.assetForm.name || !this.assetForm.name.trim()) {
      this.errorMessage = 'Name is required';
      return false;
    }
    if (!this.assetForm.itemNo || !this.assetForm.itemNo.trim()) {
      this.errorMessage = 'Item number is required';
      return false;
    }

    // Ammunition-specific: numeric fields must be > 0 when provided
    if (this.activeTab === 'ammunition') {
      if (!this.assetForm.ammunitionType) {
        this.fieldErrors['ammunitionType'] = this.translateService.instant('addAsset.errors.ammunitionTypeRequired');
        return false;
      }
      const bulletVal = parseFloat(this.assetForm.bulletDiameter);
      if (this.assetForm.bulletDiameter !== '' && this.assetForm.bulletDiameter != null && !isNaN(bulletVal) && bulletVal <= 0) {
        this.fieldErrors['bulletDiameter'] = this.translateService.instant('addAsset.errors.bulletDiameterMustBePositive');
        return false;
      }
      const priceVal = parseFloat(this.assetForm.price);
      if (this.assetForm.price !== '' && this.assetForm.price != null && !isNaN(priceVal) && priceVal <= 0) {
        this.fieldErrors['price'] = this.translateService.instant('addAsset.errors.priceMustBePositive');
        return false;
      }
      const weightVal = parseFloat(this.assetForm.totalWeight);
      if (this.assetForm.totalWeight !== '' && this.assetForm.totalWeight != null && !isNaN(weightVal) && weightVal <= 0) {
        this.fieldErrors['totalWeight'] = this.translateService.instant('addAsset.errors.totalWeightMustBePositive');
        return false;
      }
    }

    if (this.activeTab === 'weapon') {
      if (!this.assetForm.weaponCaliberCategory) {
        this.fieldErrors['weaponCaliberCategory'] = this.translateService.instant('addAsset.errors.ammunitionTypeRequired');
        return false;
      }
    }

    // Weapon and Explosive: price must be > 0 when provided
    if ((this.activeTab === 'weapon' || this.activeTab === 'explosive') && this.assetForm.price) {
      const priceVal = parseFloat(this.assetForm.price);
      if (this.assetForm.price !== '' && this.assetForm.price != null && !isNaN(priceVal) && priceVal <= 0) {
        this.fieldErrors['price'] = this.translateService.instant('addAsset.errors.priceMustBePositive');
        return false;
      }
    }

    return true;
  }

  onCancel(): void {
    this.resetForm();
  }

  private resetForm(): void {
    const currentTab = this.activeTab;
    this.clearFormState();
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

  /** Prevents + and - keys in numeric fields (bullet diameter, total weight). */
  blockSignKeys(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === '+') {
      event.preventDefault();
    }
  }

  /** Sanitizes pasted text: removes + and - from numeric fields. */
  onPasteNumber(event: ClipboardEvent, field: 'bulletDiameter' | 'totalWeight'): void {
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/[+-]/g, '');
    if (pasted !== (event.clipboardData?.getData('text') ?? '')) {
      event.preventDefault();
      this.assetForm[field] = pasted;
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

  /**
   * Helper method to filter item types by category
   */
  private getFilteredItemTypes(itemType: ItemType): LookupItem[] {
    if (!this.itemTypes?.length) return [];
    const typeName = ItemType[itemType];
    const filtered = this.itemTypes.filter(item => {
      const value = item.itemType as string | number | undefined;
      return value != null && (typeof value === 'string' ? value : ItemType[Number(value)]) === typeName;
    });
    return filtered.length > 0 ? filtered : this.itemTypes;
  }

  /**
   * Get filtered item types for ammunition (itemType === ItemType.Ammunition)
   */
  get ammunitionItemTypes(): LookupItem[] {
    return this.getFilteredItemTypes(ItemType.Ammunition);
  }

  /**
   * Get filtered item types for weapons (itemType === ItemType.Weapon)
   */
  get weaponItemTypes(): LookupItem[] {
    return this.getFilteredItemTypes(ItemType.Weapon);
  }

  /**
   * Get filtered item types for explosives (itemType === ItemType.Explosive)
   */
  get explosiveItemTypes(): LookupItem[] {
    return this.getFilteredItemTypes(ItemType.Explosive);
  }
}
