import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardComponent } from '@components/card/card.component';
import {
  LucideAngularModule,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  ChevronRight,
  ChevronDown
} from 'lucide-angular';
import {
  AttachmentRequirementLookupDraft,
  LookupItem,
  LookupTableConfig,
  CreateUpdateLookupDto,
  RequestPurposeAllowanceContext
} from '@models/lookup.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { LookupManagementService } from '@admin/services/lookup-management.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { LookupFiltersComponent } from '../lookup-filters/lookup-filters.component';
import { LookupFormModalComponent } from '@admin/components/lookup-form-modal/lookup-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { PaginationComponent, RowsPerPageComponent } from '@components/index';
import { EmployeeFormModalComponent } from '@admin/components/employee-form-modal/employee-form-modal.component';
import { ImportDialogComponent } from '@components/import-dialog/import-dialog.component';
import { ImportPreviewDialogComponent, PreviewData } from '@components/import-preview-dialog/import-preview-dialog.component';
import { EmployeeDto } from '@core/models/asset.model';
import { EmployeeService } from '@admin/services/employee.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { ImportExportService } from '@admin/services/import-export.service';
import { mapImportResultToPreviewData } from '@core/utils/asset-master-import-preview.utils';
import { defaultPageSize } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { ImportResult } from '@models/import-result.model';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';

/**
 * Lookup Management Component
 * Handles lookup management functionality
 */
