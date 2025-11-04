import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto, UpdateInventoryDetailDto } from '@models/inventory.model';
import { LookupService, SupplierDto, ManufacturerDto, CountryDto } from '@services/lookup.service';

@Component({
  selector: 'app-edit-inventory-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    TranslateModule
  ],
  templateUrl: './edit-inventory-detail-modal.component.html',
  styleUrls: ['./edit-inventory-detail-modal.component.css']
})
export class EditInventoryDetailModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() inventoryDetail?: InventoryDetailDto;
  @Input() inventoryId!: number;
  
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<UpdateInventoryDetailDto>();

  detailForm!: FormGroup;
  suppliers: SupplierDto[] = [];
  manufacturers: ManufacturerDto[] = [];
  countries: CountryDto[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private lookupService: LookupService,
    private translateService: TranslateService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadLookupData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.initializeForm();
      this.errorMessage = '';
    }
    if (changes['inventoryDetail'] && this.inventoryDetail) {
      this.loadFormData();
    }
  }

  private initializeForm(): void {
    this.detailForm = this.fb.group({
      lot: [this.inventoryDetail?.lot || 1, [Validators.required, Validators.min(1)]],
      itemQuantity: [this.inventoryDetail?.itemQuantity || 1000, [Validators.required, Validators.min(1)]],
      currentQuantity: [this.inventoryDetail?.currentQuantity || 1000, [Validators.required, Validators.min(0)]],
      supplierId: [this.inventoryDetail?.supplierId || null],
      manufacturerId: [this.inventoryDetail?.manufacturerId || null],
      countryId: [this.inventoryDetail?.countryId || null]
    });
  }

  private loadFormData(): void {
    if (this.inventoryDetail) {
      this.detailForm.patchValue({
        lot: this.inventoryDetail.lot,
        itemQuantity: this.inventoryDetail.itemQuantity,
        currentQuantity: this.inventoryDetail.currentQuantity,
        supplierId: this.inventoryDetail.supplierId || null,
        manufacturerId: this.inventoryDetail.manufacturerId || null,
        countryId: this.inventoryDetail.countryId || null
      });
    }
  }

  private loadLookupData(): void {
    this.lookupService.getSuppliers().subscribe({
      next: (data) => this.suppliers = data,
      error: (err) => console.error('Failed to load suppliers', err)
    });

    this.lookupService.getManufacturers().subscribe({
      next: (data) => this.manufacturers = data,
      error: (err) => console.error('Failed to load manufacturers', err)
    });

    this.lookupService.getCountries().subscribe({
      next: (data) => this.countries = data,
      error: (err) => console.error('Failed to load countries', err)
    });
  }

  onSubmit(): void {
    if (this.detailForm.invalid) {
      this.translateService.get('editInventoryDetail.requiredFieldsError').subscribe(msg => {
        this.errorMessage = msg;
      });
      Object.keys(this.detailForm.controls).forEach(key => {
        this.detailForm.get(key)?.markAsTouched();
      });
      return;
    }

    // Validate current quantity doesn't exceed item quantity
    const itemQuantity = this.detailForm.value.itemQuantity;
    const currentQuantity = this.detailForm.value.currentQuantity;
    
    if (currentQuantity > itemQuantity) {
      this.translateService.get('editInventoryDetail.quantityExceeded').subscribe(msg => {
        this.errorMessage = msg;
      });
      return;
    }

    const updateDto: UpdateInventoryDetailDto = {
      id: this.inventoryDetail?.id,
      itemId: this.inventoryDetail!.itemId,
      lot: this.detailForm.value.lot,
      supplierId: this.detailForm.value.supplierId || undefined,
      manufacturerId: this.detailForm.value.manufacturerId || undefined,
      countryId: this.detailForm.value.countryId || undefined,
      itemQuantity: this.detailForm.value.itemQuantity,
      currentQuantity: this.detailForm.value.currentQuantity
    };

    this.saved.emit(updateDto);
  }

  close(): void {
    this.detailForm.reset();
    this.errorMessage = '';
    this.closed.emit();
  }

  getFieldError(fieldName: string): string {
    const control = this.detailForm.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        const key = `editInventoryDetail.${fieldName}Required`;
        return this.translateService.instant(key) || `${fieldName} is required`;
      }
      if (control.errors['min']) {
        const key = `editInventoryDetail.${fieldName}MustBeGreater`;
        return this.translateService.instant(key) || `${fieldName} must be greater than ${control.errors['min'].min}`;
      }
    }
    return '';
  }

  get title(): string {
    return this.translateService.instant('editInventoryDetail.title');
  }
}

