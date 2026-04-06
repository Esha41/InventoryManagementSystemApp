import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, Save, Loader2, Trash2 } from 'lucide-angular';

import { BatchService } from '@services/batch.service';
import { AssetService } from '@services/asset.service';
import { FileUploadService } from '@services/file-upload.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { BatchDto, BulkUpdateBatchAssetsDto, BatchAssetUpdateItem } from '@models/batch.model';
import { AssetDto } from '@models/asset.model';
import { UpdateAssetDto } from '@models/asset.model';
import { CardComponent } from '@components/card/card.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { trackByIndex } from '@utils/trackby.utils';
import { formatDateForInput } from '@utils/format.utils';

@Component({
    selector: 'app-edit-batch',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule,
        TranslateModule,
        LucideAngularModule,
        CardComponent,
        DropdownComponent,
        LoadingStateComponent,
        ErrorStateComponent
    ],
    templateUrl: './edit-batch.component.html',
    styleUrls: ['./edit-batch.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditBatchComponent implements OnInit, OnDestroy {
    readonly ArrowLeft = ArrowLeft;
    readonly ArrowRight = ArrowRight;
    readonly Save = Save;
    readonly Loader2 = Loader2;
    readonly Trash2 = Trash2;
    readonly trackByIndex = trackByIndex;

    batchId!: number;
    warehouseId!: number;
    batch: BatchDto | null = null;
    loading = true;
    saving = false;
    error: string | null = null;

    batchForm!: FormGroup;
    get assetForms(): FormArray {
        return this.batchForm?.get('assets') as FormArray;
    }

    private removedAssetIds = new Set<number>();
    private destroy$ = new Subject<void>();
    deliveryReceiptFiles: File[] = [];

    get existingFiles() {
        return this.batch?.assets?.[0]?.images || [];
    }

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private batchService: BatchService,
        private assetService: AssetService,
        private fileUploadService: FileUploadService,
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

    ngOnInit(): void {
        this.batchId = Number(this.route.snapshot.paramMap.get('batchId'));
        this.warehouseId = Number(this.route.snapshot.paramMap.get('id'));

        if (this.batchId) {
            this.loadBatch();
        } else {
            this.loading = false;
            this.error = 'Invalid Batch ID';
            this.cdr.markForCheck();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadBatch(): void {
        this.loading = true;
        this.cdr.markForCheck();

        this.batchService.getById(this.batchId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (batch) => {
                    this.batch = batch;
                    this.removedAssetIds.clear();
                    this.buildForms(batch?.assets ?? []);
                    this.loading = false;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.error = 'Failed to load batch';
                    this.loading = false;
                    this.cdr.markForCheck();
                }
            });
    }

    private buildForms(assets: AssetDto[]): void {
        const firstAsset = assets[0];
        const commonPurchaseDate = firstAsset?.purchaseDate ? this.formatDate(firstAsset.purchaseDate) : '';
        const commonWarrantyExpiry = firstAsset?.warrantyExpiryDate ? this.formatDate(firstAsset.warrantyExpiryDate) : '';
        const commonPurchasePrice = firstAsset?.purchasePrice ?? null;
        const commonDeliveryReceipt = firstAsset?.deliveryReceipt ?? '';

        const groups = assets.map(asset => this.fb.group({
            assetId: [asset.id],
            itemId: [asset.itemId, Validators.required],
            serialNumber: [asset.serialNumber || '', Validators.maxLength(500)],
            rfid: [asset.rfid || '', Validators.maxLength(500)],
            status: [asset.status],
            assetTag: [asset.assetTag || '', Validators.maxLength(500)],
            condition: [asset.condition || '', Validators.maxLength(500)],
            notes: [asset.notes || '', Validators.maxLength(5000)]
        }));
        this.batchForm = this.fb.group({
            commonInfo: this.fb.group({
                purchaseDate: [commonPurchaseDate],
                warrantyExpiryDate: [commonWarrantyExpiry],
                purchasePrice: [commonPurchasePrice, Validators.min(0)],
                deliveryReceipt: [commonDeliveryReceipt, Validators.maxLength(200)]
            }),
            assets: this.fb.array(groups)
        });
    }

    getDepotName(depot: { nameEn?: string; nameAr?: string; name?: string }): string {
        return getLocalizedName(depot, getCurrentLang(this.translateService)) || depot.name || '';
    }

    private formatDate(date: Date | string): string {
        return formatDateForInput(date);
    }

    getAssetFormGroup(index: number): FormGroup {
        return this.assetForms.at(index) as FormGroup;
    }

    getAssetName(index: number): string {
        if (!this.batch?.assets[index]) return '';
        const asset = this.batch.assets[index];
        if (asset.item) {
            return getLocalizedName(asset.item, getCurrentLang(this.translateService)) || asset.item.name || '';
        }
        return `Asset #${asset.id}`;
    }

    getAssetItemNo(index: number): string {
        if (!this.batch?.assets[index]) return '';
        const asset = this.batch.assets[index];
        return asset.item?.itemNo || '';
    }

    isFieldInvalid(index: number, fieldName: string): boolean {
        const control = this.getAssetFormGroup(index).get(fieldName);
        return !!(control && control.invalid && (control.dirty || control.touched));
    }

    removeRow(index: number): void {
        const assetId = this.getAssetFormGroup(index).get('assetId')?.value;
        if (this.assetForms.length <= 1) return;
        this.assetForms.removeAt(index);
        if (assetId) this.removedAssetIds.add(assetId);
        this.cdr.markForCheck();
    }

    onSaveAll(): void {
        if (!this.batchForm) return;
        this.batchForm.markAllAsTouched();

        if (this.batchForm.invalid) {
            this.toastService.error(
                this.translateService.instant('editBatch.validationError'),
                this.translateService.instant('toast.error')
            );
            return;
        }

        this.saving = true;
        this.cdr.markForCheck();

        const common = this.batchForm.get('commonInfo')?.value ?? {};
        const deliveryReceiptValue: string | undefined = (common.deliveryReceipt?.trim && common.deliveryReceipt.trim()) || undefined;
        const items: BatchAssetUpdateItem[] = (this.assetForms?.controls ?? []).map(control => {
            const val = control.value;
            return {
                assetId: val.assetId,
                itemId: val.itemId,
                serialNumber: val.serialNumber?.trim() || undefined,
                rfid: val.rfid?.trim() || undefined,
                status: val.status,
                assetTag: val.assetTag?.trim() || undefined,
                purchaseDate: common.purchaseDate || undefined,
                warrantyExpiryDate: common.warrantyExpiryDate || undefined,
                condition: val.condition?.trim() || undefined,
                purchasePrice: common.purchasePrice,
                notes: val.notes?.trim() || undefined
            };
        });

        const dto: BulkUpdateBatchAssetsDto = { items };
        const removedIds = Array.from(this.removedAssetIds);

        const removeOps = removedIds.length > 0
            ? forkJoin(removedIds.map(assetId => this.batchService.removeAssetFromBatch(this.batchId, assetId)))
            : of([]);

        removeOps.pipe(
            switchMap((removeResults) => {
                const failed = Array.isArray(removeResults) && removeResults.some((r: boolean) => r === false);
                if (failed) {
                    throw new Error('Failed to remove some assets');
                }
                return this.batchService.bulkUpdateAssets(this.batchId, dto);
            }),
            switchMap(() => {
                // If delivery receipt or files are provided, update each asset using Asset update (multipart/form-data)
                if (!deliveryReceiptValue && (!this.deliveryReceiptFiles || !this.deliveryReceiptFiles.length)) {
                    return of(true);
                }

                const updates = (this.assetForms?.controls ?? []).map(control => {
                    const val = control.value;
                    const updateDto: UpdateAssetDto = {
                        itemId: val.itemId,
                        deliveryReceipt: deliveryReceiptValue
                    };
                    return this.assetService.update(val.assetId, updateDto, this.deliveryReceiptFiles.length ? this.deliveryReceiptFiles : undefined);
                });

                return updates.length ? forkJoin(updates).pipe(switchMap(() => of(true))) : of(true);
            }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: () => {
                this.saving = false;
                this.removedAssetIds.clear();
                this.deliveryReceiptFiles = [];
                this.cdr.markForCheck();
                this.toastService.success(
                    this.translateService.instant('editBatch.saveSuccess'),
                    this.translateService.instant('toast.success')
                );
                this.loadBatch();
            },
            error: (err) => {
                this.saving = false;
                this.cdr.markForCheck();
                const errorMsg = ErrorHandler.extractErrorMessage(err, this.translateService.instant('editBatch.saveError'));
                this.toastService.error(errorMsg, this.translateService.instant('toast.error'));
            }
        });
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

    openExistingFile(fileId: number): void {
        // Same approach as Edit Inventory modal:
        // use FileUploadService.getFileBlob() so AuthInterceptor attaches JWT,
        // then open blob in a new tab.
        this.fileUploadService.getFileBlob(fileId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (blob: Blob) => {
                    const objectUrl = window.URL.createObjectURL(blob);
                    window.open(objectUrl, '_blank', 'noopener');
                    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
                },
                error: () => {
                    this.toastService.error(
                        this.translateService.instant('common.failedToLoadFile') || 'Failed to open file',
                        this.translateService.instant('toast.error')
                    );
                }
            });
    }

    onCancel(): void {
        this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
            queryParams: { tab: 'batch' },
            queryParamsHandling: 'merge'
        });
    }

    // Use enum names as values to match API (JsonStringEnumConverter returns "ReadyToIssue", etc.)
    readonly assetStatuses = [
        { value: 'ReadyToIssue', label: 'assetStatus.readyToIssue' },
        { value: 'InMaintenance', label: 'assetStatus.inMaintenance' },
        { value: 'UnserviceableRepairable', label: 'assetStatus.unserviceableRepairable' },
        { value: 'UnserviceableUnrepairable', label: 'assetStatus.unserviceableUnrepairable' },
        { value: 'AwaitingDisposal', label: 'assetStatus.awaitingDisposal' },
        { value: 'Disposed', label: 'assetStatus.disposed' }
    ];
}
