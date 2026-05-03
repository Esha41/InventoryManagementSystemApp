import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X, Save, Loader2 } from 'lucide-angular';

import { AssetService } from '@assets/services/asset.service';
import { ToastService } from '@services/toast.service';
import { AssetDto, UpdateAssetDto } from '@models/asset.model';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupService } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatDateForInput } from '@utils/format.utils';
import { Subject, takeUntil, forkJoin } from 'rxjs';

@Component({
  selector: 'app-edit-asset-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    DropdownComponent
  ],
  templateUrl: './edit-asset-modal.component.html',
  styleUrls: ['./edit-asset-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditAssetModalComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() asset: AssetDto | null = null;
  @Input() loading = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly X = X;
  readonly Save = Save;
  readonly Loader2 = Loader2;

  editForm!: FormGroup;
  saving = false;
  submitted = false;
  private selectedFiles: File[] = [];
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];
  allPrimaryPurposes: LookupItem[] = [];
  primaryPurposeOptions: LookupItem[] = [];

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null): string => {
    if (!option) return '';
    const item =
      typeof option === 'object' && option !== null && 'value' in option && (option as DropdownOption<LookupItem>).value != null
        ? (option as DropdownOption<LookupItem>).value!
        : (option as LookupItem);
    return getLocalizedName(item, getCurrentLang(this.translateService)) || '';
  };

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private assetService: AssetService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && !this.isOpen && this.editForm) {
      this.editForm.reset();
      this.submitted = false;
      this.saving = false;
      return;
    }
    if (!this.isOpen || !this.asset || !this.editForm) {
      return;
    }
    if (changes['isOpen']?.currentValue === true || changes['asset']) {
      forkJoin({
        suppliers: this.lookupService.getSuppliers(),
        manufacturers: this.lookupService.getManufacturers(),
        primaryPurposes: this.lookupService.getPrimaryPurposes()
      })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: ({ suppliers, manufacturers, primaryPurposes }) => {
            this.suppliers = (suppliers || []).filter(s => !s.isDeleted);
            this.manufacturers = (manufacturers || []).filter(m => !m.isDeleted);
            this.allPrimaryPurposes = (primaryPurposes || []).filter(p => !p.isDeleted);
            this.primaryPurposeOptions = this.buildPrimaryPurposeOptions(this.asset!);
            this.patchForm(this.asset!);
            this.cdr.markForCheck();
          }
        });
    }
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.editForm = this.fb.group({
      // Identification
      serialNumber: [''],
      rfid: [''],

      // Additional Details
      purchaseDate: [null],
      warrantyExpiryDate: [null],
      purchasePrice: [null, [Validators.min(0)]],
      deliveryReceipt: [''],
      notes: [''],
      supplierId: [null as number | null],
      manufacturerId: [null as number | null],
      primaryPurposId: [null as number | null]
    });
  }

  private patchForm(asset: AssetDto): void {
    // Format dates for input type="date" (YYYY-MM-DD)
    const formatDate = (date: Date | string | undefined) => {
      if (!date) return null;
      return formatDateForInput(date) || null;
    };

    this.editForm.patchValue({
      serialNumber: asset.serialNumber || '',
      rfid: asset.rfid || '',
      purchaseDate: formatDate(asset.purchaseDate),
      warrantyExpiryDate: formatDate(asset.warrantyExpiryDate),
      purchasePrice: asset.purchasePrice || null,
      deliveryReceipt: asset.deliveryReceipt || '',
      notes: asset.notes || '',
      supplierId: asset.supplierId ?? null,
      manufacturerId: asset.manufacturerId ?? null,
      primaryPurposId: asset.primaryPurposId ?? null
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

  close(): void {
    this.editForm.reset();
    this.submitted = false;
    this.saving = false;
    this.closed.emit();
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.editForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.editForm.controls).forEach(key => {
        const control = this.editForm.get(key);
        control?.markAsTouched();
      });
      this.cdr.markForCheck();
      return;
    }

    if (!this.asset) return;

    this.saving = true;
    this.cdr.markForCheck();

    const formValue = this.editForm.value;

    const updateDto: UpdateAssetDto = {
      itemId: this.asset.itemId,
      serialNumber: formValue.serialNumber?.trim() || undefined,
      rfid: formValue.rfid?.trim() || undefined,
      purchaseDate: formValue.purchaseDate ? new Date(formValue.purchaseDate) : undefined,
      warrantyExpiryDate: formValue.warrantyExpiryDate ? new Date(formValue.warrantyExpiryDate) : undefined,
      purchasePrice: formValue.purchasePrice || undefined,
      deliveryReceipt: formValue.deliveryReceipt?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
      supplierId: formValue.supplierId ?? null,
      manufacturerId: formValue.manufacturerId ?? null,
      primaryPurposId: formValue.primaryPurposId ?? null
    };

    this.assetService.update(this.asset.id, updateDto, this.selectedFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.finishSuccess();
        },
        error: (error: unknown) => {
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

  private finishSuccess(): void {
    this.saving = false;
    this.translateService.get(['toast.success', 'common.savedSuccessfully']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
      this.toastService.success(
        translations['common.savedSuccessfully'] || 'Saved successfully',
        translations['toast.success']
      );
    });
    this.saved.emit();
    this.close();
  }

  onAttachmentChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newlySelected = input.files ? Array.from(input.files) : [];
    if (newlySelected.length) {
      const combined = [...this.selectedFiles, ...newlySelected];
      const seen = new Set<string>();
      this.selectedFiles = combined.filter(f => {
        const key = `${f.name}::${f.size}::${(f as any).lastModified ?? 0}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    // Keep input value to allow further appends
  }

  removeAttachment(index: number): void {
    if (index >= 0 && index < this.selectedFiles.length) {
      this.selectedFiles.splice(index, 1);
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

  getMaxDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
}

