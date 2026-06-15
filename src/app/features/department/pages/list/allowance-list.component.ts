import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LucideAngularModule, Plus, Edit2, Trash2, Search, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-angular';
import { ApiService } from '@services/api.service';
import { LookupService, DepartmentDto } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponService } from '@assets/services/weapon.service';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveService } from '@assets/services/explosive.service';
import { ExplosiveDto } from '@models/explosive.model';
import { API_ENDPOINTS, defaultPageSize } from '@constants/app.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import {
  PaginationComponent,
  RowsPerPageComponent,
  LoadingStateComponent,
  ErrorStateComponent,
  TableClampTooltipDirective
} from '@components/index';
import { AllowanceItemDto, AllowanceTableRow } from '@models/allowance.model';
import { TranslationMap } from '@models/common.types';
import { processAllowanceData } from '@utils/allowance.mapper';
import { filterAllowances } from '@utils/allowance.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { BackendAuthService } from '@services/backend-auth.service';
import { UserContextService } from '@services/user-context.service';
import { ItemType } from '@core/models/inventory.model';
import { trackById } from '@utils/trackby.utils';
import { ErrorHandler } from '@utils/error-handler.utils';

/** Sortable allowance quantity columns (desktop headers + optional mobile toolbar). */
type QuantitySortColumn = 'total' | 'used' | 'reserved' | 'remaining';

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
    ErrorStateComponent,
    TableClampTooltipDirective
  ],
  templateUrl: './allowance-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllowanceListComponent implements OnInit, OnDestroy {
  readonly PERMISSIONS = PERMISSIONS;

  readonly Plus = Plus;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly Search = Search;
  readonly X = X;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;

  readonly trackById = trackById;

  readonly quantitySortColumnDefs = [
    { key: 'total' as QuantitySortColumn, labelKey: 'allowance.table.totalQuantity' },
    { key: 'used' as QuantitySortColumn, labelKey: 'allowance.table.usedQuantity' },
    { key: 'reserved' as QuantitySortColumn, labelKey: 'allowance.table.reservedQuantity' },
    { key: 'remaining' as QuantitySortColumn, labelKey: 'allowance.table.remainingQuantity' }
  ];

  /** Active quantity sort (applied after sidebar filters); `null` keeps API/order from filter only. */
  quantitySortColumn: QuantitySortColumn | null = null;
  quantitySortDirection: 'asc' | 'desc' = 'desc';

  allowances: AllowanceTableRow[] = []; // Individual item rows
  allAllowances: AllowanceTableRow[] = []; // All allowances for pagination
  filteredAllowances: AllowanceTableRow[] = []; // Filtered allowances
  loading = true;
  error: string | null = null;

  // Filter dropdowns
  departments: LookupItem[] = [];
  filteredDepartments: LookupItem[] = []; // Filtered departments based on user permissions
  selectedDepartment: number | null = null;
  isAdminUser = false;
  userDepartmentId: number | null = null;
  allItems: (AmmunitionReadDto | WeaponDto | ExplosiveDto)[] = []; // Full catalog snapshot from mapper (dropdown uses filteredItems — items with allowances only)
  ammunitionItems: AmmunitionReadDto[] = []; // Ammunition items
  weaponItems: WeaponDto[] = []; // Weapon items
  explosiveItems: ExplosiveDto[] = []; // Explosive items
  filteredItems: (AmmunitionReadDto | WeaponDto | ExplosiveDto)[] = []; // Items filtered by selected type and department
  selectedItem: number | null = null;
  selectedItemType: ItemType | null = null; // Filter by item type: Ammunition, Weapon, or Explosive
  itemTypeOptions: { value: ItemType | null; label: string }[] = []; // Item type dropdown options

  /**
   * (itemType, itemId) for rows that appear in loaded allowance data, scoped by department filter when set.
   * Used so the item dropdown lists only catalog items that have at least one matching allowance row (no extra API).
   */
  private allowanceItemLookupKeys = new Set<string>();

  // Dropdown label functions
  readonly departmentOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    getLocalizedName(this.unwrapOption(option), getCurrentLang(this.translateService));
  readonly itemOptionLabel = (option: DropdownOption<AmmunitionReadDto | WeaponDto | ExplosiveDto> | AmmunitionReadDto | WeaponDto | ExplosiveDto | null) => {
    const item = this.unwrapOption(option);
    if (!item) return '';
    const localizedName = getLocalizedName(item, getCurrentLang(this.translateService));
    return localizedName || item.itemNo || `Item ${item.id}`;
  };
  readonly itemTypeOptionLabel = (option: DropdownOption<{ value: ItemType | null; label: string }> | { value: ItemType | null; label: string } | null) => {
    const itemType = this.unwrapOption(option);
    return itemType?.label || '';
  };

  // Pagination
  currentPage = 1;
  rowsPerPage = defaultPageSize;
  totalItems = 0;

  // Delete dialog state
  showDeleteDialog = false;
  selectedAllowance: (AllowanceTableRow & { isSingleItem?: boolean }) | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private router: Router,
    private route: ActivatedRoute,
    private translateService: TranslateService,
    private translationService: TranslationService,
    private toastService: ToastService,
    private backendAuthService: BackendAuthService,
    private userContextService: UserContextService,
    private cdr: ChangeDetectorRef
  ) {
    // Initialize user context
    this.initializeUserContext();
  }

  private initializeUserContext(): void {
    // Check if user can view all departments (SuperAdmin or has permission)
    const hasPermission = this.backendAuthService.hasPermission(PERMISSIONS.DEPARTMENT.ALLOWANCE_VIEW_ALL_DEPARTMENTS);
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
    this.syncPageFromQueryParams();
    this.setupQueryParamsSync();
    this.loadAllowances();

    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.initializeItemTypeOptions();
        this.loadAllowances();
        this.cdr.markForCheck();
      });
  }

  /** Read page from URL query params (Angular best practice: URL reflects state) */
  private syncPageFromQueryParams(): void {
    const page = this.route.snapshot.queryParamMap.get('page');
    if (page) {
      const parsed = parseInt(page, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        this.currentPage = parsed;
      }
    }
  }

  /** Sync page changes to URL so pagination persists across navigation */
  private setupQueryParamsSync(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const page = params['page'];
      if (page) {
        const parsed = parseInt(page, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed !== this.currentPage) {
          this.currentPage = parsed;
          this.updatePagination();
          this.cdr.markForCheck();
        }
      }
    });
  }

  /** Update URL with current page (preserves other query params) */
  private updatePageInUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: this.currentPage > 1 ? this.currentPage : null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private initializeItemTypeOptions(): void {
    const _currentLang = getCurrentLang(this.translateService);
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
    this.cdr.markForCheck();

    // The backend service automatically checks AllowanceItemViewAllDepartments permission
    // and returns all departments' data if user has permission, or only their department if not
    forkJoin({
      allowances: this.apiService.get<AllowanceItemDto[]>(API_ENDPOINTS.ALLOWANCE.BASE),
      departments: this.lookupService.getDepartments(),
      ammunitionItems: this.ammunitionService.getAll<AmmunitionReadDto>().pipe(catchError(() => of([]))),
      weaponItems: this.weaponService.getAll<WeaponDto>().pipe(catchError(() => of([]))),
      explosiveItems: this.explosiveService.getAll<ExplosiveDto>().pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ allowances, departments, ammunitionItems, weaponItems, explosiveItems }) => {
          if (allowances && Array.isArray(allowances)) {
            this.processAllowanceData(allowances, departments, ammunitionItems || [], weaponItems || [], explosiveItems || []);
          } else {
            this.error = this.translateService.instant('allowance.errors.failedToLoad');
            this.loading = false;
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          // Handle 403 Forbidden (authorization errors)
          if (error?.status === 403) {
            this.error = this.translateService.instant('allowance.errors.unauthorizedAccess');
          } else {
            this.error = this.translateService.instant('allowance.errors.failedToLoad');
          }
          this.loading = false;
          this.cdr.markForCheck();
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

    // Store allowances first so item dropdown keys match current dataset
    this.allAllowances = processed.allAllowances;
    // Store items separately by type (still used for lookup labels); dropdown shows allowance-linked subset only
    this.ammunitionItems = ammunitionItems || [];
    this.weaponItems = weaponItems || [];
    this.explosiveItems = explosiveItems || [];
    this.allItems = processed.allItems;

    this.updateFilteredItems();

    this.applyFilters();
    this.updatePageInUrl();
    this.loading = false;
    this.cdr.markForCheck();
  }

  unwrapOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (option === null || option === undefined) return null;
    if (typeof option === 'object' && 'value' in option) {
      return (option as DropdownOption<T>).value;
    }
    return option as T;
  }


  private toFilterId(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const id = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(id) ? id : null;
  }

  onDepartmentChange(): void {
    this.selectedDepartment = this.toFilterId(this.selectedDepartment);
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

  private rebuildAllowanceItemLookupKeys(): void {
    this.allowanceItemLookupKeys.clear();
    let rows = this.allAllowances;
    const dept = this.selectedDepartment;
    if (dept !== null) {
      rows = rows.filter(
        (r) =>
          r.departmentId !== undefined &&
          r.departmentId !== null &&
          r.departmentId === dept
      );
    }
    for (const row of rows) {
      this.allowanceItemLookupKeys.add(`${row.itemType}-${row.itemId}`);
    }
  }

  /** Catalog row appears in allowance data (same itemType + id as backend rows). */
  private itemMatchesAllowanceCatalogRow(item: AmmunitionReadDto | WeaponDto | ExplosiveDto, itemType: ItemType): boolean {
    return this.allowanceItemLookupKeys.has(`${itemType}-${item.id}`);
  }

  updateFilteredItems(): void {
    this.rebuildAllowanceItemLookupKeys();

    const filterByAllowance = (items: AmmunitionReadDto[] | WeaponDto[] | ExplosiveDto[], type: ItemType) =>
      items.filter((i) => this.itemMatchesAllowanceCatalogRow(i, type));

    if (this.selectedItemType === null) {
      this.filteredItems = [
        ...filterByAllowance(this.ammunitionItems, ItemType.Ammunition),
        ...filterByAllowance(this.weaponItems, ItemType.Weapon),
        ...filterByAllowance(this.explosiveItems, ItemType.Explosive)
      ];
    } else if (this.selectedItemType === ItemType.Ammunition) {
      this.filteredItems = filterByAllowance(this.ammunitionItems, ItemType.Ammunition);
    } else if (this.selectedItemType === ItemType.Weapon) {
      this.filteredItems = filterByAllowance(this.weaponItems, ItemType.Weapon);
    } else if (this.selectedItemType === ItemType.Explosive) {
      this.filteredItems = filterByAllowance(this.explosiveItems, ItemType.Explosive);
    } else {
      this.filteredItems = [
        ...filterByAllowance(this.ammunitionItems, ItemType.Ammunition),
        ...filterByAllowance(this.weaponItems, ItemType.Weapon),
        ...filterByAllowance(this.explosiveItems, ItemType.Explosive)
      ];
    }
  }

  onItemChange(): void {
    this.selectedItem = this.toFilterId(this.selectedItem);
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
    const filtered = filterAllowances(
      this.allAllowances,
      this.selectedDepartment,
      this.selectedItem,
      this.selectedItemType
    );
    this.filteredAllowances = this.sortAllowancesByActiveQuantity(filtered);
    this.updatePagination();
    this.cdr.markForCheck();
  }

  onQuantitySort(column: QuantitySortColumn): void {
    if (this.quantitySortColumn === column) {
      this.quantitySortDirection = this.quantitySortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.quantitySortColumn = column;
      this.quantitySortDirection = 'desc';
    }
    this.applyFilters();
  }

  qtyAriaSort(column: QuantitySortColumn): 'none' | 'ascending' | 'descending' {
    if (this.quantitySortColumn !== column) return 'none';
    return this.quantitySortDirection === 'asc' ? 'ascending' : 'descending';
  }

  qtySortButtonAriaLabel(column: QuantitySortColumn): string {
    const def = this.quantitySortColumnDefs.find((d) => d.key === column);
    const columnLabel = def ? this.translateService.instant(def.labelKey) : String(column);
    if (this.quantitySortColumn !== column) {
      return this.translateService.instant('allowance.table.sortColumnAriaInactive', { column: columnLabel });
    }
    const directionLabel =
      this.quantitySortDirection === 'asc'
        ? this.translateService.instant('allowance.table.sortAscending')
        : this.translateService.instant('allowance.table.sortDescending');
    return this.translateService.instant('allowance.table.sortColumnAriaSorted', {
      column: columnLabel,
      direction: directionLabel
    });
  }

  getQtyNumericValue(row: AllowanceTableRow, column: QuantitySortColumn): number {
    switch (column) {
      case 'total':
        return Number(row.quantity) || 0;
      case 'used':
        return Number(row.usedQuantityFromAllowance) || 0;
      case 'reserved':
        return Number(row.reservedQuantityByOrdersOnProcessing) || 0;
      case 'remaining':
        return Number(row.remainingQuantityFromAllowance) || 0;
      default:
        return 0;
    }
  }

  private sortAllowancesByActiveQuantity(rows: AllowanceTableRow[]): AllowanceTableRow[] {
    if (!this.quantitySortColumn) return rows;
    const col = this.quantitySortColumn;
    const dir = this.quantitySortDirection === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = this.getQtyNumericValue(a, col);
      const vb = this.getQtyNumericValue(b, col);
      const diff = va - vb;
      if (diff !== 0) return diff * dir;
      return a.id - b.id;
    });
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
    this.updatePageInUrl();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.validateCurrentPage();
    this.updatePagination();
    this.updatePageInUrl();
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  onAddAllowance(): void {
    const queryParams = this.currentPage > 1 ? { page: this.currentPage } : {};
    this.router.navigate(['/department/allowance/add'], { queryParams });
  }

  formatDate(year: number): string {
    return `${year}`;
  }

  /** Primary line — clamped like asset/name columns elsewhere; full string in tooltip. */
  getAllowanceItemTitle(row: AllowanceTableRow): string {
    if (row.itemName?.trim()) return row.itemName.trim();
    if (row.itemNo?.trim()) return row.itemNo.trim();
    return `${this.translateService.instant('allowance.item')} ${row.itemId}`;
  }

  /** Secondary meta line — omit redundant itemNo if it is already used as title. */
  getAllowanceItemSubline(row: AllowanceTableRow): string {
    const bits: string[] = [];
    const titleNorm = row.itemName?.trim() || row.itemNo?.trim() || '';
    const no = row.itemNo?.trim();
    if (no && no !== titleNorm) {
      bits.push(`${this.translateService.instant('allowance.itemNo')}: ${no}`);
    }
    if (row.batchNo?.trim()) {
      bits.push(`${this.translateService.instant('allowance.batchNo')}: ${row.batchNo.trim()}`);
    }
    return bits.join(', ');
  }


  onEdit(allowance: AllowanceTableRow): void {
    if (!this.isAdminUser && this.userDepartmentId !== null && allowance.departmentId !== this.userDepartmentId) {
      this.translateService.get(['toast.error', 'allowance.errors.unauthorizedAccess']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
        this.toastService.error(translations['allowance.errors.unauthorizedAccess'], translations['toast.error']);
      });
      return;
    }

    const queryParams: Record<string, string | number> = {
      departmentId: allowance.departmentId,
      year: allowance.year,
      itemId: allowance.itemId,
      itemType: allowance.itemType,
      edit: 'true'
    };
    if (this.currentPage > 1) {
      queryParams['page'] = this.currentPage;
    }
    this.router.navigate(['/department/allowance/add'], { queryParams });
  }

  onDelete(allowance: AllowanceTableRow): void {

    this.selectedAllowance = {
      ...allowance,
      items: allowance.items ?? [],
      isSingleItem: true
    };
    this.showDeleteDialog = true;
  }

  onDeleteConfirm(): void {
    if (!this.selectedAllowance) return;


    const isSingleItem = this.selectedAllowance.isSingleItem === true;

    if (isSingleItem) {

      const itemId = this.selectedAllowance.id;
      const endpoint = `${API_ENDPOINTS.ALLOWANCE.BASE}/${itemId}`;

      this.apiService.delete<unknown>(endpoint)
        .pipe(
          takeUntil(this.destroy$),
          catchError((err: unknown) => {
            const isNotFound = (err as { status?: number; message?: string })?.status === 404 || (err as { message?: string })?.message === 'Resource not found.';
            if (isNotFound) {
              return of({ ok: true, notFound: true });
            }
            return of({ ok: false, error: err });
          })
        )
        .subscribe({
          next: (result: unknown) => {
            const r = result as { ok: boolean; error?: unknown } | undefined;
            if (r && r.ok === false) {
              const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(r.error, this.translateService.instant('allowance.failedToDeleteItem'), this.translateService);
              this.translateService.get(['toast.error', 'allowance.failedToDeleteItem']).pipe(takeUntil(this.destroy$)).subscribe((tr: TranslationMap) => {
                this.toastService.error(errorMessage, tr['toast.error']);
              });
            } else {
              this.translateService.get(['toast.success', 'allowance.itemDeletedSuccessfully']).pipe(takeUntil(this.destroy$)).subscribe((tr: TranslationMap) => {
                this.toastService.success(tr['allowance.itemDeletedSuccessfully'], tr['toast.success']);
              });
            }

            this.showDeleteDialog = false;
            this.selectedAllowance = null;
            this.loadAllowances();
            this.cdr.markForCheck();
          },
          error: (_error: unknown) => {
            this.translateService.get(['toast.error', 'allowance.failedToDeleteItem']).pipe(takeUntil(this.destroy$)).subscribe((tr: TranslationMap) => {
              this.toastService.error(tr['allowance.failedToDeleteItem'], tr['toast.error']);
            });
            this.showDeleteDialog = false;
            this.selectedAllowance = null;
            this.cdr.markForCheck();
          }
        });
    } else {

      const deptId = this.selectedAllowance.departmentId;
      const year = this.selectedAllowance.year;


      this.apiService.get<AllowanceItemDto[]>(API_ENDPOINTS.ALLOWANCE.BASE)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (all) => {
            const items = Array.isArray(all) ? all : [];
            const ids = items.filter(i => i.departmentId === deptId && i.year === year).map(i => i.id);

            if (ids.length === 0) {

              this.translateService.get(['toast.success', 'allowance.alreadyDeleted']).pipe(takeUntil(this.destroy$)).subscribe((tr: TranslationMap) => {
                this.toastService.success(tr['allowance.alreadyDeleted'], tr['toast.success']);
              });
              this.showDeleteDialog = false;
              this.selectedAllowance = null;
              this.loadAllowances();
              this.cdr.markForCheck();
              return;
            }

            type DeleteResult = { ok: true; id?: number; notFound?: boolean } | { ok: false; id?: number; error: unknown };
            const deleteObservables = ids.map(id => {
              const endpoint = `${API_ENDPOINTS.ALLOWANCE.BASE}/${id}`;
              return this.apiService.delete<unknown>(endpoint).pipe(
                catchError((err: unknown) => {
                  const isNotFound = (err as { status?: number; message?: string })?.status === 404 || (err as { message?: string })?.message === 'Resource not found.';
                  if (isNotFound) return of({ ok: true, id, notFound: true });
                  return of({ ok: false, id, error: err });
                })
              );
            });

            forkJoin(deleteObservables)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (results: unknown) => {
                  const r = results as DeleteResult[];
                  const hasHardError = r.some(x => x && x.ok === false);
                  if (hasHardError) {
                    const firstErr = r.find((x): x is { ok: false; error: unknown } => x.ok === false);
                    const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(firstErr?.error, this.translateService.instant('allowance.failedToDelete'), this.translateService);
                    this.translateService.get(['toast.error', 'allowance.failedToDelete']).pipe(takeUntil(this.destroy$)).subscribe((tr: TranslationMap) => {
                      this.toastService.error(errorMessage, tr['toast.error']);
                    });
                  } else {
                    this.translateService.get(['toast.success', 'allowance.deletedSuccessfully']).pipe(takeUntil(this.destroy$)).subscribe((tr: TranslationMap) => {
                      this.toastService.success(tr['allowance.deletedSuccessfully'], tr['toast.success']);
                    });
                  }

                  this.showDeleteDialog = false;
                  this.selectedAllowance = null;
                  this.loadAllowances();
                  this.cdr.markForCheck();
                },
                error: () => {
                  this.translateService.get(['toast.error', 'allowance.failedToDelete']).pipe(takeUntil(this.destroy$)).subscribe((tr: TranslationMap) => {
                    this.toastService.error(tr['allowance.failedToDelete'], tr['toast.error']);
                  });
                  this.showDeleteDialog = false;
                  this.cdr.markForCheck();
                }
              });
          },
          error: () => {
            this.translateService.get(['toast.error', 'allowance.failedToLoadForDeletion']).pipe(takeUntil(this.destroy$)).subscribe((tr: TranslationMap) => {
              this.toastService.error(tr['allowance.failedToLoadForDeletion'], tr['toast.error']);
            });
            this.showDeleteDialog = false;
            this.cdr.markForCheck();
          }
        });
    }
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.selectedAllowance = null;
  }
}

