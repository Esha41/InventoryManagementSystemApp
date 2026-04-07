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
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { EmployeeFormModalComponent } from '@components/employee-form-modal/employee-form-modal.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { trackByIndex } from '@utils/trackby.utils';
import { formatDateForInput } from '@utils/format.utils';
import { FileUploadService } from '@services/file-upload.service';

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
    ErrorStateComponent,
    PaginationComponent,
    RowsPerPageComponent,
    EmployeeFormModalComponent
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
  /** True while swapping asset page (keeps header + batch fields visible). */
  pagingAssets = false;
  saving = false;
  error: string | null = null;

  /** Server-side pagination for the assets table (aligned with warehouse batch expand). */
  assetsPage = 1;
  assetsPageSize = 50;
  assetsTotalPages = 1;
  readonly assetsPageSizeOptions = [50, 100, 200, 500];

  batchForm!: FormGroup;
  get assetForms(): FormArray {
    return this.batchForm?.get('assets') as FormArray;
  }

  departments: LookupItem[] = [];
  employees: EmployeeDto[] = [];
  /** Full supplier/manufacturer lists; primary purpose row options prefer item.primaryPurposes when present. */
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];
  primaryPurposesAll: LookupItem[] = [];
  assignModeDropdownOptions: DropdownOption<BatchEditAssignMode>[] = [];
  readonly departmentOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    this.getLookupName(this.unwrapLookupOption(option));
  readonly supplierOrManufacturerOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    this.getLookupName(this.unwrapLookupOption(option));
  readonly employeeOptionLabel = (option: DropdownOption<EmployeeDto> | EmployeeDto | null) =>
    this.getEmployeeLabel(this.unwrapEmployeeOption(option));

  private removedAssetIds = new Set<number>();
  private destroy$ = new Subject<void>();
  deliveryReceiptFiles: File[] = [];
  /** Existing uploaded file ids the user removed in UI; deleted on Save by backend. */
  removedExistingFileIds: number[] = [];
  isEmployeeModalOpen = false;

  get existingFiles() {
    const files = this.batch?.assets?.[0]?.images || [];
    if (!this.removedExistingFileIds.length) return files;
    const removed = new Set(this.removedExistingFileIds);
    return files.filter(f => !removed.has(f.id));
  }

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
    private fileUploadService: FileUploadService,
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

  /** Public so parent can refresh when route reopens. */
  loadBatch(): void {
    if (!this.batchId) return;
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    forkJoin({
      batch: this.batchService.getById(this.batchId, {
        assetsPage: this.assetsPage,
        assetsPageSize: this.assetsPageSize
      }),
      employees: this.employeeService.getEmployees(),
      departments: this.lookupService.getDepartments(),
      suppliers: this.lookupService.getSuppliers(),
      manufacturers: this.lookupService.getManufacturers(),
      primaryPurposes: this.lookupService.getPrimaryPurposes()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ batch, employees, departments, suppliers, manufacturers, primaryPurposes }) => {
          if (!batch) {
            this.error = 'Failed to load batch';
            this.loading = false;
            this.cdr.markForCheck();
            return;
          }
          this.batch = batch;
          this.syncPaginationFromBatch(batch);
          this.removedAssetIds.clear();
          this.removedExistingFileIds = [];
          this.employees = (employees || []).filter(e => !e.isDeleted);
          this.departments = (departments || []).filter(d => !d.isDeleted);
          this.suppliers = (suppliers || []).filter(s => !s.isDeleted);
          this.manufacturers = (manufacturers || []).filter(m => !m.isDeleted);
          this.primaryPurposesAll = (primaryPurposes || []).filter(p => !p.isDeleted);
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

  onEditAssetsPageChange(page: number): void {
    this.assetsPage = page;
    this.reloadAssetPage();
  }

  onEditAssetsPageSizeChange(size: number): void {
    this.assetsPageSize = size;
    this.assetsPage = 1;
    this.reloadAssetPage();
  }

  /** Reloads only the current assets slice; preserves batch number and common purchase fields. */
  private reloadAssetPage(): void {
    if (!this.batchId || !this.batchForm) return;
    this.pagingAssets = true;
    this.cdr.markForCheck();
    this.batchService
      .getById(this.batchId, { assetsPage: this.assetsPage, assetsPageSize: this.assetsPageSize })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (batch) => {
          this.pagingAssets = false;
          if (!batch) {
            this.cdr.markForCheck();
            return;
          }
          this.batch = batch;
          this.syncPaginationFromBatch(batch);
          const totalPages = batch.assetsTotalPages ?? 1;
          if (this.assetsPage > totalPages && totalPages >= 1) {
            this.assetsPage = totalPages;
            this.reloadAssetPage();
            return;
          }
          const emptyPage =
            (batch.assets?.length ?? 0) === 0 && (batch.assetCount ?? 0) > 0 && this.assetsPage > 1;
          if (emptyPage) {
            this.assetsPage--;
            this.reloadAssetPage();
            return;
          }
          this.applyBatchPageResponse(batch);
          this.cdr.markForCheck();
        },
        error: () => {
          this.pagingAssets = false;
          this.cdr.markForCheck();
        }
      });
  }

  private syncPaginationFromBatch(batchDto: BatchDto): void {
    if (batchDto.assetsPageIndex != null) this.assetsPage = batchDto.assetsPageIndex;
    if (batchDto.assetsPageSize != null) this.assetsPageSize = batchDto.assetsPageSize;
    this.assetsTotalPages = batchDto.assetsTotalPages ?? 1;
  }

  private applyBatchPageResponse(batchDto: BatchDto): void {
    const groups = (batchDto.assets ?? []).map(asset => this.createAssetFormGroup(asset));
    this.batchForm.setControl('assets', this.fb.array(groups));
    this.batchForm.patchValue(
      { batchNumber: batchDto.batchNumber?.trim() || '' },
      { emitEvent: false }
    );
  }

  private buildForms(batchDto: BatchDto): void {
    const assets = batchDto.assets ?? [];
    const firstAsset = assets[0];
    const commonPurchaseDate = firstAsset?.purchaseDate ? this.formatDate(firstAsset.purchaseDate) : '';
    const commonWarrantyExpiry = firstAsset?.warrantyExpiryDate ? this.formatDate(firstAsset.warrantyExpiryDate) : '';
    const commonPurchasePrice = firstAsset?.purchasePrice ?? null;
    const commonDeliveryReceipt = firstAsset?.deliveryReceipt ?? '';

    const groups = assets.map(asset => this.createAssetFormGroup(asset));
    this.batchForm = this.fb.group({
      batchNumber: [batchDto.batchNumber?.trim() || '', [Validators.required, Validators.maxLength(500)]],
      commonInfo: this.fb.group({
        purchaseDate: [commonPurchaseDate],
        warrantyExpiryDate: [commonWarrantyExpiry],
        purchasePrice: [commonPurchasePrice, Validators.min(0)],
        deliveryReceipt: [commonDeliveryReceipt, Validators.maxLength(200)]
      }),
      assets: this.fb.array(groups)
    });
  }

  private createAssetFormGroup(asset: AssetDto): FormGroup {
    const mode = this.inferAssignMode(asset);
    return this.fb.group({
      assetId: [asset.id],
      itemId: [asset.itemId, Validators.required],
      serialNumber: [asset.serialNumber || '', Validators.maxLength(500)],
      rfid: [asset.rfid || '', Validators.maxLength(500)],
      supplierId: [asset.supplierId ?? null],
      manufacturerId: [asset.manufacturerId ?? null],
      primaryPurposId: [asset.primaryPurposId ?? null],
      status: [asset.status],
      notes: [asset.notes || '', Validators.maxLength(5000)],
      assignMode: [mode],
      assignToDepartmentId: [mode === 'department' ? (asset.departmentId ?? null) : null],
      assignToEmployeeId: [mode === 'employee' ? (asset.custodianId ?? null) : null],
      assignmentNotes: ['', Validators.maxLength(2000)]
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

  /** Enforce employee OR department: picking one clears the other and sets assign mode. */
  onRowAssignmentDepartmentChange(
    index: number,
    value: number | LookupItem | LookupItem[] | null | undefined
  ): void {
    const departmentId = this.coerceLookupSelectionId(value);
    const g = this.getAssetFormGroup(index);
    if (departmentId != null) {
      g.patchValue(
        { assignMode: 'department' as const, assignToEmployeeId: null },
        { emitEvent: false }
      );
    }
    this.cdr.markForCheck();
  }

  onRowAssignmentEmployeeChange(
    index: number,
    value: number | EmployeeDto | EmployeeDto[] | null | undefined
  ): void {
    const employeeId = this.coerceEmployeeSelectionId(value);
    const g = this.getAssetFormGroup(index);
    if (employeeId != null) {
      g.patchValue(
        { assignMode: 'employee' as const, assignToDepartmentId: null },
        { emitEvent: false }
      );
    }
    this.cdr.markForCheck();
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
    this.employeeService
      .getEmployees()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.employees = (list || []).filter(e => !e.isDeleted);
          this.cdr.markForCheck();
        },
        error: () => {
          this.cdr.markForCheck();
        }
      });
  }

  private coerceLookupSelectionId(
    value: number | LookupItem | LookupItem[] | null | undefined
  ): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return value > 0 ? value : null;
    if (Array.isArray(value)) return null;
    const id = (value as LookupItem).id;
    return id != null && id > 0 ? id : null;
  }

  private coerceEmployeeSelectionId(
    value: number | EmployeeDto | EmployeeDto[] | null | undefined
  ): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return value > 0 ? value : null;
    if (Array.isArray(value)) return null;
    const id = (value as EmployeeDto).id;
    return id != null && id > 0 ? id : null;
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

  /** Prefer catalog-linked purposes for the weapon; otherwise full lookup list (server validates). */
  getPrimaryPurposeOptionsForRow(index: number): LookupItem[] {
    const purposes = this.batch?.assets[index]?.item?.primaryPurposes;
    if (purposes?.length) {
      return purposes.map(p => ({
        id: p.id,
        nameAr: p.nameAr ?? '',
        nameEn: p.nameEn ?? ''
      }));
    }
    return this.primaryPurposesAll;
  }

  isFieldInvalid(index: number, fieldName: string): boolean {
    const control = this.getAssetFormGroup(index).get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  get isBatchNumberInvalid(): boolean {
    const c = this.batchForm?.get('batchNumber');
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /** Hide the whole Assignment notes column when every row is "No assignment". */
  get showAssignmentNotesColumn(): boolean {
    const fa = this.assetForms;
    if (!fa?.length) return false;
    return fa.controls.some(
      c => (c as FormGroup).get('assignMode')?.value !== 'none'
    );
  }

  /** 1-based row label in the full batch (not just the current page). */
  assetRowDisplayIndex(i: number): number {
    return (this.assetsPage - 1) * this.assetsPageSize + i + 1;
  }

  get showSaveToolbar(): boolean {
    return !!this.batch && !!this.batchForm && !this.loading;
  }

  removeRow(index: number): void {
    const totalInBatch = this.batch?.assetCount ?? 0;
    if (totalInBatch <= 1) return;
    const assetId = this.getAssetFormGroup(index).get('assetId')?.value;
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
        supplierId: val.supplierId ?? null,
        manufacturerId: val.manufacturerId ?? null,
        primaryPurposId: val.primaryPurposId ?? null,
        status: val.status,
        purchaseDate: common.purchaseDate || undefined,
        warrantyExpiryDate: common.warrantyExpiryDate || undefined,
        purchasePrice: common.purchasePrice,
        deliveryReceipt: String(common.deliveryReceipt ?? '').trim() || undefined,
        notes: val.notes?.trim() || undefined,
        updateAssignment,
        assignToDepartmentId,
        assignToEmployeeId,
        assignmentNotes: val.assignmentNotes?.trim() || undefined
      };
    });

    const dto: BulkUpdateBatchAssetsDto = {
      items,
      removedFileIds: this.removedExistingFileIds.length ? this.removedExistingFileIds : undefined
    };
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
        return this.batchService.bulkUpdateAssets(this.batchId, dto, this.deliveryReceiptFiles);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.saving = false;
        this.removedAssetIds.clear();
        this.deliveryReceiptFiles = [];
        this.removedExistingFileIds = [];
        this.cdr.markForCheck();
        this.toastService.success(
          this.translateService.instant('editBatch.saveSuccess'),
          this.translateService.instant('toast.success')
        );
        this.reloadAssetPage();
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
    this.cancelled.emit();
  }

  removeExistingFile(fileId: number): void {
    if (!fileId) return;
    if (!this.removedExistingFileIds.includes(fileId)) {
      this.removedExistingFileIds = [...this.removedExistingFileIds, fileId];
    }
    this.cdr.markForCheck();
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
