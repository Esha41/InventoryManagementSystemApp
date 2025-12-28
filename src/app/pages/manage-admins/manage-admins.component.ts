import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { UserFormModalComponent } from '@components/user-form-modal/user-form-modal.component';
import { LookupFormModalComponent } from '@components/lookup-form-modal/lookup-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { LucideAngularModule, UserPlus, Search, Edit, Trash2, Shield, Mail, User as UserIcon, Power, Database, Plus, ChevronDown, X } from 'lucide-angular';
import { BackendUserDto, RoleDto } from '@models/backend-user.model';
import { BackendUserService } from '@services/backend-user.service';
import { LookupService } from '@services/lookup.service';
import { LookupItem, LookupTableConfig, CreateUpdateLookupDto, LOOKUP_TABLES } from '@models/lookup.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-manage-admins',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    LucideAngularModule,
    UserFormModalComponent,
    LookupFormModalComponent,
    ConfirmDialogComponent,
    TranslateModule,
    PaginationComponent,
    RowsPerPageComponent,
    HasPermissionDirective,
    LoadingStateComponent,
    ErrorStateComponent,
    DropdownComponent
  ],
  templateUrl: './manage-admins.component.html',
  styleUrls: ['./manage-admins.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManageAdminsComponent implements OnInit, OnDestroy {
  readonly UserPlus = UserPlus;
  readonly Search = Search;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Shield = Shield;
  readonly Mail = Mail;
  readonly UserIcon = UserIcon;
  readonly Power = Power;
  readonly Database = Database;
  readonly Plus = Plus;
  readonly ChevronDown = ChevronDown;
  readonly X = X;

  // Tab management
  activeTab: 'users' | 'lookups' = 'users';

  // User management
  users: BackendUserDto[] = [];
  roles: RoleDto[] = [];
  ranks: LookupItem[] = [];
  departments: LookupItem[] = [];
  userRolesMap: Map<string, string[]> = new Map(); // Cache user roles
  isLoading = false;
  errorMessage = '';

  searchTerm = '';

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;

  // Modal states
  showUserModal = false;
  showDeleteConfirm = false;
  userModalMode: 'create' | 'edit' = 'create';
  selectedUser?: BackendUserDto;

  // Lookup management
  lookupTables = LOOKUP_TABLES;
  selectedTable?: LookupTableConfig;
  lookupItems: LookupItem[] = [];
  lookupSearchTerm = '';
  isLoadingLookups = false;
  lookupErrorMessage = '';

  // Lookup modal states
  showLookupModal = false;
  showLookupDeleteConfirm = false;
  lookupModalMode: 'create' | 'edit' = 'create';
  selectedLookupItem?: LookupItem;
  lookupModalLoading = false; // Track modal loading state

  private destroy$ = new Subject<void>();



  constructor(
    private backendUserService: BackendUserService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initializeTabFromQueryParams();
    this.loadUsers();
    this.loadRoles();
    this.loadRanks();
    this.loadDepartments();

    this.backendUserService.users$
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.users = users;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.backendUserService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
          this.currentPage = 1;
          this.isLoading = false;
          // Validate current page after loading
          this.validateCurrentPage();
          this.userRolesMap.clear();
          users.forEach(user => this.cacheUserRoles(user));
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Failed to load users: ' + (error.message || 'Unknown error');
          this.cdr.markForCheck();
        }
      });
  }

  private loadUserRolesData(userId: string): void {
    this.backendUserService.getUserRoles(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.userRolesMap.set(userId, roles.map(r => r.name));
          this.cdr.markForCheck();
        },
        error: () => {
          this.userRolesMap.set(userId, []);
          this.cdr.markForCheck();
        }
      });
  }

  private cacheUserRoles(user: BackendUserDto): void {
    const roleNames = this.extractRoleNames(user);
    this.userRolesMap.set(user.id, roleNames);
    if (roleNames.length === 0 && user.roleIds && user.roleIds.length > 0 && (!user.roles || user.roles.length === 0)) {
      this.loadUserRolesData(user.id);
    }
  }

  // Helper method for template
  getLookupItemName(item: LookupItem | null | undefined): string {
    if (!item) return '';
    return getLocalizedName(item, getCurrentLang(this.translateService)) || item.nameEn || '';
  }

  private extractRoleNames(user: BackendUserDto): string[] {
    const currentLang = getCurrentLang(this.translateService);

    if (user.roles && user.roles.length > 0) {
      return user.roles
        .map(role => getLocalizedName(role, currentLang) || role.name)
        .filter((name): name is string => !!name && name.trim().length > 0);
    }

    if (user.roleIds && user.roleIds.length > 0) {
      return user.roleIds
        .map(roleId => {
          const role = this.roles.find(r => r.id === roleId);
          return role ? (getLocalizedName(role, currentLang) || role.name) : null;
        })
        .filter((name): name is string => !!name && name.trim().length > 0);
    }

    return [];
  }

  // Returns an array of role names for a given user ID
  getUserRoles(userId: string): string[] {
    const cachedRoles = this.userRolesMap.get(userId);
    if (cachedRoles !== undefined) {
      return cachedRoles;
    }

    const user = this.users.find(u => u.id === userId);
    if (!user) {
      return [];
    }

    const roleNames = this.extractRoleNames(user);
    this.userRolesMap.set(user.id, roleNames);
    return roleNames;
  }

  loadRoles(): void {
    this.backendUserService.getRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.roles = roles;
          // Recalculate role name cache for users that rely on role IDs
          this.users.forEach(user => {
            if (!user.roles || user.roles.length === 0) {
              this.userRolesMap.set(user.id, this.extractRoleNames(user));
            }
          });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = 'Failed to load roles: ' + (error.message || 'Unknown error');
          this.cdr.markForCheck();
        }
      });
  }

  loadRanks(): void {
    this.lookupService.getLookupItems('Rank')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ranks: LookupItem[]) => {
          this.ranks = ranks || [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.ranks = [];
          this.cdr.markForCheck();
        }
      });
  }

  loadDepartments(): void {
    this.lookupService.getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (departments: LookupItem[]) => {
          this.departments = departments || [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.departments = [];
          this.cdr.markForCheck();
        }
      });
  }

  get filteredUsers(): BackendUserDto[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.users;
    }

    return this.users.filter(user => {
      const name = (user.userName || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }

  get totalPages(): number {
    const totalItems = this.filteredUsers.length;
    if (totalItems === 0) {
      return 1;
    }
    return Math.ceil(totalItems / this.rowsPerPage);
  }

  get paginatedUsers(): BackendUserDto[] {
    // Ensure currentPage is valid before slicing
    this.validateCurrentPage();
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.filteredUsers.slice(startIndex, startIndex + this.rowsPerPage);
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

  getUserName(user: BackendUserDto): string {
    return user.userName || user.email;
  }

  getUserInitials(user: BackendUserDto): string {
    const name = user.userName || user.email;
    return name.substring(0, 2).toUpperCase();
  }

  onPageChange(page: number): void {
    const maxPages = this.totalPages;
    if (page < 1 || page > maxPages || maxPages === 0) {
      return;
    }
    this.currentPage = page;
    this.cdr.markForCheck();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    // Validate after changing rows per page
    this.validateCurrentPage();
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    // Validate after search in case filtered results have fewer pages
    this.validateCurrentPage();
    this.cdr.markForCheck();
  }

  onAddUser(): void {
    this.userModalMode = 'create';
    this.selectedUser = undefined;
    this.showUserModal = true;
    this.cdr.markForCheck();
  }

  onEdit(user: BackendUserDto): void {
    this.userModalMode = 'edit';
    this.selectedUser = user;
    this.showUserModal = true;
    this.cdr.markForCheck();
  }

  onDelete(user: BackendUserDto): void {
    this.selectedUser = user;
    this.showDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  confirmDelete(): void {
    if (this.selectedUser) {
      this.backendUserService.deleteUser(this.selectedUser.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (success) => {
            if (success) {
              this.showDeleteConfirm = false;
              const userName = this.selectedUser?.userName || this.translateService.instant('manageAdmins.user');
              this.selectedUser = undefined;
              this.cdr.markForCheck();
              this.loadUsers();
              // Show success toast
              this.toastService.success(
                this.translateService.instant('manageAdmins.userDeletedSuccess', { userName }),
                this.translateService.instant('manageAdmins.deleteUserTitle')
              );
            }
          },
          error: (error) => {
            this.errorMessage = error.message || 'Failed to delete user';
            this.cdr.markForCheck();
            // Show error toast
            this.toastService.error(
              error.message || this.translateService.instant('manageAdmins.userDeletedError'),
              this.translateService.instant('manageAdmins.deleteUserTitle')
            );
          }
        });
    }
  }

  onUserSaved(): void {
    this.loadUsers();
    this.userRolesMap.clear(); // Clear cache to reload roles
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getTotalUsers(): number {
    return this.users.length;
  }

  getTotalActiveUsers(): number {
    return this.users.length;
  }

  getTotalInactiveUsers(): number {
    return 0;
  }

  getFullName(user: BackendUserDto): string {
    const localizedName = getLocalizedName(user, getCurrentLang(this.translateService));
    return localizedName || user.userName || user.email || '';
  }

  getMilitaryId(user: BackendUserDto): string {
    // Handle both militaryId and militoryId (API typo)
    return user.militaryId || user.militoryId || '-';
  }

  getRankName(user: BackendUserDto): string {
    if (user.rankNameEn || user.rankNameAr) {
      // Use rankNameEn/rankNameAr directly if available
      const rankNameObj = { nameEn: user.rankNameEn, nameAr: user.rankNameAr };
      return getLocalizedName(rankNameObj, getCurrentLang(this.translateService)) || '-';
    }

    if (!user.rankId) return '-';
    const rank = this.ranks.find(r => r.id === user.rankId);
    if (!rank) return '-';
    return getLocalizedName(rank, getCurrentLang(this.translateService)) || '-';
  }

  getDepartmentName(user: BackendUserDto): string {
    if (!user.departmentId) {
      // Fallback to departmentName if no departmentId
      return user.departmentName || '-';
    }

    // Find department by ID and get localized name
    const department = this.departments.find(d => d.id === user.departmentId);
    if (department) {
      return getLocalizedName(department, getCurrentLang(this.translateService)) || '-';
    }

    // Fallback to departmentName if department not found in lookup
    return user.departmentName || '-';
  }

  getStatusColor(): string {
    return 'bg-[var(--color-success)]';
  }

  getRoleTypeColor(): string {
    return 'bg-[var(--color-accent)]';
  }

  // Tab management
  setActiveTab(tab: 'users' | 'lookups'): void {
    this.activeTab = tab;
    this.updateQueryParams(tab);
    if (tab === 'lookups' && this.lookupTables.length > 0) {
      if (!this.selectedTable) {
        // Auto-select first table if none selected
        this.selectedTable = this.lookupTables[0];
      }
      this.loadLookupItems();
    }
    this.cdr.markForCheck();
  }

  private initializeTabFromQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const tabParam = params['tab'];
        if (tabParam === 'lookups' || tabParam === 'users') {
          this.activeTab = tabParam;
          if (tabParam === 'lookups' && this.lookupTables.length > 0) {
            if (!this.selectedTable) {
              // Auto-select first table if none selected
              this.selectedTable = this.lookupTables[0];
            }
            this.loadLookupItems();
          }
          this.cdr.markForCheck();
        }
      });
  }

  private updateQueryParams(tab: 'users' | 'lookups'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  // Lookup management
  onTableSelect(table: LookupTableConfig | undefined): void {
    this.selectedTable = table;
    if (table) {
      this.loadLookupItems();
    }
    this.cdr.markForCheck();
  }



  loadLookupItems(): void {
    if (!this.selectedTable) return;

    this.isLoadingLookups = true;
    this.lookupErrorMessage = '';
    this.lookupService.getLookupItems(this.selectedTable.apiEndpoint)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.lookupItems = items.filter(item => !item.isDeleted);
          this.isLoadingLookups = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.isLoadingLookups = false;
          this.lookupErrorMessage = 'Failed to load lookup items: ' + (error.message || 'Unknown error');
          this.cdr.markForCheck();
        }
      });
  }

  get filteredLookupItems(): LookupItem[] {
    if (!this.lookupSearchTerm.trim()) {
      return this.lookupItems;
    }
    const search = this.lookupSearchTerm.toLowerCase();
    return this.lookupItems.filter(item =>
      item.nameEn.toLowerCase().includes(search) ||
      item.nameAr.toLowerCase().includes(search) ||
      (item.code && item.code.toLowerCase().includes(search))
    );
  }

  onAddLookup(): void {
    if (!this.selectedTable) return;
    this.lookupModalMode = 'create';
    this.selectedLookupItem = undefined;
    this.showLookupModal = true;
    this.cdr.markForCheck();
  }

  onEditLookup(item: LookupItem): void {
    if (!this.selectedTable) return;
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

    const dto: CreateUpdateLookupDto = {
      nameEn: this.selectedLookupItem.nameEn,
      nameAr: this.selectedLookupItem.nameAr,
      code: this.selectedLookupItem.code
    };

    this.lookupService.deleteLookupItem(
      this.selectedTable.apiEndpoint,
      this.selectedLookupItem.id!,
      dto
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            const itemName = getLocalizedName(this.selectedLookupItem, getCurrentLang(this.translateService)) || '';
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
          this.lookupErrorMessage = error.message || 'Failed to delete lookup item';
          this.cdr.markForCheck();
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(
              error.message || 'Failed to delete lookup item',
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
      ? this.lookupService.createLookupItem(this.selectedTable.apiEndpoint, dto)
      : this.lookupService.updateLookupItem(
        this.selectedTable.apiEndpoint,
        this.selectedLookupItem!.id!,
        dto
      );

    operation
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (item) => {
          const isCreate = this.lookupModalMode === 'create';
          const itemName = getLocalizedName(dto, getCurrentLang(this.translateService)) || '';

          this.translateService.get([
            'toast.success',
            'lookupManagement.addItem',
            'lookupManagement.edit'
          ]).subscribe(translations => {
            const message = isCreate
              ? `${translations['lookupManagement.addItem'] || 'Item'} "${itemName}" added successfully`
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
          this.lookupModalLoading = false; // Reset modal loading state on error
          this.isLoadingLookups = false;
          this.lookupErrorMessage = error.message || `Failed to ${this.lookupModalMode} lookup item`;
          this.cdr.markForCheck();

          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(
              error.message || `Failed to ${this.lookupModalMode} lookup item`,
              translations['toast.error']
            );
          });
        }
      });
  }

  /**
   * Get the translated name for an ItemType enum value
   */
  getItemTypeName(item: LookupItem): string {
    let itemType = item.itemType;
    if (itemType === undefined || itemType === null) return '-';

    // Convert string enum to number if needed
    if (typeof itemType === 'string') {
      const itemTypeMap: { [key: string]: number } = {
        'Ammunition': 1,
        'Weapon': 2,
        'Explosive': 3
      };
      itemType = itemTypeMap[itemType] || 0;
    }

    // If still 0 or invalid, return dash
    if (itemType === 0) return '-';

    const translationKey = itemType === 1 ? 'lookupFormModal.ammunition'
      : itemType === 2 ? 'lookupFormModal.weapon'
        : itemType === 3 ? 'lookupFormModal.explosive'
          : '';

    if (!translationKey) return '-';

    return this.translateService.instant(translationKey);
  }

  /**
   * Get the raw ItemType enum value
   */
  getItemType(item: LookupItem): number {
    let itemType = item.itemType;
    if (itemType === undefined || itemType === null) return 0;

    if (typeof itemType === 'string') {
      const itemTypeMap: { [key: string]: number } = {
        'Ammunition': 1,
        'Weapon': 2,
        'Explosive': 3
      };
      return itemTypeMap[itemType] || 0;
    }

    return itemType;
  }
}
