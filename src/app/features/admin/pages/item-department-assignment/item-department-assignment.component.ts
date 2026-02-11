import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, Plus, Edit, Trash2, X, Search, ChevronDown, ChevronRight } from 'lucide-angular';
import { LookupService } from '@services/lookup.service';
import { ItemDepartmentAssignmentService } from '@services/item-department-assignment.service';
import { ItemDepartmentAssignmentDto, CreateUpdateItemDepartmentAssignmentDto } from '@models/item-department-assignment.model';
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
  filteredDepartments: any[] = []; // Departments filtered by search
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
  currentAssignment: CreateUpdateItemDepartmentAssignmentDto = this.getEmptyAssignment();
  selectedItemIds: number[] = []; // For multiple item selection

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
      assignments: this.assignmentService.getAll(),
      departments: this.lookupService.getDepartments(),
      ammunition: this.ammunitionService.getAll<BaseItemDto>(),
      weapons: this.weaponService.getAll<BaseItemDto>(),
      explosives: this.explosiveService.getAll<BaseItemDto>()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          // Load departments first
          if (results.departments) {
            this.departments = results.departments.filter((d: any) => !d.isDeleted);
          }

          // Load assignments and group by department
          if (results.assignments.succeeded && results.assignments.data) {
            this.assignments = results.assignments.data;
            this.groupAssignmentsByDepartment();
            this.applyFilters();
          } else {
            // If no assignments, still filter departments
            this.filterDepartmentsBySearch();
          }

          // Combine all items
          this.allItems = [
            ...(results.ammunition || []),
            ...(results.weapons || []),
            ...(results.explosives || [])
          ].filter((item: any) => !item.isDeleted);
          
          // Format items for dropdown (with display label)
          this.allItems = this.allItems.map((item: any) => ({
            ...item,
            displayLabel: `${item.name} (${item.itemNo})`
          }));

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
    let filtered = [...this.assignments];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(a => {
        const itemName = (a.itemName || '').toLowerCase();
        const itemNo = (a.itemNo || '').toLowerCase();
        const deptNameAr = (a.departmentNameAr || '').toLowerCase();
        const deptNameEn = (a.departmentNameEn || '').toLowerCase();
        const deptCode = (a.departmentCode || '').toLowerCase();
        return itemName.includes(term) || itemNo.includes(term) ||
               deptNameAr.includes(term) || deptNameEn.includes(term) ||
               deptCode.includes(term);
      });
    }

    this.filteredAssignments = filtered;
    this.groupAssignmentsByDepartment();
    this.filterDepartmentsBySearch();
    this.currentPage = 1; // Reset to first page when filters change
  }

  filterDepartmentsBySearch(): void {
    if (!this.searchTerm) {
      // Show all departments that have assignments
      this.filteredDepartments = this.departments.filter(dept => 
        this.assignmentsByDepartment.has(dept.id) && 
        this.getDepartmentAssignmentCount(dept.id) > 0
      );
    } else {
      // Filter departments that have matching assignments
      const matchingDeptIds = new Set<number>();
      this.filteredAssignments.forEach(assignment => {
        matchingDeptIds.add(assignment.departmentId);
      });
      this.filteredDepartments = this.departments.filter(dept => 
        matchingDeptIds.has(dept.id)
      );
    }
  }

  toggleDepartmentItems(departmentId: number): void {
    if (this.expandedDepartments.has(departmentId)) {
      this.expandedDepartments.delete(departmentId);
    } else {
      this.expandedDepartments.add(departmentId);
    }
  }

  isDepartmentExpanded(departmentId: number): boolean {
    return this.expandedDepartments.has(departmentId);
  }

  getDepartmentAssignments(departmentId: number): ItemDepartmentAssignmentDto[] {
    return this.assignmentsByDepartment.get(departmentId) || [];
  }

  /** Departments to show on the current page (for pagination). */
  get paginatedDepartments(): any[] {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    const end = start + this.rowsPerPage;
    return this.filteredDepartments.slice(start, end);
  }

  get totalPages(): number {
    const total = this.filteredDepartments.length;
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

  onSearch(): void {
    this.applyFilters();
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentAssignment = this.getEmptyAssignment();
    this.selectedItemIds = [];
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
      this.assignmentService.update(this.currentAssignmentId, this.currentAssignment)
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
      // Add mode: create multiple assignments for selected items
      const assignmentsToCreate: CreateUpdateItemDepartmentAssignmentDto[] = this.selectedItemIds
        .filter(itemId => itemId > 0)
        .map(itemId => ({
          itemId: itemId,
          departmentId: this.currentAssignment.departmentId,
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
            this.loadData();
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

  validateAssignment(): boolean {
    if (this.isEditMode) {
      return !!(this.currentAssignment.itemId && this.currentAssignment.departmentId);
    } else {
      return !!(this.selectedItemIds.length > 0 && this.currentAssignment.departmentId);
    }
  }

  onItemSelectChange(itemId: number): void {
    // Sync with currentAssignment for edit mode
    if (this.isEditMode) {
      this.currentAssignment.itemId = itemId;
      this.selectedItemIds = itemId > 0 ? [itemId] : [];
    }
  }

  onMultipleItemsChange(itemIds: number[]): void {
    // Handle multiple selection change from dropdown
    // Ensure all IDs are numbers for proper comparison
    this.selectedItemIds = (itemIds || []).map(id => typeof id === 'string' ? parseInt(id, 10) : id).filter(id => !isNaN(id));
    this.cdr.detectChanges();
  }

  onDepartmentChange(departmentId: number | string): void {
    // Convert to number if string (from select element)
    const deptId = typeof departmentId === 'string' ? parseInt(departmentId, 10) : Number(departmentId);
    
    // When department changes, show all items and pre-check items already assigned to that department
    if (deptId > 0 && !isNaN(deptId)) {
      // Show all items
      this.availableItems = [...this.allItems]; // Create new array reference
      this.items = [...this.allItems];
      
      // Get all items already assigned to this department and pre-select them
      const departmentAssignments = this.assignments.filter(a => {
        // Both are numbers, ensure they match
        return Number(a.departmentId) === deptId;
      });
      
      const assignedItemIds = departmentAssignments.map(a => Number(a.itemId));
      
      // Pre-select items that are already assigned to the selected department
      // Ensure all IDs are numbers for proper comparison and create new array reference
      const newSelectedIds = assignedItemIds
        .filter(id => {
          // Check if item exists in allItems
          const exists = this.allItems.some(item => {
            const itemId = Number(item.id);
            return itemId === id && !isNaN(itemId);
          });
          return exists && !isNaN(id) && id > 0;
        });
      
      // Create new array reference to trigger change detection
      // Sort to ensure consistent order
      this.selectedItemIds = [...newSelectedIds].sort((a, b) => a - b);
      
      // Force change detection immediately and after a brief delay
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      
      // Also trigger after a delay to ensure dropdown component receives the update
      setTimeout(() => {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }, 50);
    } else {
      // If no department selected, show all items and clear selection
      this.availableItems = [...this.allItems];
      this.items = [...this.allItems];
      this.selectedItemIds = [];
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }
  }

  private getEmptyAssignment(): CreateUpdateItemDepartmentAssignmentDto {
    return {
      itemId: 0,
      departmentId: 0,
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
