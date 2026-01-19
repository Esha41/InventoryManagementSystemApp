import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, Save, X, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-angular';

// Services
import { AssetService } from '@services/asset.service';
import { WeaponService } from '@services/weapon.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';

// Models
import { CreateAssetDto } from '@models/asset.model';
import { WeaponDto } from '@models/weapon.model';

// Components
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';

// Utils
import { ErrorHandler } from '@utils/error-handler.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
    selector: 'app-add-weapon-asset',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule,
        TranslateModule,
        LucideAngularModule,
        DropdownComponent,
        LoadingStateComponent,
        ErrorStateComponent,
        HasPermissionDirective
    ],
    templateUrl: './add-weapon-asset.component.html',
    styleUrls: ['./add-weapon-asset.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddWeaponAssetComponent implements OnInit, OnDestroy {
    // Icons
    readonly Save = Save;
    readonly X = X;
    readonly Plus = Plus;
    readonly Trash2 = Trash2;
    readonly ArrowLeft = ArrowLeft;
    readonly ArrowRight = ArrowRight;

    // Form
    assetForm!: FormGroup;

    // Data
    warehouseId!: number;
    warehouseName: string = '';
    availableWeapons: WeaponDto[] = [];

    // State
    loading = true;
    submitting = false;
    errorMessage: string | null = null;
    inputMode: 'single' | 'bulk' = 'single';
    bulkForm!: FormGroup;
    bulkProgress = { current: 0, total: 0 };
    isProcessingBulk = false;

    private destroy$ = new Subject<void>();

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private route: ActivatedRoute,
        private assetService: AssetService,
        private weaponService: WeaponService,
        private lookupService: LookupService,
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

    get assetsFormArray(): FormArray {
        return this.assetForm.get('assets') as FormArray;
    }

    ngOnInit(): void {
        // Get warehouse ID from route
        this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
            const id = params['id'];
            if (id) {
                this.warehouseId = parseInt(id, 10);
                this.initializeForm();
                this.loadData();
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initializeForm(): void {
        this.assetForm = this.fb.group({
            assets: this.fb.array([this.createAssetFormGroup()])
        });

        this.bulkForm = this.fb.group({
            itemId: [null, Validators.required],
            quantity: [1, [Validators.required, Validators.min(1), Validators.max(1000)]],
            fillIdentifiers: [false], // Checkbox for filling RFID/Serial numbers
            // Common
            purchaseDate: [''],
            warrantyExpiryDate: [''],
            condition: ['', [Validators.maxLength(100)]],
            purchasePrice: [null, [Validators.min(0)]],
            notes: ['', [Validators.maxLength(1000)]]
        });
    }



    toggleMode(mode: 'single' | 'bulk'): void {
        this.inputMode = mode;
        this.errorMessage = null;
    }

    private createAssetFormGroup(): FormGroup {
        return this.fb.group({
            itemId: [null, Validators.required],
            serialNumber: ['', [Validators.maxLength(200)]],
            rfid: ['', [Validators.maxLength(500)]],
            assetTag: ['', [Validators.maxLength(100)]],
            purchaseDate: [''],
            warrantyExpiryDate: [''],
            condition: ['', [Validators.maxLength(100)]],
            purchasePrice: [null, [Validators.min(0)]],
            notes: ['', [Validators.maxLength(1000)]]
        });
    }

    private loadData(): void {
        this.loading = true;
        this.cdr.markForCheck();

        forkJoin({
            depot: this.lookupService.getDepots(),
            weapons: this.weaponService.getAll<WeaponDto>()
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ({ depot, weapons }) => {
                    const currentDepot = depot.find(d => d.id === this.warehouseId);
                    this.warehouseName = getLocalizedName(currentDepot, getCurrentLang(this.translateService)) ||
                        `${this.translateService.instant('addWeaponAsset.warehouse')} ${this.warehouseId}`;

                    this.availableWeapons = weapons;

                    this.loading = false;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.errorMessage = this.translateService.instant('addWeaponAsset.loadError');
                    this.loading = false;
                    this.cdr.markForCheck();
                }
            });
    }

    addAsset(): void {
        this.assetsFormArray.push(this.createAssetFormGroup());
        this.cdr.markForCheck();
    }

    removeAsset(index: number): void {
        if (this.assetsFormArray.length > 1) {
            this.assetsFormArray.removeAt(index);
            this.cdr.markForCheck();
        }
    }

    getAssetFormGroup(index: number): FormGroup {
        return this.assetsFormArray.at(index) as FormGroup;
    }

    isFieldInvalid(fieldPath: string, index?: number): boolean {
        let control;

        if (index !== undefined) {
            const group = this.getAssetFormGroup(index);
            control = group.get(fieldPath);
        } else {
            control = this.assetForm.get(fieldPath);
        }

        return !!(control && control.invalid && (control.dirty || control.touched));
    }

    getFieldError(fieldPath: string, index?: number): string | null {
        let control;

        if (index !== undefined) {
            const group = this.getAssetFormGroup(index);
            control = group.get(fieldPath);
        } else {
            control = this.assetForm.get(fieldPath);
        }

        if (!control || !control.errors) return null;

        if (control.errors['required']) {
            return this.translateService.instant('addWeaponAsset.required');
        }
        if (control.errors['maxlength']) {
            return this.translateService.instant('addWeaponAsset.maxLength', {
                max: control.errors['maxlength'].requiredLength
            });
        }
        if (control.errors['min']) {
            return this.translateService.instant('addWeaponAsset.minValue', {
                min: control.errors['min'].min
            });
        }

        return null;
    }

    onFieldChange(fieldPath: string, index?: number): void {
        let control;

        if (index !== undefined) {
            const group = this.getAssetFormGroup(index);
            control = group.get(fieldPath);
        } else {
            control = this.assetForm.get(fieldPath);
        }

        if (control) {
            control.markAsTouched();
            control.updateValueAndValidity();
        }
    }

    getLocalizedName(entity: { nameAr?: string; nameEn?: string } | null | undefined): string {
        return getLocalizedName(entity, getCurrentLang(this.translateService)) || '';
    }

    readonly weaponOptionLabel = (option: DropdownOption<WeaponDto> | WeaponDto | null) => {
        if (!option) return '';
        const weapon = 'value' in option ? option.value : option;
        const name = weapon?.name || '';
        const itemNo = weapon?.itemNo || '';
        return itemNo ? `${name} (${itemNo})` : name;
    };

    onSubmit(): void {
        // Validate based on current mode
        if (this.inputMode === 'single') {
            // Mark all fields as touched for single mode
            this.assetForm.markAllAsTouched();
            this.assetsFormArray.controls.forEach(assetGroup => {
                (assetGroup as FormGroup).markAllAsTouched();
            });

            // Validate form
            if (this.assetForm.invalid) {
                const title = this.translateService.instant('toast.error');
                const message = this.translateService.instant('addWeaponAsset.validationError');
                this.toastService.error(message, title);
                return;
            }

            // Check if at least one asset exists
            if (this.assetsFormArray.length === 0) return;
        } else {
            // Mark all fields as touched for bulk mode
            this.bulkForm.markAllAsTouched();

            // Validate bulk form
            if (this.bulkForm.invalid) {
                const title = this.translateService.instant('toast.error');
                const message = this.translateService.instant('addWeaponAsset.validationError');
                this.toastService.error(message, title);
                return;
            }

            // If fillIdentifiers is checked, navigate to the bulk entry page
            if (this.bulkForm.value.fillIdentifiers) {
                this.navigateToBulkEntry();
                return;
            }
        }

        let createDtos: CreateAssetDto[] = [];
        if (this.inputMode === 'single') {
            const formValue = this.assetForm.value;
            createDtos = formValue.assets.map((asset: any) => ({
                itemId: asset.itemId,
                depotId: this.warehouseId,
                serialNumber: asset.serialNumber?.trim() || undefined,
                rfid: asset.rfid?.trim() || undefined,
                assetTag: asset.assetTag?.trim() || undefined,
                purchaseDate: asset.purchaseDate || undefined,
                warrantyExpiryDate: asset.warrantyExpiryDate || undefined,
                condition: asset.condition?.trim() || undefined,
                purchasePrice: asset.purchasePrice || undefined,
                notes: asset.notes?.trim() || undefined
            }));
        } else {
            createDtos = this.generateBulkDtos();
        }

        if (createDtos.length === 0) return;


        this.submitting = true;
        this.isProcessingBulk = this.inputMode === 'bulk';
        this.bulkProgress = { current: 0, total: createDtos.length };
        this.errorMessage = null;
        this.cdr.markForCheck();

        // Create assets in bulk
        this.assetService.createBulk(createDtos)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.submitting = false;
                    this.isProcessingBulk = false;
                    this.bulkProgress = { current: createDtos.length, total: createDtos.length };
                    this.cdr.markForCheck();

                    this.translateService.get(['toast.success', 'addWeaponAsset.successMessage']).subscribe(translations => {
                        const message = translations['addWeaponAsset.successMessage'] || 'Weapon assets created successfully!';
                        const title = translations['toast.success'];
                        this.toastService.success(message, title);
                    });

                    // Redirect after a short delay
                    setTimeout(() => {
                        this.router.navigate(['/warehouse', this.warehouseId, 'inventory']);
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

    private navigateToBulkEntry(): void {
        const bulkData = this.bulkForm.value;
        // Store bulk data in sessionStorage to pass to next page
        sessionStorage.setItem('bulkAssetData', JSON.stringify({
            warehouseId: this.warehouseId,
            itemId: bulkData.itemId,
            quantity: bulkData.quantity,
            purchaseDate: bulkData.purchaseDate,
            warrantyExpiryDate: bulkData.warrantyExpiryDate,
            condition: bulkData.condition,
            purchasePrice: bulkData.purchasePrice,
            notes: bulkData.notes
        }));

        this.router.navigate(['/warehouse', this.warehouseId, 'assets', 'add', 'bulk-entry']);
    }

    get shouldShowNextButton(): boolean {
        return this.inputMode === 'bulk' && this.bulkForm.get('fillIdentifiers')?.value === true;
    }

    private generateBulkDtos(): CreateAssetDto[] {
        const val = this.bulkForm.value;
        const dtos: CreateAssetDto[] = [];
        const quantity = val.quantity || 0;

        for (let i = 0; i < quantity; i++) {
            dtos.push({
                itemId: val.itemId,
                depotId: this.warehouseId,
                serialNumber: undefined,
                rfid: undefined,
                purchaseDate: val.purchaseDate || undefined,
                warrantyExpiryDate: val.warrantyExpiryDate || undefined,
                condition: val.condition?.trim() || undefined,
                purchasePrice: val.purchasePrice || undefined,
                notes: val.notes?.trim() || undefined
            });
        }
        return dtos;
    }

    onCancel(): void {
        this.router.navigate(['/warehouse', this.warehouseId, 'inventory']);
    }

    getMaxDate(): string {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }
}
