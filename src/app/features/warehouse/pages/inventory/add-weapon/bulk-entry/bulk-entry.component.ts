import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Save, X, ArrowLeft, ArrowRight } from 'lucide-angular';

// Services
import { AssetService } from '@services/asset.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';

// Models
import { CreateAssetDto, UpdateAssetDto } from '@models/asset.model';

// Components
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';

// Utils
import { ErrorHandler } from '@utils/error-handler.utils';
import { trackByIndex } from '@utils/trackby.utils';

interface BulkAssetData {
    warehouseId: number;
    itemId: number;
    batchNumber: string;
    quantity: number;
    purchaseDate?: string;
    warrantyExpiryDate?: string;
    condition?: string;
    purchasePrice?: number;
    deliveryReceipt?: string;
    notes?: string;
}

@Component({
    selector: 'app-bulk-entry',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule,
        TranslateModule,
        LucideAngularModule,
        LoadingStateComponent,
        ErrorStateComponent,
        HasPermissionDirective
    ],
    templateUrl: './bulk-entry.component.html',
    styleUrls: ['./bulk-entry.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkEntryComponent implements OnInit, OnDestroy {
    // Icons
    readonly Save = Save;
    readonly X = X;
    readonly ArrowLeft = ArrowLeft;
    readonly ArrowRight = ArrowRight;
    readonly trackByIndex = trackByIndex;

    // Form
    bulkEntryForm!: FormGroup;

    // Data
    bulkData!: BulkAssetData;
    warehouseId!: number;
    loading = false;
    submitting = false;
    errorMessage: string | null = null;
    bulkProgress = { current: 0, total: 0 };
    isProcessingBulk = false;
    deliveryReceiptFiles: File[] = [];

    private destroy$ = new Subject<void>();

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private route: ActivatedRoute,
        private assetService: AssetService,
        private toastService: ToastService,
        private translateService: TranslateService,
        private translationService: TranslationService,
        private cdr: ChangeDetectorRef
    ) { }

    get isRTL(): boolean {
        return this.translationService?.isRTL() ?? false;
    }

    get backIcon() {
        return this.isRTL ? ArrowRight : ArrowLeft;
    }

    get itemsFormArray(): FormArray {
        return this.bulkEntryForm.get('items') as FormArray;
    }

    ngOnInit(): void {
        // Get warehouse ID from route
        this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
            const id = params['id'];
            if (id) {
                this.warehouseId = parseInt(id, 10);
                this.loadBulkData();
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadBulkData(): void {
        const storedData = sessionStorage.getItem('bulkAssetData');
        if (!storedData) {
            this.errorMessage = this.translateService.instant('addWeaponAsset.bulk.noDataFound');
            this.router.navigate(['/warehouse', this.warehouseId, 'assets', 'add']);
            return;
        }

        try {
            this.bulkData = JSON.parse(storedData);
            this.initializeForm();
        } catch (error) {
            this.errorMessage = this.translateService.instant('addWeaponAsset.bulk.invalidData');
            this.router.navigate(['/warehouse', this.warehouseId, 'assets', 'add']);
        }
    }

    private initializeForm(): void {
        const itemsArray = this.fb.array<FormGroup>([]);

        // Create a form group for each item
        for (let i = 0; i < this.bulkData.quantity; i++) {
            itemsArray.push(this.createItemFormGroup(i + 1));
        }

        this.bulkEntryForm = this.fb.group({
            deliveryReceipt: [this.bulkData.deliveryReceipt || ''],
            items: itemsArray
        });
    }

    private createItemFormGroup(index: number): FormGroup {
        return this.fb.group({
            serialNumber: ['', [Validators.maxLength(200)]],
            rfid: ['', [Validators.maxLength(500)]],
            assetTag: ['', [Validators.maxLength(100)]]
        });
    }

    getItemFormGroup(index: number): FormGroup {
        return this.itemsFormArray.at(index) as FormGroup;
    }

    isFieldInvalid(fieldPath: string, index: number): boolean {
        const group = this.getItemFormGroup(index);
        const control = group.get(fieldPath);
        return !!(control && control.invalid && (control.dirty || control.touched));
    }

    getFieldError(fieldPath: string, index: number): string | null {
        const group = this.getItemFormGroup(index);
        const control = group.get(fieldPath);

        if (!control || !control.errors) return null;

        if (control.errors['maxlength']) {
            return this.translateService.instant('addWeaponAsset.maxLength', {
                max: control.errors['maxlength'].requiredLength
            });
        }

        return null;
    }

    onFieldChange(fieldPath: string, index: number): void {
        const group = this.getItemFormGroup(index);
        const control = group.get(fieldPath);
        if (control) {
            control.markAsTouched();
            control.updateValueAndValidity();
        }
    }

    onSubmit(): void {
        this.bulkEntryForm.markAllAsTouched();
        this.itemsFormArray.controls.forEach(itemGroup => {
            (itemGroup as FormGroup).markAllAsTouched();
        });

        if (this.bulkEntryForm.invalid) {
            const title = this.translateService.instant('toast.error');
            const message = this.translateService.instant('addWeaponAsset.validationError');
            this.toastService.error(message, title);
            return;
        }

        const formValue = this.bulkEntryForm.value;
        const createDtos: CreateAssetDto[] = formValue.items.map((item: any, index: number) => ({
            itemId: this.bulkData.itemId,
            batchNumber: this.bulkData.batchNumber,
            depotId: this.warehouseId,
            serialNumber: item.serialNumber?.trim() || undefined,
            rfid: item.rfid?.trim() || undefined,
            assetTag: item.assetTag?.trim() || undefined,
            purchaseDate: this.bulkData.purchaseDate || undefined,
            warrantyExpiryDate: this.bulkData.warrantyExpiryDate || undefined,
            condition: this.bulkData.condition?.trim() || undefined,
            purchasePrice: this.bulkData.purchasePrice || undefined,
            deliveryReceipt: (formValue.deliveryReceipt?.trim && formValue.deliveryReceipt.trim()) || undefined,
            notes: this.bulkData.notes?.trim() || undefined
        }));

        if (createDtos.length === 0) return;

        this.submitting = true;
        this.isProcessingBulk = true;
        this.bulkProgress = { current: 0, total: createDtos.length };
        this.errorMessage = null;
        this.cdr.markForCheck();

        // Create assets in bulk
        this.bulkProgress = { current: 0, total: createDtos.length }; // Initial state

        this.assetService.createBulk<number[]>(createDtos)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (ids: number[]) => {
                    this.submitting = false;
                    this.isProcessingBulk = false;
                    this.bulkProgress = { current: createDtos.length, total: createDtos.length };
                    this.cdr.markForCheck();

                    // Clear session storage
                    sessionStorage.removeItem('bulkAssetData');

                    this.translateService.get(['toast.success', 'addWeaponAsset.successMessage']).subscribe(translations => {
                        const message = translations['addWeaponAsset.successMessage'] || 'Weapon assets created successfully!';
                        const title = translations['toast.success'];
                        this.toastService.success(message, title);
                    });

                    // If attachments selected, upload to all created assets and set deliveryReceipt if provided
                    const deliveryReceiptValue: string | undefined = (this.bulkEntryForm.value.deliveryReceipt?.trim && this.bulkEntryForm.value.deliveryReceipt.trim()) || undefined;
                    if (Array.isArray(ids) && ids.length && (this.deliveryReceiptFiles.length || deliveryReceiptValue)) {
                        ids.forEach(id => {
                            const updateDto: UpdateAssetDto = {
                                itemId: this.bulkData.itemId,
                                deliveryReceipt: deliveryReceiptValue
                            };
                            this.assetService.update(id, updateDto, this.deliveryReceiptFiles.length ? this.deliveryReceiptFiles : undefined)
                                .pipe(takeUntil(this.destroy$))
                                .subscribe();
                        });
                    }

                    // Redirect after a short delay - return to weapons tab
                    setTimeout(() => {
                        this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
                            queryParams: { tab: 'weapon' },
                            queryParamsHandling: 'merge'
                        });
                    }, 500);
                },
                error: (error: unknown) => {
                    const fallbackMessage = this.translateService.instant('addWeaponAsset.createError');
                    const errorMsg = ErrorHandler.extractErrorMessage(error, fallbackMessage);
                    this.errorMessage = errorMsg;
                    this.submitting = false;
                    this.isProcessingBulk = false;
                    this.cdr.markForCheck();

                    this.translateService.get(['toast.error']).subscribe(translations => {
                        this.toastService.error(errorMsg, translations['toast.error']);
                    });
                }
            });
    }

    onCancel(): void {
        sessionStorage.removeItem('bulkAssetData');
        this.router.navigate(['/warehouse', this.warehouseId, 'assets', 'add']);
    }

    onBack(): void {
        this.router.navigate(['/warehouse', this.warehouseId, 'assets', 'add']);
    }

    onAttachmentChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const newlySelected = input.files ? Array.from(input.files) : [];
        if (newlySelected.length) {
            const combined = [...this.deliveryReceiptFiles, ...newlySelected];
            const seen = new Set<string>();
            this.deliveryReceiptFiles = combined.filter(f => {
                const key = `${f.name}::${f.size}::${(f as any).lastModified ?? 0}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
        // Keep input value to allow further appends; not clearing here
    }

    removeAttachment(index: number): void {
        if (index >= 0 && index < this.deliveryReceiptFiles.length) {
            this.deliveryReceiptFiles.splice(index, 1);
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
}

