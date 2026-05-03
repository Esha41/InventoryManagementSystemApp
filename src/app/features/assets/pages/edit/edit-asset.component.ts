import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, Save, Loader2 } from 'lucide-angular';

import { AssetService } from '@assets/services/asset.service';
import { ToastService } from '@services/toast.service';
import { AssetDto, UpdateAssetDto } from '@models/asset.model';
import { LookupService } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { CardComponent } from '@components/card/card.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatDateForInput } from '@utils/format.utils';

@Component({
  selector: 'app-edit-asset',
  standalone: true,
    imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    DropdownComponent
  ],
  templateUrl: './edit-asset.component.html',
  styleUrl: './edit-asset.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditAssetComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly Save = Save;
  readonly Loader2 = Loader2;

  editForm!: FormGroup;
  assetId!: number;
  warehouseId!: number;
  loading = true;
  saving = false;
  submitted = false;
  asset: AssetDto | null = null;
  error: string | null = null;
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];
  allPrimaryPurposes: LookupItem[] = [];
  primaryPurposeOptions: LookupItem[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private assetService: AssetService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initForm();

    this.assetId = Number(this.route.snapshot.paramMap.get('id'));
    this.warehouseId = Number(this.route.snapshot.paramMap.get('warehouseId'));

    if (this.assetId) {
      this.loadAsset(this.assetId);
    } else {
      this.loading = false;
      this.error = 'Invalid Asset ID';
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.editForm = this.fb.group({
      // Identification
      serialNumber: ['', [Validators.required]],
      rfid: [''],

      // Additional Details
      purchaseDate: [null],
      warrantyExpiryDate: [null],
      purchasePrice: [null, [Validators.min(0)]],
      notes: [''],
      supplierId: [null as number | null],
      manufacturerId: [null as number | null],
      primaryPurposId: [null as number | null]
    });
  }

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null): string => {
    if (!option) return '';
    const item =
      typeof option === 'object' && option !== null && 'value' in option && (option as DropdownOption<LookupItem>).value != null
        ? (option as DropdownOption<LookupItem>).value!
        : (option as LookupItem);
    return getLocalizedName(item, getCurrentLang(this.translateService)) || '';
  };

  private loadAsset(id: number): void {
    this.loading = true;
    this.cdr.markForCheck();
    forkJoin({
      asset: this.assetService.getById<AssetDto>(id),
      suppliers: this.lookupService.getSuppliers(),
      manufacturers: this.lookupService.getManufacturers(),
      primaryPurposes: this.lookupService.getPrimaryPurposes()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ asset, suppliers, manufacturers, primaryPurposes }) => {
          this.asset = asset;
          this.suppliers = (suppliers || []).filter(s => !s.isDeleted);
          this.manufacturers = (manufacturers || []).filter(m => !m.isDeleted);
          this.allPrimaryPurposes = (primaryPurposes || []).filter(p => !p.isDeleted);
          if (asset) {
            this.primaryPurposeOptions = this.buildPrimaryPurposeOptions(asset);
            this.patchForm(asset);
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading asset:', error);
          this.error = 'Failed to load asset details';
          this.loading = false;
          this.cdr.markForCheck();
          this.translateService.get(['toast.error', 'assetDetails.failedToLoad']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(
              translations['assetDetails.failedToLoad'] || 'Failed to load asset details',
              translations['toast.error']
            );
          });
        }
      });
  }

  private patchForm(asset: AssetDto): void {
    // Format dates for input type="date" (YYYY-MM-DD)
    const formatDate = (date: Date | string | undefined) => {
      if (!date) return null;
      return formatDateForInput(date) || null;
    };

    this.editForm.patchValue({
      serialNumber: asset.serialNumber,
      rfid: asset.rfid,
      purchaseDate: formatDate(asset.purchaseDate),
      warrantyExpiryDate: formatDate(asset.warrantyExpiryDate),
      purchasePrice: asset.purchasePrice,
      notes: asset.notes,
      supplierId: asset.supplierId ?? null,
      manufacturerId: asset.manufacturerId ?? null,
      primaryPurposId: asset.primaryPurposId ?? null
    });
  }

  private buildPrimaryPurposeOptions(asset: AssetDto): LookupItem[] {
    const linked = asset.item?.primaryPurposes;
    if (linked?.length) {
      return linked
        .filter(p => p.id != null)
        .map(p => ({ id: p.id, nameAr: p.nameAr ?? '', nameEn: p.nameEn ?? '' }));
    }
    return this.allPrimaryPurposes;
  }

  getItemName(): string {
    if (!this.asset?.item) return '-';
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(this.asset.item, lang) || this.asset.item.name || '-';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.editForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.submitted));
  }

  onCancel(): void {
    this.router.navigate(['/warehouse', this.warehouseId, 'assets', this.assetId]);
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.editForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.editForm.controls).forEach(key => {
        const control = this.editForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    if (!this.asset) return;

    this.saving = true;
    this.cdr.markForCheck();
    const formValue = this.editForm.value;

    const updateDto: UpdateAssetDto = {
      itemId: this.asset.itemId,
      serialNumber: formValue.serialNumber,
      rfid: formValue.rfid,
      purchaseDate: formValue.purchaseDate ? new Date(formValue.purchaseDate) : undefined,
      warrantyExpiryDate: formValue.warrantyExpiryDate ? new Date(formValue.warrantyExpiryDate) : undefined,
      purchasePrice: formValue.purchasePrice,
      notes: formValue.notes,
      supplierId: formValue.supplierId ?? null,
      manufacturerId: formValue.manufacturerId ?? null,
      primaryPurposId: formValue.primaryPurposId ?? null
    };

    this.assetService.update(this.assetId, updateDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.cdr.markForCheck();
          this.translateService.get(['toast.success', 'common.savedSuccessfully']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.success(
              translations['common.savedSuccessfully'] || 'Saved successfully',
              translations['toast.success']
            );
            this.onCancel(); // Navigate back to details
          });
        },
        error: (error) => {
          console.error('Error updating asset:', error);
          this.saving = false;
          this.cdr.markForCheck();
          this.translateService.get(['toast.error', 'common.failedToSave']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(
              translations['common.failedToSave'] || 'Failed to save changes',
              translations['toast.error']
            );
          });
        }
      });
  }
}