@Component({
  selector: 'app-lookup-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    LucideAngularModule,
    TranslateModule,
    LoadingStateComponent,
    ErrorStateComponent,
    LookupFiltersComponent,
    LookupFormModalComponent,
    ConfirmDialogComponent,
    ModalComponent,
    ButtonComponent,
    ReactiveFormsModule,
    PaginationComponent,
    RowsPerPageComponent,
    EmployeeFormModalComponent,
    ImportDialogComponent,
    ImportPreviewDialogComponent
  ],
  templateUrl: './lookup-management.component.html',
  styleUrls: ['./lookup-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LookupManagementComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Download = Download;
  readonly Upload = Upload;
  readonly ChevronRight = ChevronRight;
  readonly ChevronDown = ChevronDown;

  lookupTables: LookupTableConfig[] = [];
  selectedTable?: LookupTableConfig;
  lookupItems: LookupItem[] = [];
  lookupSearchTerm = '';
  isLoadingLookups = false;
  lookupErrorMessage = '';

  // Pagination
  currentPage = 1;
  rowsPerPage = defaultPageSize;

  // Lookup modal states
  showLookupModal = false;
  showLookupDeleteConfirm = false;
  lookupModalMode: 'create' | 'edit' = 'create';
  selectedLookupItem?: LookupItem;
  lookupModalLoading = false;

  // Employee modal state (for Employee lookup table)
  showEmployeeModal = false;
  employeeModalMode: 'create' | 'edit' = 'create';
  selectedEmployee?: EmployeeDto | null;

  // Employee import/export state
  showImportModal = false;
  showPreviewModal = false;
  previewData: PreviewData | null = null;
  pendingImportFile: File | null = null;
  isImportInProgress = false;

  private destroy$ = new Subject<void>();

  /** Request purpose rows that show the nested attachments table */
  expandedPurposeIds: number[] = [];
  purposeAttachmentBusyId: number | null = null;

  /** Inline attachment slot modal (nested table CRUD) */
  showAttachmentSlotModal = false;
  attachmentSlotModalPurpose: LookupItem | null = null;
  attachmentSlotModalEditingId: number | null = null;
  readonly attachmentSlotForm = inject(FormBuilder).nonNullable.group({
    nameEn: ['', [Validators.required, Validators.maxLength(500)]],
    nameAr: ['', [Validators.required, Validators.maxLength(500)]],
    isRequired: [false],
    minCount: [1, [Validators.min(0)]],
    maxCount: [1, [Validators.min(1)]]
  });
  showAttachmentSlotDeleteConfirm = false;
  pendingAttachmentDeletePurpose: LookupItem | null = null;
  pendingAttachmentDelete: AttachmentRequirementLookupDraft | null = null;

  constructor(
    private lookupManagementService: LookupManagementService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef,
    private employeeService: EmployeeService,
    private authService: BackendAuthService,
    private importExportService: ImportExportService
  ) { }

  ngOnInit(): void {
    const allTables = this.lookupManagementService.getLookupTables();
    this.lookupTables = allTables.filter(table =>
      this.authService.hasPermission(table.pagePermission)
    );
    if (this.lookupTables.length > 0 && !this.selectedTable) {
      this.selectedTable = this.lookupTables[0];
      this.loadLookupItems();
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTableSelect(table: LookupTableConfig | undefined): void {
    this.selectedTable = table;
    this.currentPage = 1;
    this.expandedPurposeIds = [];
    if (table) {
      this.loadLookupItems();
    }
    this.cdr.markForCheck();
  }

  loadLookupItems(): void {
    if (!this.selectedTable) return;

    this.isLoadingLookups = true;
    this.lookupErrorMessage = '';
    this.lookupManagementService.loadLookupItems(this.selectedTable)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.lookupItems = items;
          this.isLoadingLookups = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.isLoadingLookups = false;
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load lookup items');
          this.lookupErrorMessage = errorMessage;
          this.cdr.markForCheck();
        }
      });
  }

  get filteredLookupItems(): LookupItem[] {
    return this.lookupManagementService.filterLookupItems(this.lookupItems, this.lookupSearchTerm);
  }

  get totalPages(): number {
    const total = this.filteredLookupItems.length;
    if (total === 0) return 1;
    return Math.ceil(total / this.rowsPerPage);
  }

  get paginatedLookupItems(): LookupItem[] {
    this.validateCurrentPage();
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.filteredLookupItems.slice(start, start + this.rowsPerPage);
  }

  private validateCurrentPage(): void {
    const max = this.totalPages;
    if (this.currentPage > max && max > 0) this.currentPage = max;
    if (this.currentPage < 1) this.currentPage = 1;
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.expandedPurposeIds = [];
    this.currentPage = page;
    this.cdr.markForCheck();
  }

  onRowsPerPageChange(rows: number): void {
    this.expandedPurposeIds = [];
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.validateCurrentPage();
    this.cdr.markForCheck();
  }

  onSearchChange(searchTerm: string): void {
    this.lookupSearchTerm = searchTerm;
    this.expandedPurposeIds = [];
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  onAddLookup(): void {
    if (!this.selectedTable) return;

    // For Employee table, use dedicated employee modal
    if (this.selectedTable.name === 'Employee') {
      this.employeeModalMode = 'create';
      this.selectedEmployee = null;
      this.showEmployeeModal = true;
      this.cdr.markForCheck();
      return;
    }

    this.lookupModalMode = 'create';
    this.selectedLookupItem = undefined;
    this.showLookupModal = true;
    this.cdr.markForCheck();
  }

  onEditLookup(item: LookupItem): void {
    if (!this.selectedTable) return;

    // For Employee table, open employee modal in edit mode with full employee data
    if (this.selectedTable.name === 'Employee') {
      this.employeeModalMode = 'edit';
      this.selectedEmployee = null;
      this.showEmployeeModal = true;
      this.cdr.markForCheck();

      // Load full employee details (departmentId, rankId, phone, email, notes, etc.)
      this.employeeService.getEmployeeById(item.id!).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (emp: EmployeeDto) => {
            this.selectedEmployee = emp;
            this.cdr.markForCheck();
          },
          error: () => {
            // If load fails, keep minimal data so user can still edit names/militaryId
            this.selectedEmployee = {
              id: item.id!,
              nameEn: item.nameEn,
              nameAr: item.nameAr,
              militaryId: item.code
            } as EmployeeDto;
            this.cdr.markForCheck();
          }
        });
      return;
    }

    this.lookupModalMode = 'edit';
    this.selectedLookupItem = item;
    this.showLookupModal = true;
    this.cdr.markForCheck();
  }

  onDeleteLookup(item: LookupItem): void {
    if (!this.selectedTable) return;
    this.selectedLookupItem = item;
    this.showLookupDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  confirmLookupDelete(): void {
    if (!this.selectedTable || !this.selectedLookupItem) return;

    // For Employee table, delete via EmployeeService instead of generic lookup service
    if (this.selectedTable.name === 'Employee') {
      this.employeeService.deleteEmployee(this.selectedLookupItem.id!).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            const itemName = this.lookupManagementService.getLookupItemName(this.selectedLookupItem);
            this.translateService.get(['toast.success', 'lookupManagement.deleteItem']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              this.toastService.success(
                `"${itemName}" ${translations['lookupManagement.deleteItem'] || 'deleted'} successfully`,
                translations['toast.success']
              );
            });
            this.showLookupDeleteConfirm = false;
            this.selectedLookupItem = undefined;
            this.cdr.markForCheck();
            this.loadLookupItems();
          },
          error: (error) => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to delete employee');
            this.lookupErrorMessage = errorMessage;
            this.cdr.markForCheck();
            this.translateService.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              this.toastService.error(
                errorMessage,
                translations['toast.error']
              );
            });
          }
        });
      return;
    }

    const dto: CreateUpdateLookupDto = {
      nameEn: this.selectedLookupItem.nameEn,
      nameAr: this.selectedLookupItem.nameAr,
      code: this.selectedLookupItem.code
    };

    if (this.selectedTable.name === 'Caliber') {
      dto.itemType = this.lookupManagementService.getItemType(this.selectedLookupItem);
    }

    this.lookupManagementService.deleteLookupItem(
      this.selectedTable,
      this.selectedLookupItem.id!,
      dto
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            const itemName = this.lookupManagementService.getLookupItemName(this.selectedLookupItem);
            this.translateService.get(['toast.success', 'lookupManagement.deleteItem']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              this.toastService.success(
                `"${itemName}" ${translations['lookupManagement.deleteItem'] || 'deleted'} successfully`,
                translations['toast.success']
              );
            });
            this.showLookupDeleteConfirm = false;
            this.selectedLookupItem = undefined;
            this.cdr.markForCheck();
            this.loadLookupItems();
          }
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to delete lookup item');
          this.lookupErrorMessage = errorMessage;
          this.cdr.markForCheck();
          this.translateService.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(
              errorMessage,
              translations['toast.error']
            );
          });
        }
      });
  }

  onLookupSaved(dto: CreateUpdateLookupDto): void {
    if (!this.selectedTable) return;

    this.lookupModalLoading = true;
    this.isLoadingLookups = true;
    this.lookupErrorMessage = '';

    const operation = this.lookupModalMode === 'create'
      ? this.lookupManagementService.createLookupItem(this.selectedTable, dto)
      : this.lookupManagementService.updateLookupItem(
        this.selectedTable,
        this.selectedLookupItem!.id!,
        dto
      );

    operation
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (_item) => {
          const isCreate = this.lookupModalMode === 'create';
          const itemName = this.lookupManagementService.getLookupItemName(dto);

          this.translateService.get([
            'toast.success',
            'lookupManagement.edit'
          ]).subscribe(translations => {
            const message = isCreate
              ? `"${itemName}" added successfully`
              : `"${itemName}" ${translations['lookupManagement.edit'] || 'updated'} successfully`;

            this.toastService.success(message, translations['toast.success']);
          });

          this.lookupModalLoading = false;
          this.isLoadingLookups = false;
          this.showLookupModal = false;
          this.selectedLookupItem = undefined;
          this.cdr.markForCheck();
          this.loadLookupItems();
        },
        error: (error) => {
          this.lookupModalLoading = false;
          this.isLoadingLookups = false;
          const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(
            error,
            'Failed to save lookup item',
            this.translateService
          );
          this.lookupErrorMessage = errorMessage;
          this.cdr.markForCheck();

          this.translateService.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(
              errorMessage,
              translations['toast.error']
            );
          });
        }
      });
  }

  getAddButtonLabel(): string {
    if (!this.selectedTable) return this.translateService.instant('lookupManagement.addItem');
    const itemName = this.selectedTable.displayNameKeySingular
      ? this.translateService.instant(this.selectedTable.displayNameKeySingular)
      : this.selectedTable.displayName.slice(0, -1);
    return this.translateService.instant('lookupManagement.addLabel', { item: itemName });
  }

  getLookupItemName(item: LookupItem | null | undefined): string {
    return this.lookupManagementService.getLookupItemName(item);
  }

  getItemTypeName(item: LookupItem): string {
    return this.lookupManagementService.getItemTypeName(item);
  }

  getItemType(item: LookupItem): number {
    return this.lookupManagementService.getItemType(item);
  }

  getAttachmentSlotCount(item: LookupItem): number {
    return item.attachmentRequirements?.length ?? 0;
  }

  isRequestPurposeTable(): boolean {
    return !!this.selectedTable?.requestPurposeType;
  }

  isOrderRequestPurposeTable(): boolean {
    return this.selectedTable?.requestPurposeType === 'order';
  }

  getAllowanceContextLabel(item: LookupItem): string {
    switch (item.allowanceContext) {
      case RequestPurposeAllowanceContext.FromAllowance:
        return this.translateService.instant('lookupFormModal.fromAllowance');
      case RequestPurposeAllowanceContext.OutsideAllowance:
        return this.translateService.instant('lookupFormModal.outsideAllowance');
      case RequestPurposeAllowanceContext.Both:
        return this.translateService.instant('lookupFormModal.both');
      default:
        return '—';
    }
  }

  getDesktopLookupColSpan(): number {
    const t = this.selectedTable;
    if (!t) return 2;
    let n = 2;
    if (t.hasCode) n++;
    if (t.name === 'Employee') n += 5;
    if (t.name === 'ItemType' || t.name === 'Unit') n++;
    if (t.name === 'Caliber') n++;
    if (t.requestPurposeType) n++;
    if (t.requestPurposeType === 'order') n++;
    if (this.canEdit() || this.canDelete()) n++;
    return n;
  }

  isPurposeExpanded(id: number | undefined): boolean {
    return id != null && this.expandedPurposeIds.includes(id);
  }

  togglePurposeExpanded(id: number | undefined): void {
    if (id == null) return;
    if (this.expandedPurposeIds.includes(id)) {
      this.expandedPurposeIds = this.expandedPurposeIds.filter(x => x !== id);
    } else {
      this.expandedPurposeIds = [...this.expandedPurposeIds, id];
    }
    this.cdr.markForCheck();
  }

  onPurposeMasterRowActivate(item: LookupItem, event: MouseEvent): void {
    if (!this.isRequestPurposeTable()) return;
    const el = event.target as HTMLElement | null;
    if (el?.closest('button, [role="button"], app-button, input, textarea, select, label')) return;
    this.togglePurposeExpanded(item.id);
  }

  sortedPurposeAttachments(item: LookupItem): AttachmentRequirementLookupDraft[] {
    const list = [...(item.attachmentRequirements ?? [])];
    list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    return list;
  }

  private reorderAttachmentDrafts(rows: AttachmentRequirementLookupDraft[]): AttachmentRequirementLookupDraft[] {
    return rows.map((row, displayOrder) => ({ ...row, displayOrder }));
  }

  persistPurposeAttachments(
    purpose: LookupItem,
    attachments: AttachmentRequirementLookupDraft[],
    successToastKey: string
  ): void {
    if (!purpose.id || !this.selectedTable?.requestPurposeType) return;
    const msg = this.translateService.instant(successToastKey);
    this.purposeAttachmentBusyId = purpose.id;
    const normalized = this.reorderAttachmentDrafts(attachments);
    const dto: CreateUpdateLookupDto = {
      nameEn: purpose.nameEn,
      nameAr: purpose.nameAr,
      attachmentRequirements: normalized,
      ...(purpose.allowanceContext != null ? { allowanceContext: purpose.allowanceContext } : {})
    };
    this.lookupManagementService
      .updateLookupItem(this.selectedTable!, purpose.id, dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.purposeAttachmentBusyId = null;
          this.toastService.success(msg);
          this.cdr.markForCheck();
          this.loadLookupItems();
        },
        error: error => {
          this.purposeAttachmentBusyId = null;
          const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(
            error,
            'Failed to save attachment requirements',
            this.translateService
          );
          this.lookupErrorMessage = errorMessage;
          this.cdr.markForCheck();
          this.translateService.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
        }
      });
  }

  openNestedAddAttachmentSlot(purpose: LookupItem, event?: Event): void {
    event?.stopPropagation?.();
    this.attachmentSlotModalPurpose = purpose;
    this.attachmentSlotModalEditingId = null;
    this.attachmentSlotForm.reset({
      nameEn: '',
      nameAr: '',
      isRequired: false,
      minCount: 1,
      maxCount: 1
    });
    this.showAttachmentSlotModal = true;
    this.cdr.markForCheck();
  }

  openNestedEditAttachmentSlot(purpose: LookupItem, row: AttachmentRequirementLookupDraft, event?: Event): void {
    event?.stopPropagation?.();
    this.attachmentSlotModalPurpose = purpose;
    this.attachmentSlotModalEditingId = row.id != null && row.id > 0 ? row.id : null;
    this.attachmentSlotForm.patchValue({
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      isRequired: row.isRequired,
      minCount: row.minCount,
      maxCount: row.maxCount
    });
    this.showAttachmentSlotModal = true;
    this.cdr.markForCheck();
  }

  closeAttachmentSlotModal(): void {
    this.showAttachmentSlotModal = false;
    this.attachmentSlotModalPurpose = null;
    this.attachmentSlotModalEditingId = null;
    this.attachmentSlotForm.markAsUntouched();
    this.cdr.markForCheck();
  }

  onAttachmentSlotModalSave(): void {
    const purpose = this.attachmentSlotModalPurpose;
    if (!purpose?.id || !this.selectedTable?.requestPurposeType) return;
    this.attachmentSlotForm.markAllAsTouched();
    if (this.attachmentSlotForm.invalid) return;
    const raw = this.attachmentSlotForm.getRawValue();
    const minCount = Number(raw.minCount);
    const maxCount = Number(raw.maxCount);
    if (!Number.isFinite(minCount) || minCount < 0) return;
    if (!Number.isFinite(maxCount) || maxCount < 1 || maxCount < minCount) {
      this.toastService.error(this.translateService.instant('lookupFormModal.attachmentCountsInvalid'));
      return;
    }

    let list = this.sortedPurposeAttachments(purpose).map(a => ({ ...a }));
    const editId = this.attachmentSlotModalEditingId;

    if (editId != null && editId > 0) {
      const ix = list.findIndex(x => x.id === editId);
      if (ix >= 0) {
        list[ix] = {
          ...list[ix],
          nameEn: raw.nameEn.trim(),
          nameAr: raw.nameAr.trim(),
          isRequired: !!raw.isRequired,
          minCount,
          maxCount
        };
      }
    } else {
      list.push({
        id: null,
        nameEn: raw.nameEn.trim(),
        nameAr: raw.nameAr.trim(),
        isRequired: !!raw.isRequired,
        minCount,
        maxCount,
        displayOrder: list.length
      });
    }

    const toastKey =
      editId != null && editId > 0 ? 'lookupManagement.nestedAttachmentUpdated' : 'lookupManagement.nestedAttachmentAdded';
    this.closeAttachmentSlotModal();
    this.persistPurposeAttachments(purpose, list, toastKey);
  }

  nestedAttachmentConfirmMessage(): string {
    const row = this.pendingAttachmentDelete;
    const lang =
      this.translateService.currentLang || this.translateService.defaultLang || 'en';
    const name =
      lang === 'ar' ? row?.nameAr?.trim() || row?.nameEn?.trim() : row?.nameEn?.trim() || row?.nameAr?.trim();
    return this.translateService.instant('lookupManagement.deleteAttachmentSlotConfirm', {
      name: name || ''
    });
  }

  nestedAttachmentModalTitle(): string {
    const key =
      this.attachmentSlotModalEditingId != null ? 'lookupManagement.attachmentSlotEditTitle' : 'lookupManagement.attachmentSlotAddTitle';
    return this.translateService.instant(key);
  }

  requestNestedAttachmentDelete(purpose: LookupItem, row: AttachmentRequirementLookupDraft, event?: Event): void {
    event?.stopPropagation?.();
    if (!row.id || row.id <= 0) return;
    this.pendingAttachmentDeletePurpose = purpose;
    this.pendingAttachmentDelete = row;
    this.showAttachmentSlotDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  cancelNestedAttachmentDelete(): void {
    this.showAttachmentSlotDeleteConfirm = false;
    this.pendingAttachmentDeletePurpose = null;
    this.pendingAttachmentDelete = null;
    this.cdr.markForCheck();
  }

  confirmNestedAttachmentDelete(): void {
    if (!this.pendingAttachmentDeletePurpose?.id || !this.pendingAttachmentDelete?.id) {
      this.cancelNestedAttachmentDelete();
      return;
    }
    const purpose = this.pendingAttachmentDeletePurpose;
    const delId = this.pendingAttachmentDelete.id;
    const next = this.reorderAttachmentDrafts(
      this.sortedPurposeAttachments(purpose).filter(r => r.id !== delId)
    );
    this.cancelNestedAttachmentDelete();
    this.persistPurposeAttachments(purpose, next, 'lookupManagement.nestedAttachmentRemoved');
  }

  isPurposeAttachmentBusy(purposeId: number | undefined): boolean {
    return purposeId != null && this.purposeAttachmentBusyId === purposeId;
  }

  canAdd(): boolean {
    return !!this.selectedTable && this.authService.hasPermission(this.selectedTable.createPermission);
  }

  canEdit(): boolean {
    return !!this.selectedTable && this.authService.hasPermission(this.selectedTable.editPermission);
  }

  canDelete(): boolean {
    return !!this.selectedTable && this.authService.hasPermission(this.selectedTable.deletePermission);
  }

  // Employee modal event handlers
  onEmployeeModalClosed(): void {
    this.showEmployeeModal = false;
    this.employeeModalMode = 'create';
    this.selectedEmployee = null;
    this.cdr.markForCheck();
  }

  onEmployeeSaved(): void {
    this.showEmployeeModal = false;
    this.employeeModalMode = 'create';
    this.selectedEmployee = null;
    this.cdr.markForCheck();
    this.loadLookupItems();
  }

  // --- Employee Import / Export ---

  get isEmployeeTable(): boolean {
    return this.selectedTable?.name === 'Employee';
  }

  onDownloadTemplate(): void {
    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    this.employeeService.generateImportTemplate(lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'Employee_Import_Template.xlsx';
          link.click();
          window.URL.revokeObjectURL(url);
          this.toastService.success('Template downloaded');
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Failed to download template'));
          this.cdr.markForCheck();
        }
      });
  }

  onExportEmployees(): void {
    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    this.employeeService.exportEmployees(lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Employees_${new Date().toISOString().slice(0, 10)}.xlsx`;
          link.click();
          window.URL.revokeObjectURL(url);
          this.toastService.success('Export downloaded');
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Export failed'));
          this.cdr.markForCheck();
        }
      });
  }

  onOpenImport(): void {
    this.pendingImportFile = null;
    this.previewData = null;
    this.showImportModal = true;
    this.cdr.markForCheck();
  }

  onImportDialogClose(): void {
    this.showImportModal = false;
    this.pendingImportFile = null;
    this.cdr.markForCheck();
  }

  onImportPreview(file: File): void {
    this.showImportModal = false;
    this.pendingImportFile = file;
    this.isImportInProgress = true;
    this.cdr.markForCheck();

    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    this.employeeService.importPreview(file, lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isImportInProgress = false;
          if (!res?.succeeded || !res.data) {
            this.toastService.error(res?.message || 'Preview failed');
            this.cdr.markForCheck();
            return;
          }
          const preview = mapImportResultToPreviewData(res.data);
          if (preview) {
            this.previewData = preview;
            this.showPreviewModal = true;
          }
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.isImportInProgress = false;
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Preview failed'));
          this.cdr.markForCheck();
        }
      });
  }

  onPreviewConfirmed(): void {
    if (!this.pendingImportFile) return;
    this.showPreviewModal = false;
    this.isImportInProgress = true;
    this.cdr.markForCheck();

    const lang = this.translateService.currentLang || this.translateService.defaultLang || 'en';
    this.employeeService.importData(this.pendingImportFile, lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: APIOperationResponse<ImportResult>) => {
          this.isImportInProgress = false;
          this.pendingImportFile = null;
          this.previewData = null;
          if (res?.succeeded && res.data) {
            this.importExportService.handleImportResult({
              successCount: res.data.successCount ?? 0,
              failureCount: res.data.failureCount ?? 0,
              errors: res.data.errors,
              message: res.message
            });
            this.loadLookupItems();
          } else {
            this.toastService.error(res?.message || 'Import failed');
          }
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.isImportInProgress = false;
          this.pendingImportFile = null;
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Import failed'));
          this.cdr.markForCheck();
        }
      });
  }

  onPreviewCancelled(): void {
    this.showPreviewModal = false;
    this.previewData = null;
    this.pendingImportFile = null;
    this.cdr.markForCheck();
  }
}
