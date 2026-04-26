import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { LucideAngularModule, Plus, Edit, Trash2, Download, Upload } from 'lucide-angular';
import { LookupItem, LookupTableConfig, CreateUpdateLookupDto } from '@models/lookup.model';
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
    this.currentPage = page;
    this.cdr.markForCheck();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.validateCurrentPage();
    this.cdr.markForCheck();
  }

  onSearchChange(searchTerm: string): void {
    this.lookupSearchTerm = searchTerm;
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
            this.translateService.get(['toast.success', 'lookupManagement.deleteItem']).subscribe(translations => {
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
            this.translateService.get(['toast.error']).subscribe(translations => {
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
            this.translateService.get(['toast.success', 'lookupManagement.deleteItem']).subscribe(translations => {
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
          this.translateService.get(['toast.error']).subscribe(translations => {
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
        next: (item) => {
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
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to save lookup item');
          this.lookupErrorMessage = errorMessage;
          this.cdr.markForCheck();

          this.translateService.get(['toast.error']).subscribe(translations => {
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
