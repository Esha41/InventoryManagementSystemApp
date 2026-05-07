import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {  ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Save, X, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-angular';

import { EmployeeService } from '@admin/services/employee.service';
import { LookupItem } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';

import { EmployeeDto } from '@models/asset.model';
import { WeaponDto } from '@models/weapon.model';

import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { EmployeeFormModalComponent } from '@admin/components/employee-form-modal/employee-form-modal.component';
import { LoadingStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';

import { ErrorHandler } from '@utils/error-handler.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { trackByIndex } from '@utils/trackby.utils';

import {
  WeaponAssetCatalogLoaderService,
  type WeaponAssetCatalogLoaded
} from './services/weapon-asset-catalog-loader.service';
import { WeaponAssetSubmissionService } from './services/weapon-asset-submission.service';
import { WeaponAssetBulkProgressOverlayComponent } from './components/weapon-asset-bulk-progress-overlay.component';
import { AssetFormRawValue, WeaponAssignMode } from './utils/weapon-asset-assign.types';
import {
  mapAssetFormToCreateDtos,
  buildCreateBulkAssetsFromTemplateDto,
  generateBulkCreateDtos,
  type BulkFormValue
} from './utils/weapon-asset-dto.mapper';
import { buildEmployeeDropdownOptions } from './utils/weapon-employee-options.util';
import {
  createAddWeaponAssetMainForm,
  createBulkWeaponAssetForm,
  createWeaponAssetRowGroup
} from './utils/weapon-asset-form.factory';
import {
  WEAPON_ASSET_MAX_BULK_QUANTITY,
  WEAPON_ASSET_MAX_FILL_IDENTIFIERS_QUANTITY
} from './utils/weapon-asset.constants';
import {
  patchAssignControlsForMode,
  patchDepartmentSelectionOnBulkForm,
  patchDepartmentSelectionOnSingleRow,
  patchEmployeeSelectionOnBulkForm,
  patchEmployeeSelectionOnSingleRow
} from './utils/weapon-asset-assignment.patches';
import {
  fieldErrorFromControl,
  getControlScope,
  isControlInvalid,
  touchControlIfPresent
} from './utils/weapon-asset-form-errors.util';
import { formatFileSizeHuman, mergeUploadedFilesDeduped } from './utils/weapon-asset-files.util';
import {
  departmentOrLookupDropdownLabelFactory,
  weaponDropdownLabel
} from './utils/weapon-asset-dropdown-labels.util';
import { WeaponAssetPrimaryPurposeOptionsCache } from './utils/weapon-asset-primary-purpose-cache';
import { employeeCannotAssignById } from './utils/weapon-asset-employee-assignability.util';

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
    EmployeeFormModalComponent,
    WeaponAssetBulkProgressOverlayComponent
  ],
  templateUrl: './add-weapon-asset.component.html',
  styleUrls: ['./add-weapon-asset.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddWeaponAssetComponent implements OnInit {
  readonly PERMISSIONS = PERMISSIONS;

  private static readonly EMPLOYEE_CREATE_PERMISSION = PERMISSIONS.ADMIN.LOOKUP.EMPLOYEE.CREATE;

  readonly Save = Save;
  readonly X = X;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly trackByIndex = trackByIndex;
  readonly weaponOptionLabel = weaponDropdownLabel;

  assetForm!: FormGroup;

  warehouseId!: number;
  warehouseName = '';
  currentDepot: LookupItem | null = null;
  availableWeapons: WeaponDto[] = [];
  employees: EmployeeDto[] = [];
  departments: LookupItem[] = [];
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];
  allPrimaryPurposes: LookupItem[] = [];
  employeeDropdownOptions: DropdownOption<number>[] = [];
  assignModeDropdownOptions: DropdownOption<WeaponAssignMode>[] = [];
  isEmployeeModalOpen = false;

  loading = true;
  submitting = false;
  errorMessage: string | null = null;
  inputMode: 'single' | 'bulk' = 'single';
  bulkForm!: FormGroup;
  isProcessingBulk = false;
  deliveryReceiptFiles: File[] = [];
  bulkProgressPercent = 0;
  bulkProgressCount = 0;
  bulkProgressTotal = 0;
  bulkProgressElapsedSeconds = 0;
  private bulkProgressInterval?: number;

  private quantityTierSub?: Subscription;
  private readonly purposeOptionsCache = new WeaponAssetPrimaryPurposeOptionsCache();

  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly employeeService = inject(EmployeeService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly translationService = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly authService = inject(BackendAuthService);
  private readonly catalogLoader = inject(WeaponAssetCatalogLoaderService);
  private readonly submission = inject(WeaponAssetSubmissionService);

  /** Bound once — uses current language from translate on each call. */
  readonly departmentOptionLabel = departmentOrLookupDropdownLabelFactory((e) =>
    getLocalizedName(e, getCurrentLang(this.translateService)) || ''
  );
  readonly lookupOptionLabel = departmentOrLookupDropdownLabelFactory((e) =>
    getLocalizedName(e, getCurrentLang(this.translateService)) || ''
  );

  get canCreateEmployee(): boolean {
    return this.authService.hasPermission(AddWeaponAssetComponent.EMPLOYEE_CREATE_PERMISSION);
  }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  readonly maxQuantityForFillIdentifiers = WEAPON_ASSET_MAX_FILL_IDENTIFIERS_QUANTITY;
  readonly maxBulkQuantity = WEAPON_ASSET_MAX_BULK_QUANTITY;

  get assetsFormArray(): FormArray {
    return this.assetForm.get('assets') as FormArray;
  }

  get isBulkFillIdentifiersDisabled(): boolean {
    const qty = this.bulkForm?.get('quantity')?.value;
    return qty != null && qty > this.maxQuantityForFillIdentifiers;
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.quantityTierSub?.unsubscribe());

    this.route.paramMap
      .pipe(
        map((pm) => pm.get('id')),
        filter((id): id is string => !!id?.trim()),
        map((id) => Number.parseInt(id, 10)),
        filter((wid) => !Number.isNaN(wid)),
        distinctUntilChanged(),
        tap((wid) => {
          this.warehouseId = wid;
          this.purposeOptionsCache.clear();
          this.initializeForm();
          this.loading = true;
          this.errorMessage = null;
          this.cdr.markForCheck();
        }),
        switchMap((wid) => this.catalogLoader.loadCatalog(wid)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data: WeaponAssetCatalogLoaded) => {
          this.applyCatalogData(data);
        },
        error: () => {
          this.errorMessage = this.translateService.instant('addWeaponAsset.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });

    this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshAssignModeOptions();
      if (this.currentDepot) {
        this.warehouseName =
          getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) ||
          `${this.translateService.instant('addWeaponAsset.warehouse')} ${this.warehouseId}`;
        this.refreshEmployeeDropdownOptions();
      }
      this.purposeOptionsCache.clear();
      this.cdr.markForCheck();
    });
  }

  private applyCatalogData(data: WeaponAssetCatalogLoaded): void {
    this.currentDepot = data.currentDepot;
    this.warehouseName =
      getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) ||
      `${this.translateService.instant('addWeaponAsset.warehouse')} ${this.warehouseId}`;

    this.availableWeapons = data.availableWeapons;
    this.employees = data.employees;
    this.departments = data.departments;
    this.suppliers = data.suppliers;
    this.manufacturers = data.manufacturers;
    this.allPrimaryPurposes = data.allPrimaryPurposes;

    this.purposeOptionsCache.clear();
    this.refreshEmployeeDropdownOptions();
    this.refreshAssignModeOptions();

    this.loading = false;
    this.cdr.markForCheck();
  }

  private initializeForm(): void {
    this.quantityTierSub?.unsubscribe();

    this.assetForm = createAddWeaponAssetMainForm(this.fb);
    this.bulkForm = createBulkWeaponAssetForm(this.fb);
    this.refreshAssignModeOptions();

    this.quantityTierSub = this.bulkForm.get('quantity')!.valueChanges.subscribe((qty) => {
      const ctrl = this.bulkForm.get('fillIdentifiers')!;
      if (qty != null && qty > this.maxQuantityForFillIdentifiers) {
        ctrl.setValue(false, { emitEvent: false });
        ctrl.disable({ emitEvent: false });
      } else {
        ctrl.enable({ emitEvent: false });
      }
    });
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

  private refreshEmployeeDropdownOptions(): void {
    this.employeeDropdownOptions = buildEmployeeDropdownOptions(
      this.employees,
      getCurrentLang(this.translateService)
    );
  }

  openAddEmployeeModal(): void {
    if (!this.canCreateEmployee) return;
    this.isEmployeeModalOpen = true;
    this.cdr.markForCheck();
  }

  onEmployeeModalClosed(): void {
    this.isEmployeeModalOpen = false;
    this.cdr.markForCheck();
  }

  onEmployeeSaved(): void {
    this.employeeService
      .getEmployees()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.employees = (list || []).filter((e) => !e.isDeleted);
          this.refreshEmployeeDropdownOptions();
          this.cdr.markForCheck();
        },
        error: () => this.cdr.markForCheck()
      });
  }

  onSingleAssignModeChange(index: number): void {
    const g = this.getAssetFormGroup(index);
    patchAssignControlsForMode(g.get('assignMode')?.value as WeaponAssignMode, g);
    this.cdr.markForCheck();
  }

  onSingleAssignmentDepartmentChange(
    index: number,
    value: number | LookupItem | LookupItem[] | null | undefined
  ): void {
    patchDepartmentSelectionOnSingleRow(this.getAssetFormGroup(index), value);
    this.cdr.markForCheck();
  }

  onSingleAssignmentEmployeeChange(
    index: number,
    value: number | DropdownOption<number> | DropdownOption<number>[] | null | undefined
  ): void {
    patchEmployeeSelectionOnSingleRow(this.getAssetFormGroup(index), value);
    this.cdr.markForCheck();
  }

  onBulkAssignmentDepartmentChange(value: number | LookupItem | LookupItem[] | null | undefined): void {
    patchDepartmentSelectionOnBulkForm(this.bulkForm, value);
    this.cdr.markForCheck();
  }

  onBulkAssignmentEmployeeChange(
    value: number | DropdownOption<number> | DropdownOption<number>[] | null | undefined
  ): void {
    patchEmployeeSelectionOnBulkForm(this.bulkForm, value);
    this.cdr.markForCheck();
  }

  onBulkAssignModeChange(): void {
    patchAssignControlsForMode(this.bulkForm.get('assignMode')?.value as WeaponAssignMode, this.bulkForm);
    this.cdr.markForCheck();
  }

  addAsset(): void {
    this.assetsFormArray.push(createWeaponAssetRowGroup(this.fb));
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
    const c = getControlScope(this.assetForm, fieldPath, index, (i) => this.getAssetFormGroup(i));
    return isControlInvalid(c);
  }

  getFieldError(fieldPath: string, index?: number): string | null {
    const c = getControlScope(this.assetForm, fieldPath, index, (i) => this.getAssetFormGroup(i));
    return fieldErrorFromControl(c, this.translateService);
  }

  getBulkFieldError(fieldPath: string): string | null {
    const c = this.bulkForm?.get(fieldPath) ?? null;
    return fieldErrorFromControl(c, this.translateService);
  }

  onFieldChange(fieldPath: string, index?: number): void {
    const c = getControlScope(this.assetForm, fieldPath, index, (i) => this.getAssetFormGroup(i));
    touchControlIfPresent(c);
  }

  getLocalizedName(entity: { nameAr?: string; nameEn?: string } | null | undefined): string {
    return getLocalizedName(entity, getCurrentLang(this.translateService)) || '';
  }

  selectedEmployeeCannotAssign(employeeId: number | null | undefined): boolean {
    return employeeCannotAssignById(employeeId, this.employees);
  }

  getPrimaryPurposeOptionsForRow(index: number): LookupItem[] {
    const itemId = this.getAssetFormGroup(index).get('itemId')?.value as number | null;
    return this.purposeOptionsCache.get(itemId, this.availableWeapons, this.allPrimaryPurposes);
  }

  getPrimaryPurposeOptionsForBulk(): LookupItem[] {
    const itemId = this.bulkForm.get('itemId')?.value as number | null;
    return this.purposeOptionsCache.get(itemId, this.availableWeapons, this.allPrimaryPurposes);
  }

  onWeaponSelected(index: number): void {
    this.purposeOptionsCache.clear();
    this.getAssetFormGroup(index).patchValue({ primaryPurposId: null });
    this.cdr.markForCheck();
  }

  onBulkWeaponSelected(): void {
    this.purposeOptionsCache.clear();
    this.bulkForm.patchValue({ primaryPurposId: null });
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.inputMode === 'single') {
      this.assetForm.markAllAsTouched();
      this.assetsFormArray.controls.forEach((assetGroup) => {
        (assetGroup as FormGroup).markAllAsTouched();
      });

      if (this.assetForm.invalid) {
        this.toastService.error(
          this.translateService.instant('addWeaponAsset.validationError'),
          this.translateService.instant('toast.error')
        );
        return;
      }
      if (this.assetsFormArray.length === 0) return;
    } else {
      this.bulkForm.markAllAsTouched();
      if (this.bulkForm.invalid) {
        this.toastService.error(
          this.translateService.instant('addWeaponAsset.validationError'),
          this.translateService.instant('toast.error')
        );
        return;
      }
      if (this.bulkForm.getRawValue().fillIdentifiers) {
        void this.navigateToBulkEntry();
        return;
      }
    }

    if (this.inputMode === 'single') {
      this.submitSingleMode();
      return;
    }

    this.submitBulkFromTemplate();
  }

  private submitSingleMode(): void {
    const formValue = this.assetForm.getRawValue() as AssetFormRawValue;
    const createDtos = mapAssetFormToCreateDtos(formValue, this.warehouseId);
    if (createDtos.length === 0) return;

    this.submitting = true;
    this.isProcessingBulk = false;
    this.errorMessage = null;
    this.cdr.markForCheck();

    const first = createDtos[0];
    this.submission
      .createWeaponAssetSingle(first, this.deliveryReceiptFiles)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.onSubmitSuccessFinalize(),
        error: (error: unknown) => void this.onSubmitError(error)
      });
  }

  private submitBulkMultipart(): void {
    const createDtos = generateBulkCreateDtos(this.bulkForm.value as BulkFormValue, this.warehouseId);
    if (createDtos.length === 0) return;

    this.submitting = true;
    this.isProcessingBulk = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    this.submission
      .createWeaponAssetsBulkMultipart(createDtos, this.deliveryReceiptFiles)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isProcessingBulk = false;
          void this.onSubmitSuccessFinalize();
        },
        error: (error: unknown) => {
          this.isProcessingBulk = false;
          void this.onSubmitError(error);
        }
      });
  }

  private submitBulkFromTemplate(): void {
    const val = this.bulkForm.getRawValue() as BulkFormValue;
    const dto = buildCreateBulkAssetsFromTemplateDto(val, this.warehouseId);

    this.submitting = true;
    this.isProcessingBulk = true;
    this.errorMessage = null;

    // Initialize progress tracking
    this.bulkProgressTotal = dto.quantity || 0;
    this.bulkProgressCount = 0;
    this.bulkProgressPercent = 0;
    this.bulkProgressElapsedSeconds = 0;

    const startTime = Date.now();

    // Update progress every 200ms (smooth animation)
    this.bulkProgressInterval = window.setInterval(() => {
      this.bulkProgressElapsedSeconds = Math.round((Date.now() - startTime) / 1000);

      // Estimate progress: start fast, slow down as we approach completion
      // For 1M records: expect ~60-90 seconds with SqlBulkCopy
      const estimatedTotalSeconds = Math.max(10, this.bulkProgressTotal / 15_000); // ~15k records/sec
      const estimatedPercent = Math.min(95, (this.bulkProgressElapsedSeconds / estimatedTotalSeconds) * 100);
      this.bulkProgressPercent = Math.round(estimatedPercent);

      this.cdr.markForCheck();
    }, 200);

    this.cdr.markForCheck();

    this.submission
      .createWeaponAssetsBulkFromTemplate(dto, this.deliveryReceiptFiles)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.clearBulkProgress();
          // Show completion
          this.bulkProgressPercent = 100;
          this.cdr.markForCheck();

          // Brief delay to show 100% before closing
          setTimeout(() => {
            this.isProcessingBulk = false;
            void this.onSubmitSuccessFinalize();
          }, 500);
        },
        error: (error: unknown) => {
          this.clearBulkProgress();
          this.isProcessingBulk = false;
          void this.onSubmitError(error);
        }
      });
  }

  private clearBulkProgress(): void {
    if (this.bulkProgressInterval !== undefined) {
      clearInterval(this.bulkProgressInterval);
      this.bulkProgressInterval = undefined;
    }
  }

  private async onSubmitSuccessFinalize(): Promise<void> {
    this.submitting = false;
    this.cdr.markForCheck();
    await this.submission.finalizeSuccessNavigation(this.warehouseId);
  }

  private async onSubmitError(error: unknown): Promise<void> {
    const fallbackMessage = this.translateService.instant('addWeaponAsset.createError');
    const errorMsg = ErrorHandler.extractErrorMessage(error, fallbackMessage);
    this.errorMessage = errorMsg;
    this.submitting = false;
    this.cdr.markForCheck();
    await this.submission.showErrorToast(errorMsg);
  }

  onAttachmentChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newlySelected = input.files ? Array.from(input.files) : [];
    if (newlySelected.length) {
      this.deliveryReceiptFiles = mergeUploadedFilesDeduped(this.deliveryReceiptFiles, newlySelected);
    }
  }

  removeAttachment(index: number): void {
    if (index >= 0 && index < this.deliveryReceiptFiles.length) {
      this.deliveryReceiptFiles.splice(index, 1);
    }
  }

  getFileSize(file: File): string {
    return formatFileSizeHuman(file.size);
  }

  private async navigateToBulkEntry(): Promise<void> {
    await this.submission.goToBulkIdentifierEntry(this.warehouseId, this.bulkForm.value as BulkFormValue);
  }

  get shouldShowNextButton(): boolean {
    return this.inputMode === 'bulk' && !!this.bulkForm.getRawValue().fillIdentifiers;
  }

  onCancel(): void {
    void this.submission.navigateBackToWarehouseInventory(this.warehouseId);
  }

  getMaxDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
