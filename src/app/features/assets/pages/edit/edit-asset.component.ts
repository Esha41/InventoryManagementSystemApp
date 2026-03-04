import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, Save, Loader2 } from 'lucide-angular';

import { AssetService } from '@services/asset.service';
import { ToastService } from '@services/toast.service';
import { AssetDto, UpdateAssetDto } from '@models/asset.model';
import { CardComponent } from '@components/card/card.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-edit-asset',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent
  ],
  templateUrl: './edit-asset.component.html',
  styleUrl: './edit-asset.component.css'
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

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private assetService: AssetService,
    private toastService: ToastService,
    private translateService: TranslateService
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
      assetTag: [''],

      // Additional Details
      condition: [''],
      purchaseDate: [null],
      warrantyExpiryDate: [null],
      purchasePrice: [null, [Validators.min(0)]],
      notes: ['']
    });
  }

  private loadAsset(id: number): void {
    this.loading = true;
    this.assetService.getById<AssetDto>(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (asset) => {
          this.asset = asset;
          if (asset) {
            this.patchForm(asset);
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading asset:', error);
          this.error = 'Failed to load asset details';
          this.loading = false;
          this.translateService.get(['toast.error', 'assetDetails.failedToLoad']).subscribe(translations => {
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
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    };

    this.editForm.patchValue({
      serialNumber: asset.serialNumber,
      rfid: asset.rfid,
      assetTag: asset.assetTag,
      condition: asset.condition,
      purchaseDate: formatDate(asset.purchaseDate),
      warrantyExpiryDate: formatDate(asset.warrantyExpiryDate),
      purchasePrice: asset.purchasePrice,
      notes: asset.notes
    });
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
    const formValue = this.editForm.value;

    const updateDto: UpdateAssetDto = {
      itemId: this.asset.itemId,
      serialNumber: formValue.serialNumber,
      rfid: formValue.rfid,
      assetTag: formValue.assetTag,
      condition: formValue.condition,
      purchaseDate: formValue.purchaseDate ? new Date(formValue.purchaseDate) : undefined,
      warrantyExpiryDate: formValue.warrantyExpiryDate ? new Date(formValue.warrantyExpiryDate) : undefined,
      purchasePrice: formValue.purchasePrice,
      notes: formValue.notes
    };

    this.assetService.update(this.assetId, updateDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.translateService.get(['toast.success', 'common.savedSuccessfully']).subscribe(translations => {
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
          this.translateService.get(['toast.error', 'common.failedToSave']).subscribe(translations => {
            this.toastService.error(
              translations['common.failedToSave'] || 'Failed to save changes',
              translations['toast.error']
            );
          });
        }
      });
  }
}
