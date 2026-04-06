import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Save, Loader2, Trash2 } from 'lucide-angular';

import { BatchService } from '@services/batch.service';
import { EmployeeService } from '@services/employee.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { BatchDto, BulkUpdateBatchAssetsDto, BatchAssetUpdateItem } from '@models/batch.model';
import { AssetDto, EmployeeDto } from '@models/asset.model';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { trackByIndex } from '@utils/trackby.utils';
import { formatDateForInput } from '@utils/format.utils';

export type BatchEditAssignMode = 'none' | 'department' | 'employee';

@Component({
  selector: 'app-edit-batch-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './edit-batch-form.component.html',
  styleUrls: ['./edit-batch-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditBatchFormComponent implements OnDestroy, OnChanges, OnInit {
  @Input({ required: true }) batchId!: number;
  @Input({ required: true }) warehouseId!: number;
  /** When false, hide bottom save/cancel row (e.g. modal supplies footer actions). */
  @Input() showInlineActions = true;
  /** Smaller loading state when embedded in modal. */
  @Input() compactLoading = false;

  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly Save = Save;
  readonly Loader2 = Loader2;
  readonly Trash2 = Trash2;
  readonly trackByIndex = trackByIndex;

  batch: BatchDto | null = null;
  loading = true;
  saving = false;
  error: string | null = null;

  batchForm!: FormGroup;
  get assetForms(): FormArray {
    return this.batchForm?.get('assets') as FormArray;
  }

  departments: LookupItem[] = [];
  employees: EmployeeDto[] = [];
  assignModeDropdownOptions: DropdownOption<BatchEditAssignMode>[] = [];
  readonly departmentOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    this.getLookupName(this.unwrapLookupOption(option));
  readonly employeeOptionLabel = (option: DropdownOption<EmployeeDto> | EmployeeDto | null) =>
    this.getEmployeeLabel(this.unwrapEmployeeOption(option));

  private removedAssetIds = new Set<number>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.refreshAssignModeOptions();
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshAssignModeOptions();
        this.cdr.markForCheck();
      });
  }

  constructor(
    private fb: FormBuilder,
    private batchService: BatchService,
    private employeeService: EmployeeService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.batchId > 0 && this.warehouseId > 0 &&
      (changes['batchId'] || changes['warehouseId'])) {
      this.loadBatch();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Public so parent modal can refresh when opened. */
  loadBatch(): void {
    if (!this.batchId) return;
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    forkJoin({
      batch: this.batchService.getById(this.batchId),
      employees: this.employeeService.getEmployees(),
      departments: this.lookupService.getDepartments()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ batch, employees, departments }) => {
          if (!batch) {
            this.error = 'Failed to load batch';
            this.loading = false;
            this.cdr.markForCheck();
            return;
          }
          this.batch = batch;
          this.removedAssetIds.clear();
          this.employees = (employees || []).filter(e => !e.isDeleted);
          this.departments = (departments || []).filter(d => !d.isDeleted);
          this.buildForms(batch);
          this.refreshAssignModeOptions();
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

  private buildForms(batchDto: BatchDto): void {
    const assets = batchDto.assets ?? [];
    const firstAsset = assets[0];
    const commonPurchaseDate = firstAsset?.purchaseDate ? this.formatDate(firstAsset.purchaseDate) : '';
    const commonWarrantyExpiry = firstAsset?.warrantyExpiryDate ? this.formatDate(firstAsset.warrantyExpiryDate) : '';
    const commonPurchasePrice = firstAsset?.purchasePrice ?? null;

    const groups = assets.map(asset => {
      const mode = this.inferAssignMode(asset);
      return this.fb.group({
        assetId: [asset.id],
        itemId: [asset.itemId, Validators.required],
        serialNumber: [asset.serialNumber || '', Validators.maxLength(500)],
        rfid: [asset.rfid || '', Validators.maxLength(500)],
        status: [asset.status],
        assetTag: [asset.assetTag || '', Validators.maxLength(500)],
        condition: [asset.condition || '', Validators.maxLength(500)],
        notes: [asset.notes || '', Validators.maxLength(5000)],
        assignMode: [mode],
        assignToDepartmentId: [mode === 'department' ? (asset.departmentId ?? null) : null],
        assignToEmployeeId: [mode === 'employee' ? (asset.custodianId ?? null) : null],
        assignmentNotes: ['', Validators.maxLength(2000)]
      });
    });
    this.batchForm = this.fb.group({
      batchNumber: [batchDto.batchNumber?.trim() || '', [Validators.required, Validators.maxLength(500)]],
      commonInfo: this.fb.group({
        purchaseDate: [commonPurchaseDate],
        warrantyExpiryDate: [commonWarrantyExpiry],
        purchasePrice: [commonPurchasePrice, Validators.min(0)]
      }),
      assets: this.fb.array(groups)
    });
  }

  private inferAssignMode(asset: AssetDto): BatchEditAssignMode {
    if (asset.custodianId) return 'employee';
    if (asset.departmentId) return 'department';
    return 'none';
  }

  private refreshAssignModeOptions(): void {
    this.assignModeDropdownOptions = [
      { value: 'none', label: this.translateService.instant('addWeaponAsset.assignment.modeNone') },
      { value: 'department', label: this.translateService.instant('addWeaponAsset.assignment.modeDepartment') },
      { value: 'employee', label: this.translateService.instant('addWeaponAsset.assignment.modeEmployee') }
    ];
  }

  onRowAssignModeChange(index: number): void {
    const g = this.getAssetFormGroup(index);
    const mode = g.get('assignMode')?.value as BatchEditAssignMode;
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

  onRowAssignmentEmployeeChange(): void {
    this.cdr.markForCheck();
  }

  selectedEmployeeCannotAssign(employeeId: number | null | undefined): boolean {
    if (employeeId == null || employeeId <= 0) return false;
    const emp = this.employees.find(e => e.id === employeeId);
    if (!emp) return true;
    const hasDept = (emp.departmentId != null && emp.departmentId > 0)
      || (emp.department?.id != null && emp.department.id > 0);
    return !hasDept;
  }

  getDepotName(depot: { nameEn?: string; nameAr?: string; name?: string }): string {
    return getLocalizedName(depot, getCurrentLang(this.translateService)) || depot.name || '';
  }

  private unwrapLookupOption(option: DropdownOption<LookupItem> | LookupItem | null): LookupItem | null {
    if (!option) return null;
    if (typeof option === 'object' && option !== null && 'value' in option) {
      return (option as DropdownOption<LookupItem>).value as LookupItem;
    }
    return option as LookupItem;
  }

  private unwrapEmployeeOption(option: DropdownOption<EmployeeDto> | EmployeeDto | null): EmployeeDto | null {
    if (!option) return null;
    if (typeof option === 'object' && option !== null && 'value' in option && 'label' in option) {
      return (option as DropdownOption<EmployeeDto>).value as EmployeeDto;
    }
    return option as EmployeeDto;
  }

  private getLookupName(item: LookupItem | null): string {
    if (!item) return '';
    return getLocalizedName(item, getCurrentLang(this.translateService)) || '';
  }

  private getEmployeeLabel(emp: EmployeeDto | null): string {
    if (!emp) return '';
    const lang = getCurrentLang(this.translateService);
    const name = lang === 'ar'
      ? (emp.nameAr || emp.nameEn || String(emp.id))
      : (emp.nameEn || emp.nameAr || String(emp.id));
    const militaryId = emp.militaryId || (emp as { militoryId?: string }).militoryId;
    return militaryId ? `${name} (${militaryId})` : name;
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

  get isBatchNumberInvalid(): boolean {
    const c = this.batchForm?.get('batchNumber');
    return !!(c && c.invalid && (c.dirty || c.touched));
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
    const items: BatchAssetUpdateItem[] = (this.assetForms?.controls ?? []).map(control => {
      const val = control.value;
      const g = control as FormGroup;
      const mode = val.assignMode as BatchEditAssignMode;
      const updateAssignment = !!(
        g.get('assignMode')?.dirty ||
        g.get('assignToDepartmentId')?.dirty ||
        g.get('assignToEmployeeId')?.dirty ||
        g.get('assignmentNotes')?.dirty
      );
      let assignToDepartmentId: number | null = null;
      let assignToEmployeeId: number | null = null;
      if (mode === 'department') {
        assignToDepartmentId = val.assignToDepartmentId ?? null;
      } else if (mode === 'employee') {
        assignToEmployeeId = val.assignToEmployeeId ?? null;
      }
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
        notes: val.notes?.trim() || undefined,
        updateAssignment,
        assignToDepartmentId,
        assignToEmployeeId,
        assignmentNotes: val.assignmentNotes?.trim() || undefined
      };
    });

    const dto: BulkUpdateBatchAssetsDto = { items };
    const removedIds = Array.from(this.removedAssetIds);

    const removeOps = removedIds.length > 0
      ? forkJoin(removedIds.map(assetId => this.batchService.removeAssetFromBatch(this.batchId, assetId)))
      : of([]);

    const trimmedBatchNo = (this.batchForm.get('batchNumber')?.value ?? '').toString().trim();
    const batchNumberChanged = trimmedBatchNo !== (this.batch?.batchNumber ?? '').trim();

    const updateBatch$ = batchNumberChanged
      ? this.batchService.updateBatch(this.batchId, { batchNumber: trimmedBatchNo })
      : of(true);

    updateBatch$.pipe(
      switchMap(() => removeOps),
      switchMap((removeResults) => {
        const failed = Array.isArray(removeResults) && removeResults.some((r: boolean) => r === false);
        if (failed) {
          throw new Error('Failed to remove some assets');
        }
        return this.batchService.bulkUpdateAssets(this.batchId, dto);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.saving = false;
        this.removedAssetIds.clear();
        this.cdr.markForCheck();
        this.toastService.success(
          this.translateService.instant('editBatch.saveSuccess'),
          this.translateService.instant('toast.success')
        );
        this.loadBatch();
        this.saved.emit();
      },
      error: (err) => {
        this.saving = false;
        this.cdr.markForCheck();
        const errorMsg = ErrorHandler.extractErrorMessage(err, this.translateService.instant('editBatch.saveError'));
        this.toastService.error(errorMsg, this.translateService.instant('toast.error'));
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  readonly assetStatuses = [
    { value: 'ReadyToIssue', label: 'assetStatus.readyToIssue' },
    { value: 'InMaintenance', label: 'assetStatus.inMaintenance' },
    { value: 'UnserviceableRepairable', label: 'assetStatus.unserviceableRepairable' },
    { value: 'UnserviceableUnrepairable', label: 'assetStatus.unserviceableUnrepairable' },
    { value: 'AwaitingDisposal', label: 'assetStatus.awaitingDisposal' },
    { value: 'Disposed', label: 'assetStatus.disposed' }
  ];
}
