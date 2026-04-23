import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, Save, X, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-angular';
import { InventoryService } from '@inventory/services/inventory.service';
import { LookupService, SupplierDto, ManufacturerDto, CountryDto, LookupItem } from '@services/lookup.service';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { CreateInventoryDto, CreateInventoryDetailDto, ItemType } from '@models/inventory.model';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { AmmunitionReadDto, LookupDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { LoadingStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationService } from '@services/translation.service';
import { trackByIndex } from '@utils/trackby.utils';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';

@Component({
  selector: 'app-add-inventory',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    HasPermissionDirective,
    LoadingStateComponent
  ],
  templateUrl: './add-inventory.component.html',
  styleUrls: ['./add-inventory.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddInventoryComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly trackByIndex = trackByIndex;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  warehouseId!: number;
  warehouseName: string = '';
  currentDepot: LookupItem | null = null; // Store depot object for dynamic localization

  // Active tab for item type
  activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';

  // Form
  inventoryForm!: FormGroup;

  // Lookup data - separate arrays for each type
  availableAmmunition: AmmunitionReadDto[] = [];
  availableWeapons: WeaponDto[] = [];
  availableExplosives: ExplosiveDto[] = [];
  suppliers: SupplierDto[] = [];
  manufacturers: ManufacturerDto[] = [];
  countries: CountryDto[] = [];

  // Computed property for current items based on active tab
  get availableItems(): (AmmunitionReadDto | WeaponDto | ExplosiveDto)[] {
    switch (this.activeTab) {
      case 'ammunition':
        return this.availableAmmunition;
      case 'weapon':
        return this.availableWeapons;
      case 'explosive':
        return this.availableExplosives;
      default:
        return this.availableAmmunition;
    }
  }
  readonly supplierOptionLabel = (option: DropdownOption<SupplierDto> | SupplierDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly manufacturerOptionLabel = (option: DropdownOption<ManufacturerDto> | ManufacturerDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly countryOptionLabel = (option: DropdownOption<CountryDto> | CountryDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly primaryPurposeOptionLabel = (option: DropdownOption<LookupDto> | LookupDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly itemOptionLabel = (option: DropdownOption<AmmunitionReadDto | WeaponDto | ExplosiveDto> | AmmunitionReadDto | WeaponDto | ExplosiveDto | null) => {
    const item = this.unwrapOption(option);
    if (!item) {
      return '';
    }
    const name = getLocalizedName(item, getCurrentLang(this.translateService)) || '';
    const itemNo = (item as any).itemNo ? ` (${(item as any).itemNo})` : '';
    return `${name}${itemNo}`.trim();
  };

  readonly readyForIssueOptions: DropdownOption<boolean>[] = [
    { label: 'editInventoryDetail.readyForIssueYes', value: true },
    { label: 'editInventoryDetail.readyForIssueNo', value: false }
  ];

  loading = false;
  submitting = false;
  errorMessage: string | null = null;

  private destroy$ = new Subject<void>();

  private readonly appDatePipe = new AppDatePipe();
  deliveryReceiptFiles: File[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    // Get warehouse ID from route
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.warehouseId = parseInt(params['id'], 10);
      if (this.warehouseId) {
        this.loadData();
      }
      this.cdr.markForCheck();
    });

    // Get tab from query params (default to 'ammunition' if not provided)
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(queryParams => {
      const tabParam = queryParams['tab'];
      if (tabParam && (tabParam === 'ammunition' || tabParam === 'explosive')) {
        this.activeTab = tabParam;
        // Clear existing items when tab is set
        this.itemsFormArray.clear();
        this.addItem();
        this.cdr.markForCheck();
      }
    });

    // Subscribe to language changes to update warehouse name
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.currentDepot) {
          this.warehouseName = getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) || `Warehouse ${this.warehouseId}`;
          this.cdr.markForCheck();
        }
      });

    // Add initial item only if none added yet (e.g. by queryParams when tab=ammunition/explosive)
    if (this.itemsFormArray.length === 0) {
      this.addItem();
    }
  }

  private initializeForm(): void {
    this.inventoryForm = this.fb.group({
      invoiceNumber: [''],
      deliveryReceipt: [''],
      invoiceDate: [''],
      receivedDate: [''],
      contractNumber: [''],
      notes: [''],
      items: this.fb.array([])
    });
  }

  get itemsFormArray(): FormArray {
    return this.inventoryForm.get('items') as FormArray;
  }

  private coerceReadyForIssue(value: unknown): boolean {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return true;
  }

  createItemFormGroup(): FormGroup {
    return this.fb.group({
      itemId: [null, [Validators.required]],
      primaryPurposId: [null as number | null],
      lot: ['', [Validators.required, Validators.maxLength(64)]],
      originalQuantity: [0, [Validators.required, Validators.min(1)]],
      batchNo: [''],
      expiryDate: [''],
      readyForIssue: [true],
      supplierId: [null],
      manufacturerId: [null],
      countryId: [null]
    });
  }

  /** Options from catalog (`primaryPurposes` on the selected ammunition or explosive row). */
  getPrimaryPurposeOptions(index: number): LookupDto[] {
    if (this.activeTab !== 'ammunition' && this.activeTab !== 'explosive') {
      return [];
    }
    const itemId = this.itemsFormArray.at(index)?.get('itemId')?.value as number | null | undefined;
    if (!itemId) {
      return [];
    }
    if (this.activeTab === 'ammunition') {
      return this.primaryPurposesFromCatalogRow(this.availableAmmunition.find(a => a.id === itemId));
    }
    return this.primaryPurposesFromCatalogRow(this.availableExplosives.find(e => e.id === itemId));
  }

  private primaryPurposesFromCatalogRow(
    selected: { primaryPurposes?: LookupDto[]; primaryPurpos?: LookupDto } | undefined
  ): LookupDto[] {
    if (!selected) {
      return [];
    }
    const list = selected.primaryPurposes ?? [];
    if (list.length > 0) {
      return list;
    }
    if (selected.primaryPurpos?.id != null) {
      return [selected.primaryPurpos];
    }
    return [];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    this.loading = true;
    this.cdr.markForCheck();

    forkJoin({
      depot: this.lookupService.getDepots(),
      ammunition: this.ammunitionService.getAll(),
      weapons: this.weaponService.getAll(),
      explosives: this.explosiveService.getAll(),
      suppliers: this.lookupService.getSuppliers(),
      manufacturers: this.lookupService.getManufacturers(),
      countries: this.lookupService.getCountries()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ depot, ammunition, weapons, explosives, suppliers, manufacturers, countries }) => {
          this.currentDepot = depot.find(d => d.id === this.warehouseId) || null;
          this.warehouseName = getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) || `Warehouse ${this.warehouseId}`;

          this.availableAmmunition = ammunition;
          this.availableWeapons = weapons;
          this.availableExplosives = explosives;
          this.suppliers = suppliers;
          this.manufacturers = manufacturers;
          this.countries = countries;

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMessage = this.translateService.instant('addInventory.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  switchTab(tab: 'ammunition' | 'weapon' | 'explosive'): void {
    this.activeTab = tab;
    // Clear existing items when switching tabs
    this.itemsFormArray.clear();
    this.addItem();
    this.cdr.markForCheck();
  }

  addItem(): void {
    this.itemsFormArray.push(this.createItemFormGroup());
    this.cdr.markForCheck();
  }

  removeItem(index: number): void {
    if (this.itemsFormArray.length > 1) {
      this.itemsFormArray.removeAt(index);
      this.cdr.markForCheck();
    }
  }

  private getLocalizedName(entity: { nameEn?: string; nameAr?: string } | null | undefined): string {
    if (!entity) {
      return '';
    }
    return getLocalizedName(entity, getCurrentLang(this.translateService));
  }

  private unwrapOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (!option) {
      return null;
    }
    if (typeof option === 'object' && option !== null && 'value' in option) {
      return option.value as T;
    }
    return option as T;
  }

  onItemChange(index: number): void {
    const itemFormGroup = this.itemsFormArray.at(index);
    const itemId = itemFormGroup.get('itemId')?.value;
    const selectedItem = this.availableItems.find((i: any) => i.id === itemId);
    // Clear validation error when item is selected
    if (selectedItem) {
      itemFormGroup.get('itemId')?.setErrors(null);
    }

    let nextPurposeId: number | null = null;
    if ((this.activeTab === 'ammunition' || this.activeTab === 'explosive') && selectedItem) {
      const row = selectedItem as AmmunitionReadDto | ExplosiveDto;
      const purposes = row.primaryPurposes?.length
        ? row.primaryPurposes
        : row.primaryPurpos?.id != null
          ? [row.primaryPurpos]
          : [];
      if (purposes.length === 1 && purposes[0]?.id != null) {
        nextPurposeId = purposes[0].id;
      }
    }
    itemFormGroup.patchValue({ primaryPurposId: nextPurposeId }, { emitEvent: false });
    this.cdr.markForCheck();
  }

  getItemFormGroup(index: number): FormGroup {
    return this.itemsFormArray.at(index) as FormGroup;
  }

  isFieldInvalid(fieldPath: string, index?: number): boolean {
    let control: AbstractControl | null;

    if (index !== undefined) {
      const itemGroup = this.itemsFormArray.at(index) as FormGroup;
      control = itemGroup.get(fieldPath);
    } else {
      control = this.inventoryForm.get(fieldPath);
    }

    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getFieldError(fieldPath: string, index?: number): string | null {
    let control: AbstractControl | null;

    if (index !== undefined) {
      const itemGroup = this.itemsFormArray.at(index) as FormGroup;
      control = itemGroup.get(fieldPath);
    } else {
      control = this.inventoryForm.get(fieldPath);
    }

    if (!control || !control.errors || (!control.dirty && !control.touched)) {
      return null;
    }

    if (control.errors['required']) {
      return this.translateService.instant('addInventory.required');
    }
    if (control.errors['min']) {
      return `Value must be at least ${control.errors['min'].min}`;
    }
    if (control.errors['maxlength']) {
      return `Maximum length is ${control.errors['maxlength'].requiredLength}`;
    }
    if (control.errors['futureDate']) {
      return this.translateService.instant('addInventory.cannotBeFuture');
    }

    return null;
  }

  onFieldChange(fieldPath: string, index?: number): void {
    let control: AbstractControl | null;

    if (index !== undefined) {
      const itemGroup = this.itemsFormArray.at(index) as FormGroup;
      control = itemGroup.get(fieldPath);
    } else {
      control = this.inventoryForm.get(fieldPath);
    }

    if (control) {
      control.markAsTouched();
      // Clear errors if field becomes valid
      if (control.valid && control.errors) {
        control.setErrors(null);
      }
    }
  }

  onInvoiceNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Allow full alphanumeric + symbols; just trim whitespace
    const value = input.value;
    this.inventoryForm.get('invoiceNumber')?.setValue(value, { emitEvent: false });
    this.onFieldChange('invoiceNumber');
  }

  validateDates(): boolean {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today
    let hasErrors = false;

    const invoiceDateControl = this.inventoryForm.get('invoiceDate');
    const invoiceDateValue = invoiceDateControl?.value;
    if (invoiceDateValue) {
      const invoiceDate = this.parseYmdToLocalDate(invoiceDateValue);
      if (invoiceDate && invoiceDate > now) {
        invoiceDateControl?.setErrors({ futureDate: true });
        hasErrors = true;
      } else {
        // Clear futureDate error if date is valid
        if (invoiceDateControl?.errors?.['futureDate']) {
          const errors = { ...invoiceDateControl.errors };
          delete errors['futureDate'];
          invoiceDateControl.setErrors(Object.keys(errors).length > 0 ? errors : null);
        }
      }
    }

    const receivedDateControl = this.inventoryForm.get('receivedDate');
    const receivedDateValue = receivedDateControl?.value;
    if (receivedDateValue) {
      const receivedDate = this.parseYmdToLocalDate(receivedDateValue);
      if (receivedDate && receivedDate > now) {
        receivedDateControl?.setErrors({ futureDate: true });
        hasErrors = true;
      } else {
        // Clear futureDate error if date is valid
        if (receivedDateControl?.errors?.['futureDate']) {
          const errors = { ...receivedDateControl.errors };
          delete errors['futureDate'];
          receivedDateControl.setErrors(Object.keys(errors).length > 0 ? errors : null);
        }
      }
    }

    return !hasErrors;
  }

  openDatePicker(input: HTMLInputElement): void {
    if (input.showPicker) {
      input.showPicker();
      return;
    }
    input.focus();
  }

  getDateDisplay(fieldPath: string, index?: number): string {
    const control = index !== undefined
      ? (this.itemsFormArray.at(index) as FormGroup).get(fieldPath)
      : this.inventoryForm.get(fieldPath);

    const value = control?.value as string | Date | null | undefined;
    const formatted = this.appDatePipe.transform(value);
    return formatted === 'N/A' ? '' : formatted;
  }

  private parseYmdToLocalDate(value: string): Date | undefined {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return undefined;
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (month < 1 || month > 12) return undefined;
    if (day < 1 || day > 31) return undefined;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return undefined;
    return d;
  }

  onSubmit(): void {
    // Mark all fields as touched to show validation errors
    this.inventoryForm.markAllAsTouched();
    this.itemsFormArray.controls.forEach(itemGroup => {
      (itemGroup as FormGroup).markAllAsTouched();
    });

    // Validate dates (cannot be in the future)
    if (!this.validateDates()) {
      return;
    }

    // Show a clear message if any quantity is zero or below minimum
    const hasInvalidQuantity = this.itemsFormArray.controls.some(itemGroup => {
      const qtyControl = (itemGroup as FormGroup).get('originalQuantity');
      return qtyControl && (qtyControl.value === 0 || qtyControl.hasError('min'));
    });

    if (hasInvalidQuantity) {
      const title = this.translateService.instant('toast.error');
      const message = this.translateService.instant('addInventory.quantityMustBeGreaterThanZero');
      this.toastService.error(message, title);
    }

    // Check if form is valid
    if (this.inventoryForm.invalid) {
      return;
    }

    // Check if at least one item exists
    if (this.itemsFormArray.length === 0) {
      return;
    }

    const formValue = this.inventoryForm.value;

    // Prepare DTO - convert empty strings to undefined
    const createDto: CreateInventoryDto = {
      depoId: this.warehouseId,
      invoiceNumber: formValue.invoiceNumber?.trim() || undefined,
      deliveryReceipt: formValue.deliveryReceipt?.trim() || undefined,
      invoiceDate: formValue.invoiceDate && formValue.invoiceDate.trim() ? formValue.invoiceDate : undefined,
      recievedDate: formValue.receivedDate && formValue.receivedDate.trim() ? formValue.receivedDate : undefined,
      contractNumber: formValue.contractNumber?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
      inventoryDetails: formValue.items.map((item: {
        itemId: number;
        primaryPurposId?: number | null;
        lot: string;
        supplierId?: number;
        manufacturerId?: number;
        countryId?: number;
        originalQuantity: number;
        batchNo?: string;
        expiryDate?: string;
        readyForIssue?: boolean;
      }) => ({
        itemId: item.itemId,
        lot: String(item.lot ?? '').trim(),
        supplierId: item.supplierId || undefined,
        manufacturerId: item.manufacturerId || undefined,
        countryId: item.countryId || undefined,
        originalQuantity: item.originalQuantity,
        batchNo: item.batchNo?.trim() || undefined,
        expiryDate: item.expiryDate || undefined,
        readyForIssue: this.coerceReadyForIssue(item.readyForIssue),
        primaryPurposId:
          (this.activeTab === 'ammunition' || this.activeTab === 'explosive') &&
          item.primaryPurposId != null &&
          item.primaryPurposId > 0
            ? item.primaryPurposId
            : undefined
      }))
    };

    this.submitting = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    this.inventoryService.create(createDto, this.deliveryReceiptFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.cdr.markForCheck();

          this.translateService.get(['toast.success', 'addInventory.successMessage']).subscribe(translations => {
            const message = translations['addInventory.successMessage'] || 'Inventory created successfully!';
            const title = translations['toast.success'];
            this.toastService.success(message, title);
          });

          // Redirect after a short delay, preserving the tab
          setTimeout(() => {
            this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
              queryParams: { tab: this.activeTab },
              queryParamsHandling: 'merge'
            });
          }, 800);
        },
        error: (error: unknown) => {
          const fallbackMessage = this.translateService.instant('addInventory.createError');
          const errorMsg = ErrorHandler.extractErrorMessage(error, fallbackMessage);
          this.errorMessage = errorMsg;
          this.submitting = false;
          this.cdr.markForCheck();

          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMsg, translations['toast.error']);
          });
        }
      });
  }

  onCancel(): void {
    // Clear all validation errors
    this.inventoryForm.reset();
    this.itemsFormArray.clear();
    this.addItem();
    this.errorMessage = null;
    this.cdr.markForCheck();
    // Navigate back preserving the tab
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
      queryParams: { tab: this.activeTab },
      queryParamsHandling: 'merge'
    });
  }

  onDeliveryAttachmentChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newlySelected = input.files ? Array.from(input.files) : [];
    if (newlySelected.length) {
      const combined = [...this.deliveryReceiptFiles, ...newlySelected];
      const seen = new Set<string>();
      this.deliveryReceiptFiles = combined.filter(f => {
        const key = `${f.name}::${f.size}::${(f as any).lastModified ?? 0}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    // Do not clear input here; allow multiple browse actions to append
  }

  removeAttachment(index: number): void {
    if (index >= 0 && index < this.deliveryReceiptFiles.length) {
      this.deliveryReceiptFiles.splice(index, 1);
    }
  }

  getFileSize(file: File): string {
    const bytes = file.size;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = (bytes / Math.pow(1024, i)).toFixed(2);
    return `${value} ${sizes[i]}`;
  }

  /**
   * Get max date for date inputs (today)
   */
  getMaxDate(): string {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.toISOString().split('T')[0];
  }
}

