import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LucideAngularModule, Plus, Edit2, Trash2, Search, X } from 'lucide-angular';
import { ApiService } from '@services/api.service';
import { LookupService, DepartmentDto } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { AmmunitionService } from '@services/ammunition.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponService } from '@services/weapon.service';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveService } from '@services/explosive.service';
import { ExplosiveDto } from '@models/explosive.model';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ApiResponse } from '@models/api-response.model';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { AllowanceItemDto, AllowanceTableRow } from '@models/allowance.model';
import { processAllowanceData } from '@utils/allowance.mapper';
import { filterAllowances } from '@utils/allowance.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { BackendAuthService } from '@services/backend-auth.service';
import { UserContextService } from '@services/user-context.service';
import { ItemType } from '@core/models/inventory.model';

@Component({
  selector: 'app-allowance-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    DropdownComponent,
    ConfirmDialogComponent,
    RowsPerPageComponent,
    PaginationComponent,
    HasPermissionDirective,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './allowance-list.component.html',
  styleUrls: ['./allowance-list.component.css']
})
export class AllowanceListComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly Search = Search;
  readonly X = X;

  allowances: AllowanceTableRow[] = []; // Individual item rows
  allAllowances: AllowanceTableRow[] = []; // All allowances for pagination
  filteredAllowances: AllowanceTableRow[] = []; // Filtered allowances
  loading = true;
  error: string | null = null;

  // Filter dropdowns
  departments: LookupItem[] = [];
  filteredDepartments: LookupItem[] = []; // Filtered departments based on user permissions
  selectedDepartment: number | string | null = null;
  isAdminUser = false;
  userDepartmentId: number | null = null;
  allItems: (AmmunitionReadDto | WeaponDto | ExplosiveDto)[] = []; // All items from API
  ammunitionItems: AmmunitionReadDto[] = []; // Ammunition items
  weaponItems: WeaponDto[] = []; // Weapon items
  explosiveItems: ExplosiveDto[] = []; // Explosive items
  filteredItems: (AmmunitionReadDto | WeaponDto | ExplosiveDto)[] = []; // Items filtered by selected type and department
  selectedItem: number | string | null = null;
  selectedItemType: ItemType | null = null; // Filter by item type: Ammunition, Weapon, or Explosive
  itemTypeOptions: { value: ItemType | null; label: string }[] = []; // Item type dropdown options

  // Dropdown label functions
  readonly departmentOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    getLocalizedName(this.unwrapOption(option), getCurrentLang(this.translateService));
  readonly itemOptionLabel = (option: DropdownOption<AmmunitionReadDto | WeaponDto | ExplosiveDto> | AmmunitionReadDto | WeaponDto | ExplosiveDto | null) => {
    const item = this.unwrapOption(option);
    if (!item) return '';
    const localizedName = getLocalizedName(item as any, getCurrentLang(this.translateService));
    return localizedName || (item as any).itemNo || `Item ${(item as any).id}`;
  };
  readonly itemTypeOptionLabel = (option: DropdownOption<{ value: ItemType | null; label: string }> | { value: ItemType | null; label: string } | null) => {
    const itemType = this.unwrapOption(option);
    return itemType?.label || '';
  };

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;
  totalItems = 0;

  // Delete dialog state
  showDeleteDialog = false;
  selectedAllowance: AllowanceTableRow | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private router: Router,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private toastService: ToastService,
    private backendAuthService: BackendAuthService,
    private userContextService: UserContextService
  ) {
    // Initialize user context
    this.initializeUserContext();
  }

  private initializeUserContext(): void {
    // Check if user can view all departments (SuperAdmin or has permission)
    const hasPermission = this.backendAuthService.hasPermission('AllowanceItemViewAllDepartments');
    // Align with backend: Only SuperAdmin or explicit permission grants view all
    this.isAdminUser = this.backendAuthService.isSuperAdmin() || hasPermission;

    // Get user's department ID
    const currentUser = this.backendAuthService.getCurrentUser();
    if (currentUser?.departmentId) {
      this.userDepartmentId = currentUser.departmentId;

      // Pre-select user's department for non-admin users
      if (!this.isAdminUser) {
        this.selectedDepartment = currentUser.departmentId;
      }
    }
  }

  ngOnInit(): void {
    this.initializeItemTypeOptions();
    this.loadAllowances();

    // Subscribe to language changes to reload allowances with new localized names
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.initializeItemTypeOptions();
        this.loadAllowances();
      });
  }

  private initializeItemTypeOptions(): void {
    const currentLang = getCurrentLang(this.translateService);
    this.itemTypeOptions = [
      { value: null, label: this.translateService.instant('allowance.allItems') || 'All Items' },
      { value: ItemType.Ammunition, label: this.translateService.instant('allowance.ammunition') || 'Ammunition' },
      { value: ItemType.Weapon, label: this.translateService.instant('allowance.weapon') || 'Weapon' },
      { value: ItemType.Explosive, label: this.translateService.instant('allowance.explosive') || 'Explosive' }
    ];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  loadAllowances(): void {
    this.loading = true;
    this.error = null;

    // The backend service automatically checks AllowanceItemViewAllDepartments permission
    // and returns all departments' data if user has permission, or only their department if not
    forkJoin({
      allowances: this.apiService.getWithAuth<ApiResponse<AllowanceItemDto[]>>(
        API_ENDPOINTS.ALLOWANCE.BASE
      ),
      departments: this.lookupService.getDepartments(),
      ammunitionItems: this.ammunitionService.getAll<AmmunitionReadDto>().pipe(catchError(() => of([]))),
      weaponItems: this.weaponService.getAll<WeaponDto>().pipe(catchError(() => of([]))),
      explosiveItems: this.explosiveService.getAll<ExplosiveDto>().pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ allowances, departments, ammunitionItems, weaponItems, explosiveItems }) => {
          if (allowances.succeeded && allowances.data) {
            this.processAllowanceData(allowances.data, departments, ammunitionItems || [], weaponItems || [], explosiveItems || []);
          } else {
            this.error = allowances.message || this.translateService.instant('allowance.errors.failedToLoad');
            this.loading = false;
          }
        },
        error: (error) => {
          // Handle 403 Forbidden (authorization errors)
          if (error?.status === 403) {
            this.error = this.translateService.instant('allowance.errors.unauthorizedAccess');
          } else {
            this.error = this.translateService.instant('allowance.errors.failedToLoad');
          }
          this.loading = false;
        }
      });
  }

  private processAllowanceData(items: AllowanceItemDto[], departments: DepartmentDto[], ammunitionItems: AmmunitionReadDto[], weaponItems: WeaponDto[], explosiveItems: ExplosiveDto[]): void {
    const currentLang = getCurrentLang(this.translateService);
    const processed = processAllowanceData(items, departments, ammunitionItems, weaponItems, explosiveItems, currentLang);

    this.departments = processed.departments;

    // Filter departments for non-admin users
    if (!this.isAdminUser && this.userDepartmentId !== null) {
      // Non-admin users can only see their own department in the filter
      this.filteredDepartments = processed.departments.filter(dept => dept.id === this.userDepartmentId);
    } else {
      // Admin users can see all departments
      this.filteredDepartments = processed.departments;
    }

    // Store items separately by type
    this.ammunitionItems = ammunitionItems || [];
    this.weaponItems = weaponItems || [];
    this.explosiveItems = explosiveItems || [];
    this.allItems = processed.allItems;
    
    // Update filtered items based on selected item type
    this.updateFilteredItems();
    this.allAllowances = processed.allAllowances;
    this.filteredAllowances = [...this.allAllowances];

    this.currentPage = 1;
    this.validateCurrentPage();
    this.updatePagination();
    this.loading = false;
  }

  unwrapOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (option === null || option === undefined) return null;
    if (typeof option === 'object' && 'value' in option) {
      return (option as DropdownOption<T>).value;
    }
    return option as T;
  }


  onDepartmentChange(): void {
    this.selectedItem = null; // Clear item selection when department changes
    this.updateFilteredItems();
    this.currentPage = 1;
    this.applyFilters();
  }

  onItemTypeChange(): void {
    this.selectedItem = null; // Clear item selection when item type changes
    this.updateFilteredItems();
    this.currentPage = 1;
    this.applyFilters();
  }

  updateFilteredItems(): void {
    // Filter items based on selected item type
    if (this.selectedItemType === null) {
      // Show all items
      this.filteredItems = [...this.allItems];
    } else if (this.selectedItemType === ItemType.Ammunition) {
      this.filteredItems = [...this.ammunitionItems];
    } else if (this.selectedItemType === ItemType.Weapon) {
      this.filteredItems = [...this.weaponItems];
    } else if (this.selectedItemType === ItemType.Explosive) {
      this.filteredItems = [...this.explosiveItems];
    } else {
      this.filteredItems = [...this.allItems];
    }
  }

  onItemChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  clearDepartmentFilter(): void {
    // Prevent non-admin users from clearing department filter
    if (!this.isAdminUser && this.userDepartmentId !== null) {
      return;
    }

    this.selectedDepartment = null;
    this.currentPage = 1;
    this.updateFilteredItems();
    this.applyFilters();
  }

  clearItemFilter(): void {
    this.selectedItem = null;
    this.currentPage = 1;
    this.applyFilters();
  }

  clearItemTypeFilter(): void {
    this.selectedItemType = null;
    this.selectedItem = null; // Clear item selection when clearing type filter
    this.currentPage = 1;
    this.updateFilteredItems();
    this.applyFilters();
  }

  clearAllFilters(): void {
    this.selectedDepartment = null;
    this.selectedItem = null;
    this.selectedItemType = null;
    this.currentPage = 1;
    this.updateFilteredItems();
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredAllowances = filterAllowances(
      this.allAllowances,
      this.selectedDepartment,
      this.selectedItem,
      this.selectedItemType
    );
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalItems = this.filteredAllowances.length;
    this.validateCurrentPage();
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    const endIndex = startIndex + this.rowsPerPage;
    this.allowances = this.filteredAllowances.slice(startIndex, endIndex);
  }

  private validateCurrentPage(): void {
    const maxPages = this.totalPages;
    if (this.currentPage > maxPages && maxPages > 0) {
      this.currentPage = maxPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  onPageChange(page: number): void {
    const maxPages = this.totalPages;
    if (page < 1 || page > maxPages || maxPages === 0) {
      return;
    }
    this.currentPage = page;
    this.updatePagination();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.validateCurrentPage();
    this.updatePagination();
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  onAddAllowance(): void {
    this.router.navigate(['/allowance/add']);
  }

  formatDate(year: number): string {
    return `${year}`;
  }


  onEdit(allowance: AllowanceTableRow): void {
    // Verify user has permission to edit this allowance
    if (!this.isAdminUser && this.userDepartmentId !== null && allowance.departmentId !== this.userDepartmentId) {
      this.translateService.get(['toast.error', 'allowance.errors.unauthorizedAccess']).subscribe(translations => {
        this.toastService.error(translations['allowance.errors.unauthorizedAccess'], translations['toast.error']);
      });
      return;
    }

    this.router.navigate(['/allowance/add'], {
      queryParams: {
        departmentId: allowance.departmentId,
        year: allowance.year,
        itemId: allowance.itemId,
        itemType: allowance.itemType,
        edit: 'true'
      }
    });
  }

  onDelete(allowance: AllowanceTableRow): void {

    this.selectedAllowance = {
      id: allowance.id,
      departmentId: allowance.departmentId,
      departmentName: allowance.departmentName,
      year: allowance.year,
      itemId: allowance.itemId,
      itemName: allowance.itemName || allowance.itemNo || `Item ${allowance.itemId}`,
      quantity: allowance.quantity,
      usedQuantityFromAllowance: allowance.usedQuantityFromAllowance,
      reservedQuantityByDraftSupplies: allowance.reservedQuantityByDraftSupplies,
      remainingQuantityFromAllowance: allowance.remainingQuantityFromAllowance,
      isSingleItem: true
    } as any;
    this.showDeleteDialog = true;
  }

  onDeleteConfirm(): void {
    if (!this.selectedAllowance) return;


    const isSingleItem = (this.selectedAllowance as any).isSingleItem;

    if (isSingleItem) {

      const itemId = (this.selectedAllowance as any).id;
      const endpoint = `${API_ENDPOINTS.ALLOWANCE.BASE}/${itemId}`;

      this.apiService.deleteWithAuth<any>(endpoint)
        .pipe(
          takeUntil(this.destroy$),
          catchError((err: any) => {
            const isNotFound = err?.status === 404 || err?.message === 'Resource not found.';
            if (isNotFound) {

              return of({ ok: true, notFound: true });
            }
            return of({ ok: false, error: err });
          })
        )
        .subscribe({
          next: (result: any) => {
            if (result && result.ok === false) {
              const errorMessage = result.error?.error?.message || result.error?.message || this.translateService.instant('allowance.failedToDeleteItem');
              this.translateService.get(['toast.error', 'allowance.failedToDeleteItem']).subscribe(tr => {
                this.toastService.error(errorMessage, tr['toast.error']);
              });
            } else {
              this.translateService.get(['toast.success', 'allowance.itemDeletedSuccessfully']).subscribe(tr => {
                this.toastService.success(tr['allowance.itemDeletedSuccessfully'], tr['toast.success']);
              });
            }

            this.showDeleteDialog = false;
            this.selectedAllowance = null;
            this.loadAllowances();
          },
          error: (error: any) => {
            this.translateService.get(['toast.error', 'allowance.failedToDeleteItem']).subscribe(tr => {
              this.toastService.error(tr['allowance.failedToDeleteItem'], tr['toast.error']);
            });
            this.showDeleteDialog = false;
            this.selectedAllowance = null;
          }
        });
    } else {

      const deptId = this.selectedAllowance.departmentId;
      const year = this.selectedAllowance.year;


      this.apiService.getWithAuth<ApiResponse<AllowanceItemDto[]>>(API_ENDPOINTS.ALLOWANCE.BASE)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (resp) => {
            const all = resp?.data || [];
            const ids = all.filter(i => i.departmentId === deptId && i.year === year).map(i => i.id);

            if (ids.length === 0) {

              this.translateService.get(['toast.success', 'allowance.alreadyDeleted']).subscribe(tr => {
                this.toastService.success(tr['allowance.alreadyDeleted'], tr['toast.success']);
              });
              this.showDeleteDialog = false;
              this.selectedAllowance = null;
              this.loadAllowances();
              return;
            }

            const deleteObservables = ids.map(id => {
              const endpoint = `${API_ENDPOINTS.ALLOWANCE.BASE}/${id}`;
              return this.apiService.deleteWithAuth<any>(endpoint).pipe(
                catchError((err: any) => {
                  const isNotFound = err?.status === 404 || err?.message === 'Resource not found.';
                  if (isNotFound) return of({ ok: true, id, notFound: true });
                  return of({ ok: false, id, error: err });
                })
              );
            });

            forkJoin(deleteObservables)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (results: any[]) => {
                  const hasHardError = results.some(r => r && r.ok === false);
                  if (hasHardError) {
                    const firstErr = results.find(r => r && r.ok === false)?.error;
                    const errorMessage = firstErr?.error?.message || firstErr?.message || this.translateService.instant('allowance.failedToDelete');
                    this.translateService.get(['toast.error', 'allowance.failedToDelete']).subscribe(tr => {
                      this.toastService.error(errorMessage, tr['toast.error']);
                    });
                  } else {
                    this.translateService.get(['toast.success', 'allowance.deletedSuccessfully']).subscribe(tr => {
                      this.toastService.success(tr['allowance.deletedSuccessfully'], tr['toast.success']);
                    });
                  }

                  this.showDeleteDialog = false;
                  this.selectedAllowance = null;
                  this.loadAllowances();
                },
                error: () => {
                  this.translateService.get(['toast.error', 'allowance.failedToDelete']).subscribe(tr => {
                    this.toastService.error(tr['allowance.failedToDelete'], tr['toast.error']);
                  });
                  this.showDeleteDialog = false;
                }
              });
          },
          error: () => {
            this.translateService.get(['toast.error', 'allowance.failedToLoadForDeletion']).subscribe(tr => {
              this.toastService.error(tr['allowance.failedToLoadForDeletion'], tr['toast.error']);
            });
            this.showDeleteDialog = false;
          }
        });
    }
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.selectedAllowance = null;
  }
}

