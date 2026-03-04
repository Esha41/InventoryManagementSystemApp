import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Plus, Search, ChevronDown, ChevronRight } from 'lucide-angular';
import { ItemDepartmentAssignmentFacade } from './data/item-department-assignment.facade';
import {
  ItemDepartmentAssignmentDto,
  CreateUpdateItemDepartmentAssignmentDto,
  DepartmentAssignmentSummaryDto,
  BaseItemWithType
} from '@models/item-department-assignment.model';
import { LookupItem } from '@models/lookup.model';
import { APIOperationResponse } from '@models/api-response.model';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { LoadingStateComponent, PaginationComponent, RowsPerPageComponent } from '@components/index';
import { DepartmentAssignmentsTableComponent } from './components/department-assignments-table/department-assignments-table.component';
import { AssignmentModalComponent, AssignmentFormData } from './components/assignment-modal/assignment-modal.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ProfileDataService } from '@services/profile-data.service';
import { TranslationMap } from '@models/common.types';
import { ErrorHandler } from '@utils/error-handler.utils';

@Component({
  selector: 'app-item-department-assignment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    ConfirmDialogComponent,
    HasPermissionDirective,
    LoadingStateComponent,
    PaginationComponent,
    RowsPerPageComponent,
    DepartmentAssignmentsTableComponent,
    AssignmentModalComponent
  ],
  templateUrl: './item-department-assignment.component.html',
  styleUrls: ['./item-department-assignment.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ItemDepartmentAssignmentFacade]
})
export class ItemDepartmentAssignmentComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Search = Search;
  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;

  departments: LookupItem[] = [];
  departmentSummaries: DepartmentAssignmentSummaryDto[] = [];
  filteredSummaries: DepartmentAssignmentSummaryDto[] = [];
  allItems: BaseItemWithType[] = [];
  availableItems: BaseItemWithType[] = [];
  loading = false;
  errorMessage: string | null = null;
  searchTerm = '';

  expandedDepartments = new Set<number>();
  showModal = false;
  isEditMode = false;
  currentAssignmentId = 0;
  currentAssignment: AssignmentFormData = this.getEmptyAssignment();
  selectedAmmunitionIds: number[] = [];
  selectedWeaponIds: number[] = [];
  selectedExplosiveIds: number[] = [];

  showDeleteDialog = false;
  assignmentToDelete?: ItemDepartmentAssignmentDto;
  isSuperAdmin = false;

  currentPage = 1;
  rowsPerPage = 10;

  private destroy$ = new Subject<void>();

  constructor(
    public facade: ItemDepartmentAssignmentFacade,
    private toastService: ToastService,
    public translateService: TranslateService,
    private profileDataService: ProfileDataService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const profileData = this.profileDataService.getFullProfileData();
    this.isSuperAdmin = profileData?.isSuperAdmin ?? false;
    this.loadData();
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = null;
    this.facade.loadData().subscribe({
      next: (result) => {
        this.departments = result.departments;
        this.departmentSummaries = result.departmentSummaries;
        this.allItems = result.allItems;
        this.availableItems = result.allItems;
        this.applyFilters();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load data');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    this.filterSummariesBySearch();
    this.currentPage = 1;
  }

  filterSummariesBySearch(): void {
    if (!this.searchTerm) {
      this.filteredSummaries = [...this.departmentSummaries];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredSummaries = this.departmentSummaries.filter((s) => {
        const nameAr = (s.departmentNameAr ?? '').toLowerCase();
        const nameEn = (s.departmentNameEn ?? '').toLowerCase();
        const code = (s.departmentCode ?? '').toLowerCase();
        return nameAr.includes(term) || nameEn.includes(term) || code.includes(term);
      });
    }
  }

  loadAssignmentsForDepartment(departmentId: number, onLoaded?: () => void): void {
    this.facade.loadAssignmentsForDepartment(departmentId, this.destroy$, onLoaded);
    this.cdr.markForCheck();
  }

  toggleDepartmentItems(departmentId: number): void {
    if (this.expandedDepartments.has(departmentId)) {
      this.expandedDepartments.delete(departmentId);
    } else {
      this.expandedDepartments.add(departmentId);
      if (!this.facade.assignmentsByDepartment.has(departmentId)) {
        this.loadAssignmentsForDepartment(departmentId, () => this.cdr.markForCheck());
      }
    }
    this.cdr.markForCheck();
  }

  isDepartmentExpanded(departmentId: number): boolean {
    return this.expandedDepartments.has(departmentId);
  }

  getDepartmentAssignments(departmentId: number): ItemDepartmentAssignmentDto[] {
    return this.facade.getDepartmentAssignments(departmentId);
  }

  get paginatedSummaries(): DepartmentAssignmentSummaryDto[] {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    const end = start + this.rowsPerPage;
    return this.filteredSummaries.slice(start, end);
  }

  get totalPages(): number {
    const total = this.filteredSummaries.length;
    return total === 0 ? 1 : Math.ceil(total / this.rowsPerPage);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
  }

  onSearch(): void {
    this.applyFilters();
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentAssignment = this.getEmptyAssignment();
    this.selectedAmmunitionIds = [];
    this.selectedWeaponIds = [];
    this.selectedExplosiveIds = [];
    this.availableItems = this.allItems;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  openAddModalForDepartment(departmentId: number): void {
    this.isEditMode = false;
    this.currentAssignment = { itemId: 0, departmentId, notes: '' };
    this.selectedAmmunitionIds = [];
    this.selectedWeaponIds = [];
    this.selectedExplosiveIds = [];
    this.showModal = true;
    setTimeout(() => this.onDepartmentChange(departmentId), 0);
    this.cdr.markForCheck();
  }

  openEditModal(assignment: ItemDepartmentAssignmentDto): void {
    this.isEditMode = true;
    this.currentAssignmentId = assignment.id;
    this.currentAssignment = {
      itemId: assignment.itemId,
      departmentId: assignment.departmentId,
      notes: assignment.notes ?? ''
    };
    this.onDepartmentChange(assignment.departmentId);
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.showModal = false;
    this.currentAssignmentId = 0;
    this.currentAssignment = this.getEmptyAssignment();
    this.selectedAmmunitionIds = [];
    this.selectedWeaponIds = [];
    this.selectedExplosiveIds = [];
    this.availableItems = this.allItems;
    this.errorMessage = null;
    this.cdr.markForCheck();
  }

  saveAssignment(): void {
    if (!this.validateAssignment()) {
      this.translateService.get('itemDepartmentAssignment.errors.fillRequiredFields').subscribe((t) => {
        this.errorMessage = t ?? 'Please fill in all required fields';
        this.cdr.markForCheck();
      });
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    if (this.isEditMode) {
      this.facade
        .update(this.currentAssignmentId, this.currentAssignment as CreateUpdateItemDepartmentAssignmentDto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => this.handleSaveResponse(res),
          error: (err) => this.handleSaveError(err)
        });
    } else {
      const combinedItemIds = [
        ...this.selectedAmmunitionIds,
        ...this.selectedWeaponIds,
        ...this.selectedExplosiveIds
      ].filter((id) => id > 0);
      const assignmentsToCreate: CreateUpdateItemDepartmentAssignmentDto[] = combinedItemIds.map(
        (itemId) => ({
          itemId,
          departmentId: this.currentAssignment.departmentId!,
          notes: this.currentAssignment.notes
        })
      );

      if (assignmentsToCreate.length === 0) {
        this.translateService.get('itemDepartmentAssignment.errors.selectAtLeastOneItem').subscribe((t) => {
          this.errorMessage = t ?? 'Please select at least one item';
          this.loading = false;
          this.cdr.markForCheck();
        });
        return;
      }

      if (assignmentsToCreate.length === 1) {
        this.facade
          .create(assignmentsToCreate[0])
          .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => this.handleSaveResponse(res),
          error: (err) => this.handleSaveError(err)
        });
      } else {
        this.facade
          .bulkAssign(assignmentsToCreate)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => this.handleSaveResponse(res, 'toast.assignmentsCreated'),
            error: (err) => this.handleSaveError(err)
          });
      }
    }
  }

  private handleSaveResponse(
    res: APIOperationResponse<boolean | number>,
    successToastKey?: string
  ): void {
    this.loading = false;
    if (res.succeeded) {
      const key = successToastKey ?? (this.isEditMode ? 'toast.assignmentUpdated' : 'toast.assignmentCreated');
      this.translateService.get([key, 'toast.success']).subscribe((t: TranslationMap) => {
        this.toastService.success(t[key], t['toast.success']);
      });
      this.closeModal();
      this.loadData();
      this.expandedDepartments.clear();
    } else {
      this.translateService.get(['toast.failedToSaveAssignment', 'toast.error']).subscribe((t: TranslationMap) => {
        this.toastService.error(res.message ?? t['toast.failedToSaveAssignment'], t['toast.error']);
      });
    }
    this.cdr.markForCheck();
  }

  private handleSaveError(error: unknown): void {
    this.loading = false;
    const msg = ErrorHandler.extractErrorMessage(error, 'Failed to save assignment');
    this.translateService.get(['toast.failedToSaveAssignment', 'toast.error']).subscribe((t: TranslationMap) => {
      this.toastService.error(msg ?? t['toast.failedToSaveAssignment'], t['toast.error']);
    });
    this.cdr.markForCheck();
  }

  validateAssignment(): boolean {
    if (this.isEditMode) {
      return !!(this.currentAssignment.itemId && this.currentAssignment.departmentId);
    }
    const total =
      this.selectedAmmunitionIds.length + this.selectedWeaponIds.length + this.selectedExplosiveIds.length;
    return !!(total > 0 && this.currentAssignment.departmentId);
  }

  onDepartmentChange(departmentId: number | string | null): void {
    const deptId =
      departmentId == null ? 0 : typeof departmentId === 'string' ? parseInt(departmentId, 10) : Number(departmentId);

    this.availableItems = [...this.allItems];

    if (deptId <= 0 || isNaN(deptId)) {
      this.currentAssignment.departmentId = null;
      this.selectedAmmunitionIds = [];
      this.selectedWeaponIds = [];
      this.selectedExplosiveIds = [];
      this.cdr.markForCheck();
      return;
    }

    const runSelections = () => {
      const deptAssignments = this.facade.getDepartmentAssignments(deptId);
      this.selectedAmmunitionIds = deptAssignments
        .filter((a) => this.isAmmunitionType(a.itemType))
        .map((a) => Number(a.itemId))
        .filter((id) => this.allItems.some((item) => Number(item.id) === id));
      this.selectedWeaponIds = deptAssignments
        .filter((a) => this.isWeaponType(a.itemType))
        .map((a) => Number(a.itemId))
        .filter((id) => this.allItems.some((item) => Number(item.id) === id));
      this.selectedExplosiveIds = deptAssignments
        .filter((a) => this.isExplosiveType(a.itemType))
        .map((a) => Number(a.itemId))
        .filter((id) => this.allItems.some((item) => Number(item.id) === id));
      this.cdr.markForCheck();
    };

    if (this.facade.assignmentsByDepartment.has(deptId)) {
      runSelections();
    } else {
      this.loadAssignmentsForDepartment(deptId, runSelections);
    }
  }

  private isAmmunitionType(itemType: number | string | undefined): boolean {
    if (itemType === undefined || itemType === null) return false;
    if (typeof itemType === 'string') return itemType.trim().toLowerCase() === 'ammunition';
    return itemType === 1;
  }

  private isWeaponType(itemType: number | string | undefined): boolean {
    if (itemType === undefined || itemType === null) return false;
    if (typeof itemType === 'string') return itemType.trim().toLowerCase() === 'weapon';
    return itemType === 2;
  }

  private isExplosiveType(itemType: number | string | undefined): boolean {
    if (itemType === undefined || itemType === null) return false;
    if (typeof itemType === 'string') return itemType.trim().toLowerCase() === 'explosive';
    return itemType === 3;
  }

  onItemSelectChange(itemId: number): void {
    this.currentAssignment.itemId = itemId;
    this.cdr.markForCheck();
  }

  onAmmunitionChange(ids: number[]): void {
    this.selectedAmmunitionIds = ids;
    this.cdr.markForCheck();
  }

  onWeaponsChange(ids: number[]): void {
    this.selectedWeaponIds = ids;
    this.cdr.markForCheck();
  }

  onExplosivesChange(ids: number[]): void {
    this.selectedExplosiveIds = ids;
    this.cdr.markForCheck();
  }

  deleteAssignment(assignment: ItemDepartmentAssignmentDto): void {
    this.assignmentToDelete = assignment;
    this.showDeleteDialog = true;
    this.cdr.markForCheck();
  }

  onDeleteConfirm(): void {
    if (!this.assignmentToDelete) return;

    const deletedId = this.assignmentToDelete.id;
    const departmentId = this.assignmentToDelete.departmentId;

    this.loading = true;
    this.errorMessage = null;
    this.showDeleteDialog = false;

    this.facade
      .delete(this.assignmentToDelete.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.assignmentToDelete = undefined;
          if (res.succeeded) {
            this.translateService.get(['toast.assignmentDeleted', 'toast.success']).subscribe((t: TranslationMap) => {
              this.toastService.success(t['toast.assignmentDeleted'], t['toast.success']);
            });
            this.facade.removeAssignmentFromCache(deletedId, departmentId);
            this.refreshDepartmentSummaries();
          } else {
            this.translateService.get(['toast.failedToDeleteAssignment', 'toast.error']).subscribe((t: TranslationMap) => {
              this.toastService.error(res.message ?? t['toast.failedToDeleteAssignment'], t['toast.error']);
            });
          }
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.loading = false;
          this.assignmentToDelete = undefined;
          const msg = ErrorHandler.extractErrorMessage(err, 'Failed to delete assignment');
          this.translateService.get('toast.error').subscribe((t) => {
            this.toastService.error(msg, t);
          });
          this.cdr.markForCheck();
        }
      });
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.assignmentToDelete = undefined;
    this.cdr.markForCheck();
  }

  private refreshDepartmentSummaries(): void {
    this.facade.getDepartmentSummaries().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.succeeded && res.data) {
          this.departmentSummaries = res.data;
          this.filterSummariesBySearch();
          this.cdr.markForCheck();
        }
      }
    });
  }

  private getEmptyAssignment(): AssignmentFormData {
    return { itemId: 0, departmentId: null, notes: '' };
  }

  getDepartmentName(departmentId: number): string {
    const dept = this.departments.find((d) => d.id === departmentId);
    return dept ? getLocalizedName(dept, getCurrentLang(this.translateService)) ?? '' : '';
  }

  getSummaryDepartmentName(summary: DepartmentAssignmentSummaryDto): string {
    const lang = getCurrentLang(this.translateService);
    if (lang === 'ar' && summary.departmentNameAr) return summary.departmentNameAr;
    return summary.departmentNameEn ?? summary.departmentNameAr ?? '';
  }
}
