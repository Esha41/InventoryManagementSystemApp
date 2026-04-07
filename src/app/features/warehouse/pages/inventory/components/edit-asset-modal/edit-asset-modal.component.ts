import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { AssetService } from '@services/asset.service';
import { ToastService } from '@services/toast.service';
import { AssetDto, UpdateAssetDto } from '@models/asset.model';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { formatDateForInput } from '@utils/format.utils';

@Component({
    selector: 'app-edit-asset-modal',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TranslateModule,
        LucideAngularModule,
        ModalComponent,
        ButtonComponent
    ],
    templateUrl: './edit-asset-modal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditAssetModalComponent implements OnInit, OnChanges {
    @Input() isOpen = false;
    @Input() asset: AssetDto | null = null;
    @Output() closed = new EventEmitter<void>();
    @Output() saved = new EventEmitter<void>();

    assetForm!: FormGroup;
    isLoading = false;
    errorMessage: string | null = null;

    constructor(
        private fb: FormBuilder,
        private assetService: AssetService,
        private toastService: ToastService,
        private translateService: TranslateService
    ) {
        this.initForm();
    }

    ngOnInit(): void { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['asset'] && this.asset && this.isOpen && this.assetForm) {
            this.patchForm();
        }
        if (changes['isOpen'] && !this.isOpen && this.assetForm) {
            this.assetForm.reset();
        }
    }

    private initForm(): void {
        this.assetForm = this.fb.group({
            serialNumber: [''],
            rfid: [''],
            purchaseDate: [null],
            warrantyExpiryDate: [null],
            purchasePrice: [null, [Validators.min(0)]],
            deliveryReceipt: [''],
            notes: ['']
        });
    }

    private patchForm(): void {
        if (!this.asset || !this.assetForm) return;

        const formatDate = (date: Date | string | undefined) => {
            if (!date) return null;
            return formatDateForInput(date) || null;
        };

        this.assetForm.patchValue({
            serialNumber: this.asset.serialNumber,
            rfid: this.asset.rfid,
            purchaseDate: formatDate(this.asset.purchaseDate),
            warrantyExpiryDate: formatDate(this.asset.warrantyExpiryDate),
            purchasePrice: this.asset.purchasePrice,
            deliveryReceipt: this.asset.deliveryReceipt,
            notes: this.asset.notes
        });
    }

    close(): void {
        this.closed.emit();
        if (this.assetForm) {
            this.assetForm.reset();
        }
        this.errorMessage = null;
    }

    onSubmit(): void {
        if (this.assetForm.invalid || !this.asset) return;

        this.isLoading = true;
        this.errorMessage = null;

        const formValue = this.assetForm.value;
        const updateDto: UpdateAssetDto = {
            itemId: this.asset.itemId,
            serialNumber: formValue.serialNumber,
            rfid: formValue.rfid,
            purchaseDate: formValue.purchaseDate ? new Date(formValue.purchaseDate) : undefined,
            warrantyExpiryDate: formValue.warrantyExpiryDate ? new Date(formValue.warrantyExpiryDate) : undefined,
            purchasePrice: formValue.purchasePrice,
            deliveryReceipt: formValue.deliveryReceipt?.trim() || undefined,
            notes: formValue.notes
        };

        this.assetService.update(this.asset.id, updateDto).subscribe({
            next: () => {
                this.isLoading = false;
                this.translateService.get(['toast.success', 'common.savedSuccessfully']).subscribe(translations => {
                    this.toastService.success(
                        translations['common.savedSuccessfully'] || 'Saved successfully',
                        translations['toast.success']
                    );
                    this.saved.emit();
                    this.close();
                });
            },
            error: (error) => {
                this.isLoading = false;
                console.error('Error updating asset:', error);
                this.translateService.get('common.failedToSave').subscribe(msg => {
                    this.errorMessage = msg;
                });
            }
        });
    }

    getFieldError(fieldName: string): string | null {
        const control = this.assetForm.get(fieldName);
        if (control?.invalid && (control.dirty || control.touched)) {
            if (control.errors?.['min']) return this.translateService.instant('addWeaponAsset.minValue', { min: 0 });
        }
        return null;
    }
}
