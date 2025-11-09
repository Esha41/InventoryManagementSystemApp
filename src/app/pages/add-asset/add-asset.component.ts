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

  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  showToast = false;

  constructor(
    private translationService: TranslationService,
    private lookupService: LookupService,
    private apiService: ApiService
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

  onSubmit(): void {
    if (!this.validateForm()) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    const ammunitionDto: AmmunitionCreateDto = {
      name: this.assetForm.name,
      partNo: this.assetForm.partNo,
      itemNo: this.assetForm.itemNo,
      batchNo: this.assetForm.batchNo,
      hccId: parseInt(this.assetForm.hccId),
      bulletDiameter: parseFloat(this.assetForm.bulletDiameter) || 0,
      bulletDiameterUnitId: parseInt(this.assetForm.bulletDiameterUnitId),
      caseLength: parseFloat(this.assetForm.caseLength) || 0,
      caseLengthUnitId: parseInt(this.assetForm.caseLengthUnitId),
      isLinked: this.assetForm.isLinked === 'true',
      primer: this.assetForm.primer,
      totalWeight: parseFloat(this.assetForm.totalWeight) || 0,
      nsn: this.assetForm.nsn ? this.assetForm.nsn.trim() : undefined,
      caseTypeId: parseInt(this.assetForm.caseTypeId),
      propellantId: parseInt(this.assetForm.propellantId),
      compatibilityId: parseInt(this.assetForm.compatibilityId),
      hazardDivisionId: parseInt(this.assetForm.hazardDivisionId),
      readyForIssue: this.assetForm.readyForIssue,
      lot: 0,
      natureOptionId: this.assetForm.natureOptionId ? parseInt(this.assetForm.natureOptionId) : undefined,
      primaryPurposId: this.assetForm.primaryPurposId ? parseInt(this.assetForm.primaryPurposId) : undefined,
      projectileColorId: this.assetForm.projectileColorId ? parseInt(this.assetForm.projectileColorId) : undefined,
      projectailMaterialId: this.assetForm.projectailMaterialId ? parseInt(this.assetForm.projectailMaterialId) : undefined
    };

    this.apiService.postWithAuth<APIOperationResponse<AmmunitionReadDto>>('/Ammunition', ammunitionDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.showSuccessToast('Ammunition created successfully');
            console.log('Asset created:', response.data);
            setTimeout(() => {
              this.resetForm();
            }, 800);
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

  private showSuccessToast(message: string): void {
    this.successMessage = message;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
      setTimeout(() => (this.successMessage = null), 300);
    }, 2500);
  }

  validateForm(): boolean {
    return !!(
      this.assetForm.name &&
      this.assetForm.itemNo &&
      this.assetForm.partNo &&
      this.assetForm.hccId &&
      this.assetForm.bulletDiameterUnitId &&
      this.assetForm.caseLengthUnitId &&
      this.assetForm.nsn.trim() &&
      this.assetForm.caseTypeId &&
      this.assetForm.propellantId &&
      this.assetForm.compatibilityId &&
      this.assetForm.hazardDivisionId
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
  }
}
