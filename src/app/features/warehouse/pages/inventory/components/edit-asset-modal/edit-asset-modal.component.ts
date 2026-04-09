import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
import { LookupService } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { forkJoin } from 'rxjs';

@Component({
    selector: 'app-edit-asset-modal',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TranslateModule,
        LucideAngularModule,
        ModalComponent,
        ButtonComponent,
        DropdownComponent
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

    ngOnInit(): void { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen'] && !this.isOpen && this.assetForm) {
            this.assetForm.reset();
            return;
        }
        if (!this.isOpen || !this.asset || !this.assetForm) {
            return;
        }
        if (changes['isOpen']?.currentValue === true || changes['asset']) {
            forkJoin({
                suppliers: this.lookupService.getSuppliers(),
                manufacturers: this.lookupService.getManufacturers(),
                primaryPurposes: this.lookupService.getPrimaryPurposes()
            }).subscribe({
                next: ({ suppliers, manufacturers, primaryPurposes }) => {
                    this.suppliers = (suppliers || []).filter(s => !s.isDeleted);
                    this.manufacturers = (manufacturers || []).filter(m => !m.isDeleted);
                    this.allPrimaryPurposes = (primaryPurposes || []).filter(p => !p.isDeleted);
                    this.primaryPurposeOptions = this.buildPrimaryPurposeOptions(this.asset!);
                    this.patchForm();
                    this.cdr.markForCheck();
                }
            });
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
            notes: [''],
            supplierId: [null as number | null],
            manufacturerId: [null as number | null],
            primaryPurposId: [null as number | null]
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
            notes: this.asset.notes,
            supplierId: this.asset.supplierId ?? null,
            manufacturerId: this.asset.manufacturerId ?? null,
            primaryPurposId: this.asset.primaryPurposId ?? null
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
            notes: formValue.notes,
            supplierId: formValue.supplierId ?? null,
            manufacturerId: formValue.manufacturerId ?? null,
            primaryPurposId: formValue.primaryPurposId ?? null
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
