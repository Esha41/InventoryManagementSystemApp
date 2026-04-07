import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X, Save, Loader2 } from 'lucide-angular';

import { AssetService } from '@services/asset.service';
import { ToastService } from '@services/toast.service';
import { AssetDto, UpdateAssetDto } from '@models/asset.model';
import { ButtonComponent } from '@components/button/button.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatDateForInput } from '@utils/format.utils';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-edit-asset-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent
  ],
  templateUrl: './edit-asset-modal.component.html',
  styleUrls: ['./edit-asset-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditAssetModalComponent implements OnInit, OnChanges {
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

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private assetService: AssetService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit(): void { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asset'] && this.asset && this.editForm) {
      this.patchForm(this.asset);
      this.cdr.markForCheck();
    }
    if (changes['isOpen'] && !this.isOpen && this.editForm) {
      // Reset form when modal closes
      this.editForm.reset();
      this.submitted = false;
      this.saving = false;
    }
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
      notes: ['']
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
      notes: asset.notes || ''
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
      notes: formValue.notes?.trim() || undefined
    };

    this.assetService.update(this.asset.id, updateDto, this.selectedFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.finishSuccess();
        },
        error: (error) => {
          console.error('Error updating asset:', error);
          this.saving = false;
          this.cdr.markForCheck();
          this.translateService.get(['toast.error', 'common.failedToSave']).subscribe(translations => {
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
    this.translateService.get(['toast.success', 'common.savedSuccessfully']).subscribe(translations => {
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

