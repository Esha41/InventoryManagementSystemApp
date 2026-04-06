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
import { EmployeeService } from '@services/employee.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';

// Models
import { CreateAssetDto, EmployeeDto } from '@models/asset.model';
import { WeaponDto } from '@models/weapon.model';

// Components
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { EmployeeFormModalComponent } from '@components/employee-form-modal/employee-form-modal.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';

// Utils
import { ErrorHandler } from '@utils/error-handler.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { trackByIndex } from '@utils/trackby.utils';

export type WeaponAssignMode = 'none' | 'department' | 'employee';

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
        HasPermissionDirective,
        EmployeeFormModalComponent
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
    readonly trackByIndex = trackByIndex;

    // Form
    assetForm!: FormGroup;

    // Data
    warehouseId!: number;
    warehouseName: string = '';
    currentDepot: LookupItem | null = null;
    availableWeapons: WeaponDto[] = [];
    employees: EmployeeDto[] = [];
    departments: LookupItem[] = [];
    employeeDropdownOptions: DropdownOption<number>[] = [];
    /** Assign-type choices: no assignment / department / employee (labels follow current language). */
    assignModeDropdownOptions: DropdownOption<WeaponAssignMode>[] = [];
    isEmployeeModalOpen = false;

    // State
    loading = true;
    submitting = false;
    errorMessage: string | null = null;
    inputMode: 'single' | 'bulk' = 'single';
    bulkForm!: FormGroup;
    bulkProgress = { current: 0, total: 0 };
    isProcessingBulk = false;
    deliveryReceiptFiles: File[] = [];

    private destroy$ = new Subject<void>();

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private route: ActivatedRoute,
        private assetService: AssetService,
        private weaponService: WeaponService,
        private employeeService: EmployeeService,
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
            this.cdr.markForCheck();
        });

        // Subscribe to language changes to update warehouse name (same as add-inventory)
        this.translateService.onLangChange
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.refreshAssignModeOptions();
                if (this.currentDepot) {
                    this.warehouseName = getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) ||
                        `${this.translateService.instant('addWeaponAsset.warehouse')} ${this.warehouseId}`;
                    this.refreshEmployeeDropdownOptions();
                }
                this.cdr.markForCheck();
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initializeForm(): void {
        this.assetForm = this.fb.group({
            deliveryReceipt: [''],
            assets: this.fb.array([this.createAssetFormGroup()])
        });

        this.bulkForm = this.fb.group({
            itemId: [null, Validators.required],
            batchNumber: ['', [Validators.required, Validators.maxLength(500)]],
            quantity: [null as number | null, [Validators.required, Validators.min(1), Validators.max(5000)]],
            fillIdentifiers: [false], // Checkbox for filling RFID/Serial numbers
            // Common
            purchaseDate: [''],
            warrantyExpiryDate: [''],
            condition: ['', [Validators.maxLength(100)]],
            purchasePrice: [null, [Validators.min(0)]],
            notes: ['', [Validators.maxLength(1000)]],
            assignMode: ['none' as WeaponAssignMode],
            assignToEmployeeId: [null as number | null],
            assignToDepartmentId: [null as number | null],
            assignmentNotes: ['', [Validators.maxLength(2000)]],
            deliveryReceipt: ['', [Validators.maxLength(200)]]
        });
        this.refreshAssignModeOptions();
    }

    private refreshAssignModeOptions(): void {
        this.assignModeDropdownOptions = [
            { value: 'none', label: this.translateService.instant('addWeaponAsset.assignment.modeNone') },
            { value: 'department', label: this.translateService.instant('addWeaponAsset.assignment.modeDepartment') },
            { value: 'employee', label: this.translateService.instant('addWeaponAsset.assignment.modeEmployee') }
        ];
    }

    toggleMode(mode: 'single' | 'bulk'): void {
        this.inputMode = mode;
        this.errorMessage = null;
    }

    private createAssetFormGroup(): FormGroup {
        return this.fb.group({
            itemId: [null, Validators.required],
            batchNumber: ['', [Validators.required, Validators.maxLength(500)]],
            serialNumber: ['', [Validators.maxLength(200)]],
            rfid: ['', [Validators.maxLength(500)]],
            assetTag: ['', [Validators.maxLength(100)]],
            purchaseDate: [''],
            warrantyExpiryDate: [''],
            condition: ['', [Validators.maxLength(100)]],
            purchasePrice: [null, [Validators.min(0)]],
            notes: ['', [Validators.maxLength(1000)]],
            assignMode: ['none' as WeaponAssignMode],
            assignToEmployeeId: [null as number | null],
            assignToDepartmentId: [null as number | null],
            assignmentNotes: ['', [Validators.maxLength(2000)]]
        });
    }

    readonly departmentOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null): string => {
        if (!option) return '';
        const dep =
            typeof option === 'object' && option !== null && 'value' in option && (option as DropdownOption<LookupItem>).value != null
                ? (option as DropdownOption<LookupItem>).value!
                : (option as LookupItem);
        return this.getLocalizedName(dep);
    };

    private loadData(): void {
        this.loading = true;
        this.cdr.markForCheck();

        forkJoin({
            depot: this.lookupService.getDepots(),
            weapons: this.weaponService.getAll<WeaponDto>(),
            employees: this.employeeService.getEmployees(),
            departments: this.lookupService.getDepartments()
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ({ depot, weapons, employees, departments }) => {
                    this.currentDepot = depot.find(d => d.id === this.warehouseId) || null;
                    this.warehouseName = getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) ||
                        `${this.translateService.instant('addWeaponAsset.warehouse')} ${this.warehouseId}`;

                    this.availableWeapons = weapons;
                    this.employees = (employees || []).filter(e => !e.isDeleted);
                    this.departments = (departments || []).filter(d => !d.isDeleted);
                    this.refreshEmployeeDropdownOptions();
                    this.refreshAssignModeOptions();

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

    private refreshEmployeeDropdownOptions(): void {
        const currentLang = getCurrentLang(this.translateService);
        this.employeeDropdownOptions = this.employees.map(emp => {
            const name = currentLang === 'ar'
                ? (emp.nameAr || emp.nameEn || String(emp.id))
                : (emp.nameEn || emp.nameAr || String(emp.id));
            const militaryId = emp.militaryId || (emp as { militoryId?: string }).militoryId;
            const label = militaryId ? `${name} (${militaryId})` : name;
            return { value: emp.id, label, description: militaryId ? '' : (emp.email || '') };
        }).sort((a, b) => a.label.localeCompare(b.label));
    }

    openAddEmployeeModal(): void {
        this.isEmployeeModalOpen = true;
        this.cdr.markForCheck();
    }

    onEmployeeModalClosed(): void {
        this.isEmployeeModalOpen = false;
        this.cdr.markForCheck();
    }

    onEmployeeSaved(): void {
        this.employeeService.getEmployees()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (list) => {
                    this.employees = (list || []).filter(e => !e.isDeleted);
                    this.refreshEmployeeDropdownOptions();
                    this.onAssignmentEmployeeChange();
                },
                error: () => {
                    this.cdr.markForCheck();
                }
            });
    }

    onSingleAssignModeChange(index: number): void {
        const g = this.getAssetFormGroup(index);
        const mode = g.get('assignMode')?.value as WeaponAssignMode;
        if (mode === 'none') {
            g.patchValue({
                assignToEmployeeId: null,
                assignToDepartmentId: null,
                assignmentNotes: ''
            });
        } else if (mode === 'department') {
            g.patchValue({ assignToEmployeeId: null });
        } else if (mode === 'employee') {
            g.patchValue({ assignToDepartmentId: null });
        }
        this.cdr.markForCheck();
    }

    /** For OnPush: refresh hints under employee assignment when selection changes. */
    onAssignmentEmployeeChange(): void {
        this.cdr.markForCheck();
    }

    onBulkAssignModeChange(): void {
        const mode = this.bulkForm.get('assignMode')?.value as WeaponAssignMode;
        if (mode === 'none') {
            this.bulkForm.patchValue({
                assignToEmployeeId: null,
                assignToDepartmentId: null,
                assignmentNotes: ''
            });
        } else if (mode === 'department') {
            this.bulkForm.patchValue({ assignToEmployeeId: null });
        } else if (mode === 'employee') {
            this.bulkForm.patchValue({ assignToDepartmentId: null });
        }
        this.cdr.markForCheck();
    }

    private buildAssignmentFields(
        mode: WeaponAssignMode,
        assignToEmployeeId: number | null | undefined,
        assignToDepartmentId: number | null | undefined,
        assignmentNotes: string | null | undefined
    ): Pick<CreateAssetDto, 'assignToEmployeeId' | 'assignToDepartmentId' | 'assignmentNotes'> {
        const notes = assignmentNotes?.trim();
        if (mode === 'none') {
            return {};
        }
        if (mode === 'employee') {
            if (assignToEmployeeId == null || assignToEmployeeId <= 0) {
                return {};
            }
            return {
                assignToEmployeeId,
                ...(notes ? { assignmentNotes: notes } : {})
            };
        }
        if (mode === 'department') {
            if (assignToDepartmentId == null || assignToDepartmentId <= 0) {
                return {};
            }
            return {
                assignToDepartmentId,
                ...(notes ? { assignmentNotes: notes } : {})
            };
        }
        return {};
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

    /** Department shown for intake when user assigns to an employee (always the employee's own department). */
    /** Backend requires assignable employee records; surface a simple message without emphasizing “department”. */
    selectedEmployeeCannotAssign(employeeId: number | null | undefined): boolean {
        if (employeeId == null || employeeId <= 0) return false;
        const emp = this.employees.find(e => e.id === employeeId);
        if (!emp) return true;
        const hasDept = (emp.departmentId != null && emp.departmentId > 0)
            || (emp.department?.id != null && emp.department.id > 0);
        return !hasDept;
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
                batchNumber: asset.batchNumber?.trim(),
                depotId: this.warehouseId,
                serialNumber: asset.serialNumber?.trim() || undefined,
                rfid: asset.rfid?.trim() || undefined,
                assetTag: asset.assetTag?.trim() || undefined,
                purchaseDate: asset.purchaseDate || undefined,
                warrantyExpiryDate: asset.warrantyExpiryDate || undefined,
                condition: asset.condition?.trim() || undefined,
                purchasePrice: asset.purchasePrice || undefined,
                deliveryReceipt: (formValue.deliveryReceipt?.trim && formValue.deliveryReceipt.trim()) || undefined,
                notes: asset.notes?.trim() || undefined,
                ...this.buildAssignmentFields(
                    asset.assignMode ?? 'none',
                    asset.assignToEmployeeId,
                    asset.assignToDepartmentId,
                    asset.assignmentNotes
                )
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

        // Submit
        if (this.inputMode === 'single') {
            const first = createDtos[0];
            this.assetService.create(first, this.deliveryReceiptFiles)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: () => {
                        this.submitting = false;
                        this.isProcessingBulk = false;
                        this.cdr.markForCheck();

                        this.translateService.get(['toast.success', 'addWeaponAsset.successMessage']).subscribe(translations => {
                            const message = translations['addWeaponAsset.successMessage'] || 'Weapon assets created successfully!';
                            const title = translations['toast.success'];
                            this.toastService.success(message, title);
                        });

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
            return;
        }

        // Bulk mode: always call Bulk (multipart) with files (possibly empty)
        const bulk$ = this.assetService.createBulk(createDtos, this.deliveryReceiptFiles);

        bulk$
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (ids: number[]) => {
                    this.submitting = false;
                    this.isProcessingBulk = false;
                    this.bulkProgress = { current: createDtos.length, total: createDtos.length };
                    this.cdr.markForCheck();

                    this.translateService.get(['toast.success', 'addWeaponAsset.successMessage']).subscribe(translations => {
                        const message = translations['addWeaponAsset.successMessage'] || 'Weapon assets created successfully!';
                        const title = translations['toast.success'];
                        this.toastService.success(message, title);
                    });
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

    onAttachmentChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const newlySelected = input.files ? Array.from(input.files) : [];
        if (newlySelected.length) {
            const existing = this.deliveryReceiptFiles;
            const combined = [...existing, ...newlySelected];
            // Deduplicate by name+size+lastModified
            const seen = new Set<string>();
            this.deliveryReceiptFiles = combined.filter(f => {
                const key = `${f.name}::${f.size}::${(f as any).lastModified ?? 0}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
        // Do not clear on purpose here; allow multiple picks to append
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

    private navigateToBulkEntry(): void {
        const bulkData = this.bulkForm.value;
        // Store bulk data in sessionStorage to pass to next page
        sessionStorage.setItem('bulkAssetData', JSON.stringify({
            warehouseId: this.warehouseId,
            itemId: bulkData.itemId,
            batchNumber: bulkData.batchNumber,
            quantity: bulkData.quantity,
            purchaseDate: bulkData.purchaseDate,
            warrantyExpiryDate: bulkData.warrantyExpiryDate,
            condition: bulkData.condition,
            purchasePrice: bulkData.purchasePrice,
            notes: bulkData.notes,
            assignMode: bulkData.assignMode ?? 'none',
            assignToEmployeeId: bulkData.assignToEmployeeId ?? undefined,
            assignToDepartmentId: bulkData.assignToDepartmentId ?? undefined,
            assignmentNotes: bulkData.assignmentNotes ?? undefined,
            deliveryReceipt: bulkData.deliveryReceipt
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
        const assignment = this.buildAssignmentFields(
            val.assignMode ?? 'none',
            val.assignToEmployeeId,
            val.assignToDepartmentId,
            val.assignmentNotes
        );

        for (let i = 0; i < quantity; i++) {
            dtos.push({
                itemId: val.itemId,
                batchNumber: val.batchNumber?.trim(),
                depotId: this.warehouseId,
                serialNumber: undefined,
                rfid: undefined,
                purchaseDate: val.purchaseDate || undefined,
                warrantyExpiryDate: val.warrantyExpiryDate || undefined,
                condition: val.condition?.trim() || undefined,
                purchasePrice: val.purchasePrice || undefined,
                deliveryReceipt: val.deliveryReceipt?.trim() || undefined,
                notes: val.notes?.trim() || undefined,
                ...assignment
            });
        }
        return dtos;
    }

    onCancel(): void {
        this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
            queryParams: { tab: 'weapon' },
            queryParamsHandling: 'merge'
        });
    }

    getMaxDate(): string {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }
}
