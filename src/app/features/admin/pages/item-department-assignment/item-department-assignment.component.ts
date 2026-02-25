import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, Plus, Edit, Trash2, X, Search, ChevronDown, ChevronRight } from 'lucide-angular';
import { LookupService } from '@services/lookup.service';
import { ItemDepartmentAssignmentService } from '@services/item-department-assignment.service';
import { ItemDepartmentAssignmentDto, CreateUpdateItemDepartmentAssignmentDto, DepartmentAssignmentSummaryDto } from '@models/item-department-assignment.model';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { LoadingStateComponent, PaginationComponent, RowsPerPageComponent } from '@components/index';
import { DropdownComponent } from '@shared/components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ProfileDataService } from '@services/profile-data.service';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { BaseItemDto } from '@models/inventory.model';

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
    DropdownComponent,
    PaginationComponent,
    RowsPerPageComponent
  ],
  templateUrl: './item-department-assignment.component.html',
  styleUrls: ['./item-department-assignment.component.css']
})
export class ItemDepartmentAssignmentComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly X = X;
  readonly Search = Search;
  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;

  assignments: ItemDepartmentAssignmentDto[] = [];
  filteredAssignments: ItemDepartmentAssignmentDto[] = [];
  departments: any[] = [];
  departmentSummaries: DepartmentAssignmentSummaryDto[] = []; // From summary API
  filteredSummaries: DepartmentAssignmentSummaryDto[] = []; // Summaries filtered by search
  items: BaseItemDto[] = [];
  allItems: BaseItemDto[] = []; // Store all items
  availableItems: BaseItemDto[] = []; // Items available for selection (filtered by department)
  loading = false;
  errorMessage: string | null = null;
  searchTerm = '';
  
  // Department view state
  expandedDepartments: Set<number> = new Set(); // Track which departments have items expanded
  assignmentsByDepartment: Map<number, ItemDepartmentAssignmentDto[]> = new Map();

  // Modal state
  showModal = false;
  isEditMode = false;
  currentAssignmentId: number = 0;
  currentAssignment: Omit<CreateUpdateItemDepartmentAssignmentDto, 'departmentId'> & { departmentId: number | null } = this.getEmptyAssignment();
  selectedItemIds: number[] = []; // For multiple item selection (edit mode)
  selectedAmmunitionIds: number[] = [];
  selectedWeaponIds: number[] = [];
  selectedExplosiveIds: number[] = [];

  // Delete confirmation dialog state
  showDeleteDialog = false;
  assignmentToDelete?: ItemDepartmentAssignmentDto;

  // Super admin check
  isSuperAdmin = false;

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;

  private destroy$ = new Subject<void>();

  constructor(
    private assignmentService: ItemDepartmentAssignmentService,
    private lookupService: LookupService,
    private apiService: ApiService,
    private toastService: ToastService,
    public translateService: TranslateService,
    private profileDataService: ProfileDataService,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  ngOnInit(): void {
    const profileData = this.profileDataService.getFullProfileData();
    this.isSuperAdmin = profileData?.isSuperAdmin || false;

    this.loadData();

    // Subscribe to language changes
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      summaries: this.assignmentService.getDepartmentSummaries(),
      departments: this.lookupService.getDepartments(),
      ammunition: this.ammunitionService.getAll<BaseItemDto>(),
      weapons: this.weaponService.getAll<BaseItemDto>(),
      explosives: this.explosiveService.getAll<BaseItemDto>()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          if (results.departments) {
            this.departments = results.departments.filter((d: any) => !d.isDeleted);
          }

          if (results.summaries.succeeded && results.summaries.data) {
            this.departmentSummaries = results.summaries.data;
          } else {
            this.departmentSummaries = [];
          }

          this.assignments = [];
          this.assignmentsByDepartment.clear();
          this.applyFilters();

          // Combine all items and tag with itemType (1=Ammunition, 2=Weapon, 3=Explosive)
          const ammo = (results.ammunition || []).filter((item: any) => !item.isDeleted).map((item: any) => ({
            ...item,
            itemType: 1,
            displayLabel: `${item.name} (${item.itemNo})`
          }));
          const weapons = (results.weapons || []).filter((item: any) => !item.isDeleted).map((item: any) => ({
            ...item,
            itemType: 2,
            displayLabel: `${item.name} (${item.itemNo})`
          }));
          const explosives = (results.explosives || []).filter((item: any) => !item.isDeleted).map((item: any) => ({
            ...item,
            itemType: 3,
            displayLabel: `${item.name} (${item.itemNo})`
          }));
          this.allItems = [...ammo, ...weapons, ...explosives];

          // Initialize available items (will be filtered when department is selected)
          this.items = this.allItems;
          this.availableItems = this.allItems;

          this.loading = false;
        },
        error: (error) => {
          this.errorMessage = error.message || 'Failed to load data';
          this.loading = false;
        }
      });
  }

  groupAssignmentsByDepartment(): void {
    this.assignmentsByDepartment.clear();
    
    this.assignments.forEach(assignment => {
      const deptId = assignment.departmentId;
      if (!this.assignmentsByDepartment.has(deptId)) {
        this.assignmentsByDepartment.set(deptId, []);
      }
      this.assignmentsByDepartment.get(deptId)!.push(assignment);
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
      this.filteredSummaries = this.departmentSummaries.filter(s => {
        const nameAr = (s.departmentNameAr || '').toLowerCase();
        const nameEn = (s.departmentNameEn || '').toLowerCase();
        const code = (s.departmentCode || '').toLowerCase();
        return nameAr.includes(term) || nameEn.includes(term) || code.includes(term);
      });
    }
  }

  /** Load assignments for one department (on expand or when opening modal). Merges into cache. */
  private loadAssignmentsForDepartment(departmentId: number, onLoaded?: () => void): void {
    if (this.assignmentsByDepartment.has(departmentId)) {
      onLoaded?.();
      return;
    }
    this.assignmentService.getByDepartmentId(departmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const list = res.succeeded && res.data ? res.data : [];
          this.assignments = this.assignments.filter(a => Number(a.departmentId) !== departmentId);
          list.forEach(a => this.assignments.push(a));
          this.assignmentsByDepartment.set(departmentId, list);
          this.cdr.detectChanges();
          onLoaded?.();
        },
        error: () => {
          this.assignmentsByDepartment.set(departmentId, []);
          this.cdr.detectChanges();
          onLoaded?.();
        }
      });
  }

  toggleDepartmentItems(departmentId: number): void {
    if (this.expandedDepartments.has(departmentId)) {
      this.expandedDepartments.delete(departmentId);
    } else {
      this.expandedDepartments.add(departmentId);
      if (!this.assignmentsByDepartment.has(departmentId)) {
        this.loadAssignmentsForDepartment(departmentId);
      }
    }
  }

  isDepartmentExpanded(departmentId: number): boolean {
    return this.expandedDepartments.has(departmentId);
  }

  getDepartmentAssignments(departmentId: number): ItemDepartmentAssignmentDto[] {
    return this.assignmentsByDepartment.get(departmentId) || [];
  }

  /** Summaries to show on the current page (for pagination). */
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
    const max = this.totalPages;
    if (page >= 1 && page <= max) {
      this.currentPage = page;
    }
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
  }

  getDepartmentAssignmentCount(departmentId: number): number {
    return this.getDepartmentAssignments(departmentId).length;
  }

  /** Count assignments that are ammunition (itemType 1 or "Ammunition"). */
  getDepartmentAmmunitionCount(departmentId: number): number {
    return this.getDepartmentAssignments(departmentId).filter(a => this.isAmmunitionType(a.itemType)).length;
  }

  /** Count assignments that are weapons (itemType 2 or "Weapon"). */
  getDepartmentWeaponsCount(departmentId: number): number {
    return this.getDepartmentAssignments(departmentId).filter(a => this.isWeaponType(a.itemType)).length;
  }

  /** Count assignments that are explosives (itemType 3 or "Explosive"). */
  getDepartmentExplosivesCount(departmentId: number): number {
    return this.getDepartmentAssignments(departmentId).filter(a => this.isExplosiveType(a.itemType)).length;
  }

  private isAmmunitionType(itemType: number | string | undefined): boolean {
    if (itemType === undefined || itemType === null) return false;
    if (typeof itemType === 'string') return (itemType as string).trim().toLowerCase() === 'ammunition';
    return itemType === 1;
  }

  private isWeaponType(itemType: number | string | undefined): boolean {
    if (itemType === undefined || itemType === null) return false;
    if (typeof itemType === 'string') return (itemType as string).trim().toLowerCase() === 'weapon';
    return itemType === 2;
  }

  private isExplosiveType(itemType: number | string | undefined): boolean {
    if (itemType === undefined || itemType === null) return false;
    if (typeof itemType === 'string') return (itemType as string).trim().toLowerCase() === 'explosive';
    return itemType === 3;
  }

  /** Items filtered by type for separate dropdowns in Add Assignment modal. */
  get availableAmmunition(): BaseItemDto[] {
    return (this.availableItems || []).filter((i: any) => (i.itemType === 1 || i.itemType === 'Ammunition'));
  }

  get availableWeapons(): BaseItemDto[] {
    return (this.availableItems || []).filter((i: any) => (i.itemType === 2 || i.itemType === 'Weapon'));
  }

  get availableExplosives(): BaseItemDto[] {
    return (this.availableItems || []).filter((i: any) => (i.itemType === 3 || i.itemType === 'Explosive'));
  }

  onSearch(): void {
    this.applyFilters();
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentAssignment = this.getEmptyAssignment();
    this.selectedItemIds = [];
    this.selectedAmmunitionIds = [];
    this.selectedWeaponIds = [];
    this.selectedExplosiveIds = [];
    this.showModal = true;
    // Ensure all items are available when modal opens
    this.availableItems = this.allItems;
    this.items = this.allItems;
  }

  openAddModalForDepartment(departmentId: number): void {
    this.isEditMode = false;
    this.currentAssignment = {
      itemId: 0,
      departmentId: departmentId,
      notes: ''
    };
    this.selectedItemIds = [];
    this.selectedAmmunitionIds = [];
    this.selectedWeaponIds = [];
    this.selectedExplosiveIds = [];
    this.showModal = true;
    // Use setTimeout to ensure modal is rendered before setting department
    setTimeout(() => {
      this.onDepartmentChange(departmentId);
    }, 0);
  }

  openEditModal(assignment: ItemDepartmentAssignmentDto): void {
    this.isEditMode = true;
    this.currentAssignmentId = assignment.id;
    this.currentAssignment = {
      itemId: assignment.itemId,
      departmentId: assignment.departmentId,
      notes: assignment.notes || ''
    };
    this.selectedItemIds = [assignment.itemId]; // Single item for edit mode
    // Filter items for the selected department
    this.onDepartmentChange(assignment.departmentId);
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.currentAssignmentId = 0;
    this.currentAssignment = this.getEmptyAssignment();
    this.selectedItemIds = [];
    this.selectedAmmunitionIds = [];
    this.selectedWeaponIds = [];
    this.selectedExplosiveIds = [];
    // Reset available items to all items
    this.availableItems = this.allItems;
    this.items = this.allItems;
    this.errorMessage = null;
  }

  saveAssignment(): void {
    if (!this.validateAssignment()) {
      this.translateService.get('itemDepartmentAssignment.errors.fillRequiredFields').subscribe(translation => {
        this.errorMessage = translation || 'Please fill in all required fields';
      });
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    if (this.isEditMode) {
      // Edit mode: single item update
      this.assignmentService.update(this.currentAssignmentId, this.currentAssignment as CreateUpdateItemDepartmentAssignmentDto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: APIOperationResponse<boolean>) => {
            if (response.succeeded) {
              this.translateService.get(['toast.assignmentUpdated', 'toast.success']).subscribe(translations => {
                this.toastService.success(translations['toast.assignmentUpdated'], translations['toast.success']);
              });
              this.closeModal();
              this.loadData();
              this.expandedDepartments.clear(); // Reset expanded departments after save
            } else {
              this.translateService.get(['toast.failedToSaveAssignment', 'toast.error']).subscribe(translations => {
                this.toastService.error(
                  response.message || translations['toast.failedToSaveAssignment'],
                  translations['toast.error']
                );
              });
            }
            this.loading = false;
          },
          error: (error: any) => {
            let errorMessage = 'Failed to save assignment';
            if (error?.userMessage) {
              errorMessage = error.userMessage;
            } else if (error?.error?.message) {
              errorMessage = error.error.message;
            } else if (error?.message) {
              errorMessage = error.message;
            }

            this.translateService.get(['toast.failedToSaveAssignment', 'toast.error']).subscribe(translations => {
              this.toastService.error(
                errorMessage || translations['toast.failedToSaveAssignment'],
                translations['toast.error']
              );
            });
            this.loading = false;
          }
        });
    } else {
      // Add mode: combine selections from ammunition, explosives, and weapons dropdowns
      const combinedItemIds = [
        ...this.selectedAmmunitionIds,
        ...this.selectedWeaponIds,
        ...this.selectedExplosiveIds
      ].filter(id => id > 0);

      const assignmentsToCreate: CreateUpdateItemDepartmentAssignmentDto[] = combinedItemIds
        .map(itemId => ({
          itemId: itemId,
          departmentId: this.currentAssignment.departmentId!,
          notes: this.currentAssignment.notes
        }));

      if (assignmentsToCreate.length === 0) {
        this.translateService.get('itemDepartmentAssignment.errors.selectAtLeastOneItem').subscribe(translation => {
          this.errorMessage = translation || 'Please select at least one item';
        });
        this.loading = false;
        return;
      }

      // Use bulk assign if multiple items, otherwise use single create
      if (assignmentsToCreate.length === 1) {
        this.assignmentService.create(assignmentsToCreate[0])
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response: APIOperationResponse<number>) => {
              if (response.succeeded) {
                this.translateService.get(['toast.assignmentCreated', 'toast.success']).subscribe(translations => {
                  this.toastService.success(translations['toast.assignmentCreated'], translations['toast.success']);
                });
                this.closeModal();
                this.loadData();
              } else {
                this.translateService.get(['toast.failedToSaveAssignment', 'toast.error']).subscribe(translations => {
                  this.toastService.error(
                    response.message || translations['toast.failedToSaveAssignment'],
                    translations['toast.error']
                  );
                });
              }
              this.loading = false;
            },
            error: (error: any) => {
              let errorMessage = 'Failed to save assignment';
              if (error?.userMessage) {
                errorMessage = error.userMessage;
              } else if (error?.error?.message) {
                errorMessage = error.error.message;
              } else if (error?.message) {
                errorMessage = error.message;
              }

              this.translateService.get(['toast.failedToSaveAssignment', 'toast.error']).subscribe(translations => {
                this.toastService.error(
                  errorMessage || translations['toast.failedToSaveAssignment'],
                  translations['toast.error']
                );
              });
              this.loading = false;
            }
          });
      } else {
        // Bulk assign multiple items
        this.assignmentService.bulkAssign(assignmentsToCreate)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response: APIOperationResponse<boolean>) => {
              if (response.succeeded) {
                this.translateService.get(['toast.assignmentsCreated', 'toast.success']).subscribe(translations => {
                  this.toastService.success(
                    translations['toast.assignmentsCreated'] || `${assignmentsToCreate.length} assignments created successfully`,
                    translations['toast.success']
                  );
                });
                this.closeModal();
                this.loadData();
              } else {
                this.translateService.get(['toast.failedToSaveAssignment', 'toast.error']).subscribe(translations => {
                  this.toastService.error(
                    response.message || translations['toast.failedToSaveAssignment'],
                    translations['toast.error']
                  );
                });
              }
              this.loading = false;
            },
            error: (error: any) => {
              let errorMessage = 'Failed to save assignments';
              if (error?.userMessage) {
                errorMessage = error.userMessage;
              } else if (error?.error?.message) {
                errorMessage = error.error.message;
              } else if (error?.message) {
                errorMessage = error.message;
              }

              this.translateService.get(['toast.failedToSaveAssignment', 'toast.error']).subscribe(translations => {
                this.toastService.error(
                  errorMessage || translations['toast.failedToSaveAssignment'],
                  translations['toast.error']
                );
              });
              this.loading = false;
            }
          });
      }
    }
  }

  deleteAssignment(assignment: ItemDepartmentAssignmentDto): void {
    this.assignmentToDelete = assignment;
    this.showDeleteDialog = true;
  }

  onDeleteConfirm(): void {
    if (!this.assignmentToDelete) return;

    const deletedId = this.assignmentToDelete.id;
    const departmentId = this.assignmentToDelete.departmentId;

    this.loading = true;
    this.errorMessage = null;
    this.showDeleteDialog = false;

    this.assignmentService.delete(this.assignmentToDelete.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<boolean>) => {
          if (response.succeeded) {
            this.translateService.get(['toast.assignmentDeleted', 'toast.success']).subscribe(translations => {
              this.toastService.success(translations['toast.assignmentDeleted'], translations['toast.success']);
            });
            // Update local state: remove only the deleted assignment instead of clearing all
            this.removeAssignmentFromCache(deletedId, departmentId);
            // Refresh department summaries for accurate counts
            this.refreshDepartmentSummaries();
          } else {
            this.translateService.get(['toast.failedToDeleteAssignment', 'toast.error']).subscribe(translations => {
              this.toastService.error(
                response.message || translations['toast.failedToDeleteAssignment'],
                translations['toast.error']
              );
            });
          }
          this.loading = false;
          this.assignmentToDelete = undefined;
        },
        error: (err) => {
          let errorMessage = 'Failed to delete assignment';
          if (err?.userMessage) {
            errorMessage = err.userMessage;
          } else if (err?.message) {
            errorMessage = err.message;
          } else if (err?.error?.message) {
            errorMessage = err.error.message;
          }

          this.translateService.get('toast.error').subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.loading = false;
          this.assignmentToDelete = undefined;
        }
      });
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.assignmentToDelete = undefined;
  }

  /** Remove a single assignment from local cache so the UI shows remaining items without full reload. */
  private removeAssignmentFromCache(assignmentId: number, departmentId: number): void {
    const deptAssignments = this.assignmentsByDepartment.get(departmentId);
    if (deptAssignments) {
      const updated = deptAssignments.filter(a => a.id !== assignmentId);
      this.assignmentsByDepartment.set(departmentId, updated);
    }
    this.assignments = this.assignments.filter(a => a.id !== assignmentId);
    this.cdr.detectChanges();
  }

  /** Refresh department summaries to keep counts (Ammunition, Explosives, Weapons) in sync. */
  private refreshDepartmentSummaries(): void {
    this.assignmentService.getDepartmentSummaries()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.succeeded && res.data) {
            this.departmentSummaries = res.data;
            this.filterSummariesBySearch();
          }
        }
      });
  }

  validateAssignment(): boolean {
    if (this.isEditMode) {
      return !!(this.currentAssignment.itemId && this.currentAssignment.departmentId);
    }
    const totalSelected = this.selectedAmmunitionIds.length + this.selectedWeaponIds.length + this.selectedExplosiveIds.length;
    return !!(totalSelected > 0 && this.currentAssignment.departmentId);
  }

  onItemSelectChange(itemId: number): void {
    // Sync with currentAssignment for edit mode
    if (this.isEditMode) {
      this.currentAssignment.itemId = itemId;
      this.selectedItemIds = itemId > 0 ? [itemId] : [];
    }
  }

  onMultipleItemsChange(itemIds: number[]): void {
    this.selectedItemIds = (itemIds || []).map(id => typeof id === 'string' ? parseInt(id, 10) : id).filter(id => !isNaN(id));
    this.cdr.detectChanges();
  }

  onAmmunitionChange(ids: number[]): void {
    this.selectedAmmunitionIds = (ids || []).map(id => typeof id === 'string' ? parseInt(id, 10) : id).filter(id => !isNaN(id));
    this.cdr.detectChanges();
  }

  onWeaponsChange(ids: number[]): void {
    this.selectedWeaponIds = (ids || []).map(id => typeof id === 'string' ? parseInt(id, 10) : id).filter(id => !isNaN(id));
    this.cdr.detectChanges();
  }

  onExplosivesChange(ids: number[]): void {
    this.selectedExplosiveIds = (ids || []).map(id => typeof id === 'string' ? parseInt(id, 10) : id).filter(id => !isNaN(id));
    this.cdr.detectChanges();
  }

  onDepartmentChange(departmentId: number | string | null): void {
    const deptId = departmentId == null ? 0 : (typeof departmentId === 'string' ? parseInt(departmentId, 10) : Number(departmentId));

    this.availableItems = [...this.allItems];
    this.items = [...this.allItems];

    if (deptId <= 0 || isNaN(deptId)) {
      this.currentAssignment.departmentId = null;
      this.selectedItemIds = [];
      this.selectedAmmunitionIds = [];
      this.selectedWeaponIds = [];
      this.selectedExplosiveIds = [];
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      return;
    }

    const runSelections = () => {
      const departmentAssignments = this.assignmentsByDepartment.get(deptId) || [];
      const assignedItemIds = departmentAssignments.map(a => Number(a.itemId));
      const newSelectedIds = assignedItemIds
        .filter(id => this.allItems.some(item => Number(item.id) === id && !isNaN(id) && id > 0));
      this.selectedItemIds = [...newSelectedIds].sort((a, b) => a - b);
      this.selectedAmmunitionIds = departmentAssignments
        .filter(a => this.isAmmunitionType(a.itemType))
        .map(a => Number(a.itemId))
        .filter(id => this.allItems.some((item: any) => Number(item.id) === id));
      this.selectedWeaponIds = departmentAssignments
        .filter(a => this.isWeaponType(a.itemType))
        .map(a => Number(a.itemId))
        .filter(id => this.allItems.some((item: any) => Number(item.id) === id));
      this.selectedExplosiveIds = departmentAssignments
        .filter(a => this.isExplosiveType(a.itemType))
        .map(a => Number(a.itemId))
        .filter(id => this.allItems.some((item: any) => Number(item.id) === id));
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      setTimeout(() => {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }, 50);
    };

    if (this.assignmentsByDepartment.has(deptId)) {
      runSelections();
    } else {
      this.loadAssignmentsForDepartment(deptId, runSelections);
    }
  }

  private getEmptyAssignment(): Omit<CreateUpdateItemDepartmentAssignmentDto, 'departmentId'> & { departmentId: number | null } {
    return {
      itemId: 0,
      departmentId: null,
      notes: ''
    };
  }

  getItemName(itemId: number): string {
    const item = this.items.find(i => i.id === itemId);
    return item?.name || '';
  }

  getItemNo(itemId: number): string {
    const item = this.items.find(i => i.id === itemId);
    return item?.itemNo || '';
  }

  getDepartmentName(departmentId: number): string {
    const dept = this.departments.find((d: any) => d.id === departmentId);
    if (!dept) return '';
    return getLocalizedName(dept, getCurrentLang(this.translateService)) || '';
  }

  getItemTypeName(itemType: number | string | undefined): string {
    // Handle undefined or null
    if (itemType === undefined || itemType === null) {
      return 'Unknown';
    }

    // If it's already a string (backend sends "Ammunition", "Weapon", "Explosive")
    if (typeof itemType === 'string') {
      const normalized = itemType.trim();
      // Check if it's already a valid type name
      if (normalized === 'Ammunition' || normalized === 'Weapon' || normalized === 'Explosive') {
        return normalized;
      }
      // If it's a number as string, convert it and recurse
      const numValue = parseInt(normalized, 10);
      if (!isNaN(numValue)) {
        return this.getItemTypeName(numValue);
      }
      // Return the string as-is or Unknown
      return normalized || 'Unknown';
    }

    // Handle number type (1 = Ammunition, 2 = Weapon, 3 = Explosive)
    if (typeof itemType === 'number') {
      switch (itemType) {
        case 1: return 'Ammunition';
        case 2: return 'Weapon';
        case 3: return 'Explosive';
        default: return 'Unknown';
      }
    }

    return 'Unknown';
  }

  // Helper methods for template
  getLocalizedName(dept: any): string {
    return getLocalizedName(dept, getCurrentLang(this.translateService)) || '';
  }

  /** Label for department option in app-dropdown (bound to preserve this). */
  getDepartmentOptionLabel = (option: any): string => this.getLocalizedName(option);

  /** Display name for a department summary row (from summary API). */
  getSummaryDepartmentName(summary: DepartmentAssignmentSummaryDto): string {
    const lang = getCurrentLang(this.translateService);
    if (lang === 'ar' && summary.departmentNameAr) return summary.departmentNameAr;
    return summary.departmentNameEn || summary.departmentNameAr || '';
  }

  getCurrentLang(): string {
    return getCurrentLang(this.translateService);
  }

  getItemNSN(itemId: number): string {
    const item = this.allItems.find(i => i.id === itemId);
    return item?.nsn || '-';
  }

  getItemPartNo(itemId: number): string {
    const item = this.allItems.find(i => i.id === itemId);
    return item?.partNo || '-';
  }

  /** Map assignment itemType to asset-list tab query param (ammunition | weapon | explosive). */
  getAssetDetailsTab(itemType: number | string | undefined): 'ammunition' | 'weapon' | 'explosive' | null {
    if (itemType === undefined || itemType === null) return null;
    if (typeof itemType === 'string') {
      const n = (itemType as string).trim().toLowerCase();
      if (n === 'ammunition') return 'ammunition';
      if (n === 'weapon') return 'weapon';
      if (n === 'explosive') return 'explosive';
      return null;
    }
    switch (itemType as number) {
      case 1: return 'ammunition';
      case 2: return 'weapon';
      case 3: return 'explosive';
      default: return null;
    }
  }

  navigateToAssetDetails(assignment: ItemDepartmentAssignmentDto): void {
    const tab = this.getAssetDetailsTab(assignment.itemType);
    const queryParams: { tab?: string; returnTo: string } = { returnTo: '/item-department-assignment' };
    if (tab) {
      queryParams.tab = tab;
    }
    this.router.navigate(['/asset-list', assignment.itemId], { queryParams });
  }
}
