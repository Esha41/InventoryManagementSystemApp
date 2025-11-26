import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, Save, X, Plus, Trash2, ArrowLeft } from 'lucide-angular';
import { InventoryService } from '@services/inventory.service';
import { LookupService, SupplierDto, ManufacturerDto, CountryDto } from '@services/lookup.service';
import { AmmunitionService } from '@services/ammunition.service';
import { CreateInventoryDto, CreateInventoryDetailDto } from '@models/inventory.model';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';

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
    HasPermissionDirective
  ],
  templateUrl: './add-inventory.component.html',
  styleUrls: ['./add-inventory.component.css']
})
export class AddInventoryComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ArrowLeft = ArrowLeft;

  warehouseId!: number;
  warehouseName: string = '';

  // Form
  inventoryForm!: FormGroup;

  // Lookup data
  availableItems: AmmunitionReadDto[] = [];
  suppliers: SupplierDto[] = [];
  manufacturers: ManufacturerDto[] = [];
  countries: CountryDto[] = [];
  readonly supplierOptionLabel = (option: DropdownOption<SupplierDto> | SupplierDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly manufacturerOptionLabel = (option: DropdownOption<ManufacturerDto> | ManufacturerDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly countryOptionLabel = (option: DropdownOption<CountryDto> | CountryDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly itemOptionLabel = (option: DropdownOption<AmmunitionReadDto> | AmmunitionReadDto | null) => {
    const item = this.unwrapOption(option);
    if (!item) {
      return '';
    }
    const name = item.name || '';
    const itemNo = item.itemNo ? ` (${item.itemNo})` : '';
    return `${name}${itemNo}`.trim();
  };

  loading = false;
  submitting = false;
  errorMessage: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private toastService: ToastService,
    private translateService: TranslateService
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
    });

    // Add initial item
    this.addItem();
  }

  private initializeForm(): void {
    this.inventoryForm = this.fb.group({
      invoiceNumber: [''],
      invoiceDate: [''],
      receivedDate: [''],
      notes: [''],
      items: this.fb.array([])
    });
  }

  get itemsFormArray(): FormArray {
    return this.inventoryForm.get('items') as FormArray;
  }

  createItemFormGroup(): FormGroup {
    return this.fb.group({
      itemId: [null, [Validators.required]],
      lot: [1, [Validators.required, Validators.min(1)]],
      itemQuantity: [1000, [Validators.required, Validators.min(1)]],
      supplierId: [null],
      manufacturerId: [null],
      countryId: [null]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    this.loading = true;

    forkJoin({
      depot: this.lookupService.getDepots(),
      items: this.ammunitionService.getAll(),
      suppliers: this.lookupService.getSuppliers(),
      manufacturers: this.lookupService.getManufacturers(),
      countries: this.lookupService.getCountries()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ depot, items, suppliers, manufacturers, countries }) => {
        const currentDepot = depot.find(d => d.id === this.warehouseId);
        this.warehouseName = currentDepot?.nameEn || `Warehouse ${this.warehouseId}`;
        
        this.availableItems = items;
        this.suppliers = suppliers;
        this.manufacturers = manufacturers;
        this.countries = countries;
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading data:', error);
        this.errorMessage = 'Failed to load form data';
        this.loading = false;
      }
    });
  }

  addItem(): void {
    this.itemsFormArray.push(this.createItemFormGroup());
  }

  removeItem(index: number): void {
    if (this.itemsFormArray.length > 1) {
      this.itemsFormArray.removeAt(index);
    }
  }

  private getLocalizedName(entity: { nameEn?: string; nameAr?: string } | null | undefined): string {
    if (!entity) {
      return '';
    }
    return entity.nameEn || entity.nameAr || '';
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
    const selectedItem = this.availableItems.find(i => i.id === itemId);
    // Clear validation error when item is selected
    if (selectedItem) {
      itemFormGroup.get('itemId')?.setErrors(null);
    }
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
      return 'This field is required';
    }
    if (control.errors['min']) {
      return `Value must be at least ${control.errors['min'].min}`;
    }
    if (control.errors['maxlength']) {
      return `Maximum length is ${control.errors['maxlength'].requiredLength}`;
    }
    if (control.errors['futureDate']) {
      return 'Date cannot be in the future';
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

  validateDates(): boolean {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today
    let hasErrors = false;

    const invoiceDateControl = this.inventoryForm.get('invoiceDate');
    const invoiceDateValue = invoiceDateControl?.value;
    if (invoiceDateValue) {
      const invoiceDate = new Date(invoiceDateValue);
      if (invoiceDate > now) {
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
      const receivedDate = new Date(receivedDateValue);
      if (receivedDate > now) {
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
      invoiceDate: formValue.invoiceDate && formValue.invoiceDate.trim() ? formValue.invoiceDate : undefined,
      recievedDate: formValue.receivedDate && formValue.receivedDate.trim() ? formValue.receivedDate : undefined,
      notes: formValue.notes?.trim() || undefined,
      inventoryDetails: formValue.items.map((item: {
        itemId: number;
        lot: number;
        supplierId?: number;
        manufacturerId?: number;
        countryId?: number;
        itemQuantity: number;
      }) => ({
        itemId: item.itemId,
        lot: item.lot,
        supplierId: item.supplierId || undefined,
        manufacturerId: item.manufacturerId || undefined,
        countryId: item.countryId || undefined,
        itemQuantity: item.itemQuantity
      }))
    };

    this.submitting = true;
    this.errorMessage = null;

    this.inventoryService.create(createDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.submitting = false;
          
          this.translateService.get(['toast.success', 'addInventory.successMessage']).subscribe(translations => {
            const message = translations['addInventory.successMessage'] || 'Inventory created successfully!';
            const title = translations['toast.success'];
            this.toastService.success(message, title);
          });
          
          // Redirect after a short delay
          setTimeout(() => {
            this.router.navigate(['/warehouse', this.warehouseId, 'inventory']);
          }, 800);
        },
        error: (error: unknown) => {
          console.error('Error creating inventory:', error);
          const errorMsg = ErrorHandler.extractErrorMessage(error, 'Failed to create inventory');
          this.errorMessage = errorMsg;
          this.submitting = false;
          
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
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory']);
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

