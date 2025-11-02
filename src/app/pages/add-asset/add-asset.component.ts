import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
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

interface AssetForm {
  productName: string;
  productId: string;
  natureId: string;
  supplierId: string;
  quantity: string;
  lot: string;
  expiryDate: string;
  warehouseId: string;
  hccId: string;
  countryId: string;
  manufacturerId: string;
  image?: File;
}

@Component({
  selector: 'app-add-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CardComponent, ButtonComponent, LucideAngularModule],
  templateUrl: './add-asset.component.html',
  styleUrls: ['./add-asset.component.css']
})
export class AddAssetComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;

  previewUrl: string | null = null;
  private destroy$ = new Subject<void>();

  // Lookup data
  warehouses: DepotDto[] = [];
  suppliers: SupplierDto[] = [];
  natureOptions: NatureOptionDto[] = [];
  hccs: HccDto[] = [];
  countries: CountryDto[] = [];
  manufacturers: ManufacturerDto[] = [];

  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private translationService: TranslationService,
    private lookupService: LookupService,
    private apiService: ApiService
  ) {}

  assetForm: AssetForm = {
    productName: '',
    productId: '',
    natureId: '',
    supplierId: '',
    quantity: '',
    lot: '',
    expiryDate: '',
    warehouseId: '',
    hccId: '',
    countryId: '',
    manufacturerId: '',
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
      warehouses: this.lookupService.getDepots(),
      suppliers: this.lookupService.getSuppliers(),
      natureOptions: this.lookupService.getNatureOptions(),
      hccs: this.lookupService.getHccs(),
      countries: this.lookupService.getCountries(),
      manufacturers: this.lookupService.getManufacturers()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.warehouses = data.warehouses;
          this.suppliers = data.suppliers;
          this.natureOptions = data.natureOptions;
          this.hccs = data.hccs;
          this.countries = data.countries;
          this.manufacturers = data.manufacturers;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading lookup data:', error);
          this.errorMessage = 'Failed to load lookup data. Using sample data for testing.';
          this.loading = false;
        }
      });
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    const ammunitionDto: AmmunitionCreateDto = {
      itemNo: this.assetForm.productId,
      lot: parseInt(this.assetForm.lot) || 0,
      batchNo: this.assetForm.productName,
      hccId: parseInt(this.assetForm.hccId),
      supplierId: this.assetForm.supplierId ? parseInt(this.assetForm.supplierId) : undefined,
      countryId: this.assetForm.countryId ? parseInt(this.assetForm.countryId) : undefined,
      manufacturerId: this.assetForm.manufacturerId ? parseInt(this.assetForm.manufacturerId) : undefined,
      natureOptionId: this.assetForm.natureId ? parseInt(this.assetForm.natureId) : undefined,
      // Default values for required fields not in simple form
      bulletDiameter: 0,
      bulletDiameterUnitId: 1,
      caseLength: 0,
      caseLengthUnitId: 1,
      isLinked: false,
      primer: 'Standard',
      totalWeight: 0,
      nsnId: 1,
      caseTypeId: 1,
      propellantId: 1,
      compatibilityId: 1,
      hazardDivisionId: 1,
      readyForIssue: true
    };

    this.apiService.postWithAuth<APIOperationResponse<AmmunitionReadDto>>('/Ammunition', ammunitionDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.successMessage = 'Asset created successfully!';
            console.log('Asset created:', response.data);
            setTimeout(() => {
              this.resetForm();
              this.successMessage = null;
            }, 3000);
          } else {
            this.errorMessage = response.message || 'Failed to create asset';
          }
          this.submitting = false;
        },
        error: (error) => {
          console.error('Error creating asset:', error);
          this.errorMessage = error.message || 'Failed to create asset. Please try again.';
          this.submitting = false;
        }
      });
  }

  validateForm(): boolean {
    return !!(
      this.assetForm.productId &&
      this.assetForm.productName &&
      this.assetForm.lot &&
      this.assetForm.hccId &&
      this.assetForm.warehouseId &&
      this.assetForm.quantity
    );
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

  private resetForm(): void {
    this.assetForm = {
      productName: '',
      productId: '',
      natureId: '',
      supplierId: '',
      quantity: '',
      lot: '',
      expiryDate: '',
      warehouseId: '',
      hccId: '',
      countryId: '',
      manufacturerId: '',
      image: undefined
    };
    this.previewUrl = null;
    this.errorMessage = null;
  }
}
