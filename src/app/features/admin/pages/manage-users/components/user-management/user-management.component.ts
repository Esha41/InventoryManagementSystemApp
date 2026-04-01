import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { LucideAngularModule, UserPlus, UserIcon, Power, Edit, Trash2, RotateCcw } from 'lucide-angular';
import { BackendUserDto, RoleDto } from '@models/backend-user.model';
import { LookupItem } from '@models/lookup.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { UserManagementService } from '@services/user-management.service';
import { UserFiltersComponent } from '../user-filters/user-filters.component';
import { UserFormModalComponent } from '@components/user-form-modal/user-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { ProfileDataService } from '@services/profile-data.service';
import { BackendAuthService } from '@services/backend-auth.service';

/**
 * User Management Component
 * Handles user management tab content
 */
@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    LucideAngularModule,
    TranslateModule,
    PaginationComponent,
    RowsPerPageComponent,
    HasPermissionDirective,
    LoadingStateComponent,
    ErrorStateComponent,
    UserFiltersComponent,
    UserFormModalComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementComponent implements OnInit, OnDestroy {
  readonly UserPlus = UserPlus;
  readonly UserIcon = UserIcon;
  readonly Power = Power;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly RotateCcw = RotateCcw;

  users: BackendUserDto[] = [];
  roles: RoleDto[] = [];
  ranks: LookupItem[] = [];
  departments: LookupItem[] = [];
  isLoading = false;
  errorMessage = '';
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'inactive' | 'deleted' = 'all';

  // Super admin check
  isSuperAdmin = false;

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;

  // Modal states
  showUserModal = false;
  showDeleteConfirm = false;
  showPermanentDeleteConfirm = false;
  userModalMode: 'create' | 'edit' = 'create';
  selectedUser?: BackendUserDto;

  @Output() userSaved = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  constructor(
    private userManagementService: UserManagementService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef,
    private profileDataService: ProfileDataService,
    private authService: BackendAuthService
  ) { }

  ngOnInit(): void {
    // Check if current user is super admin
    const profileData = this.profileDataService.getFullProfileData();
    this.isSuperAdmin = profileData?.isSuperAdmin || this.authService.isSuperAdmin();

    this.loadUsers();
    this.loadUserSummary();
    this.loadRoles();
    this.loadRanks();
    this.loadDepartments();

    this.userManagementService.users$
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
    this.userManagementService.loadUsers(this.currentPage, this.rowsPerPage, this.searchTerm || '', this.statusFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Failed to load users: ' + (error.message || 'Unknown error');
          this.cdr.markForCheck();
        }
      });
  }

  loadUserSummary(): void {
    this.userManagementService.loadUserSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.cdr.markForCheck(),
        error: () => { }
      });
  }

  loadRoles(): void {
    this.userManagementService.loadRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.roles = roles;
          this.userManagementService.updateRolesCache(this.users, roles);
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = 'Failed to load roles: ' + (error.message || 'Unknown error');
          this.cdr.markForCheck();
        }
      });
  }

  loadRanks(): void {
    this.userManagementService.loadRanks()
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
    this.userManagementService.loadDepartments()
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

  // With server-side pagination, 'filteredUsers' is just the current page of users loaded from backend
  get filteredUsers(): BackendUserDto[] {
    return this.users;
  }

  /**
   * Check if a user is a superadmin by checking their roles
   */
  isUserSuperAdmin(user: BackendUserDto): boolean {
    if (!user) {
      return false;
    }

    // Check roleIds (string array) first
    if (user.roleIds && Array.isArray(user.roleIds) && user.roleIds.length > 0) {
      const isSuperAdmin = user.roleIds.some(roleId => {
        const role = this.roles.find(r => r.id === roleId);
        return role?.isSuperAdmin === true;
      });
      return isSuperAdmin;
    }

    // Fallback to roles (RoleDto array) if roleIds is not available
    if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
      const isSuperAdmin = user.roles.some(role => {
        return role.isSuperAdmin === true;
      });
      return isSuperAdmin;
    }

    return false;
  }

  /**
   * Check if a user can be edited/deleted by the current user
   */
  canManageUser(user: BackendUserDto): boolean {
    // Superadmins can manage everyone
    if (this.isSuperAdmin) {
      return true;
    }

    // Normal admins cannot manage superadmin users
    return !this.isUserSuperAdmin(user);
  }

  get totalPages(): number {
    return this.userManagementService.paginationState.totalPages;
  }

  get paginatedUsers(): BackendUserDto[] {
    return this.users;
  }

  // Not strictly needed with server-side pagination but kept for safety
  private validateCurrentPage(): void {
    // Validation handled by backend/service
  }

  getUserName(user: BackendUserDto): string {
    return this.userManagementService.getUserName(user);
  }

  getUserInitials(user: BackendUserDto): string {
    return this.userManagementService.getUserInitials(user);
  }

  getFullName(user: BackendUserDto): string {
    return this.userManagementService.getFullName(user);
  }

  getMilitaryId(user: BackendUserDto): string {
    return this.userManagementService.getMilitaryId(user);
  }

  getRankName(user: BackendUserDto): string {
    return this.userManagementService.getRankName(user, this.ranks);
  }

  getDepartmentName(user: BackendUserDto): string {
    return this.userManagementService.getDepartmentName(user, this.departments);
  }

  getUserRoles(userId: string): string[] {
    return this.userManagementService.getUserRoles(userId, this.users, this.roles);
  }

  onPageChange(page: number): void {
    const maxPages = this.totalPages;
    if (page < 1 || page > maxPages || maxPages === 0) {
      return;
    }
    this.currentPage = page;
    this.loadUsers();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.loadUsers();
  }

  onSearchChange(searchTerm: string): void {
    this.searchTerm = searchTerm;
    this.currentPage = 1;
    this.loadUsers();
  }

  onStatusFilterChange(statusFilter: 'all' | 'active' | 'inactive' | 'deleted'): void {
    this.statusFilter = statusFilter;
    this.currentPage = 1;
    // Don't call loadUsers here - let the child component trigger search
    this.cdr.markForCheck();
  }

  onAddUser(): void {
    this.userModalMode = 'create';
    this.selectedUser = undefined;
    this.showUserModal = true;
    this.cdr.markForCheck();
  }

  onEdit(user: BackendUserDto): void {
    // Prevent editing superadmin users if current user is not a superadmin
    if (!this.canManageUser(user)) {
      this.toastService.error(
        this.translateService.instant('manageAdmins.cannotEditSuperAdmin'),
        this.translateService.instant('common.error')
      );
      return;
    }

    this.userModalMode = 'edit';
    this.selectedUser = user;
    this.showUserModal = true;
    this.cdr.markForCheck();
  }

  onDelete(user: BackendUserDto): void {
    // Prevent deleting superadmin users
    if (this.isUserSuperAdmin(user)) {
      this.toastService.error(
        this.translateService.instant('manageAdmins.cannotDeleteSuperAdmin'),
        this.translateService.instant('common.error')
      );
      return;
    }

    this.selectedUser = user;
    this.showDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  onToggleStatus(user: BackendUserDto): void {
    // Prevent toggling superadmin status
    if (this.isUserSuperAdmin(user)) {
      this.toastService.error(
        this.translateService.instant('manageAdmins.cannotToggleSuperAdmin'),
        this.translateService.instant('common.error')
      );
      return;
    }

    const action = user.isActive ? 'disable' : 'enable';

    this.userManagementService.toggleUserStatus(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            this.toastService.success(
              this.translateService.instant(`manageAdmins.user${action.charAt(0).toUpperCase() + action.slice(1)}dSuccess`),
              this.translateService.instant('common.success')
            );
            this.loadUsers();
            this.loadUserSummary();
          }
        },
        error: (error) => {
          this.toastService.error(
            error.message || `Failed to ${action} user`,
            this.translateService.instant('common.error')
          );
        }
      });
  }

  confirmDelete(): void {
    if (this.selectedUser) {
      this.userManagementService.deleteUser(this.selectedUser.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (success) => {
            if (success) {
              this.showDeleteConfirm = false;
              const userName = this.selectedUser?.userName || this.translateService.instant('manageAdmins.user');
              this.selectedUser = undefined;
              this.cdr.markForCheck();
              this.loadUsers();
              this.loadUserSummary();
              this.toastService.success(
                this.translateService.instant('manageAdmins.userDeletedSuccess', { userName }),
                this.translateService.instant('manageAdmins.deleteUserTitle')
              );
            }
          },
          error: (error) => {
            this.errorMessage = error.message || 'Failed to delete user';
            this.cdr.markForCheck();
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
    this.loadUserSummary();
    this.userManagementService.clearRolesCache();
    this.userSaved.emit();
  }

  getTotalUsers(): number {
    return this.userManagementService.getTotalUsers(this.users);
  }

  getTotalActiveUsers(): number {
    return this.userManagementService.getTotalActiveUsers(this.users);
  }

  getTotalInactiveUsers(): number {
    return this.userManagementService.getTotalInactiveUsers(this.users);
  }

  onRestore(user: BackendUserDto): void {
    this.userManagementService.restoreUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            this.toastService.success(
              this.translateService.instant('manageAdmins.userRestoredSuccess', { userName: user.userName || this.translateService.instant('manageAdmins.user') }),
              this.translateService.instant('common.success')
            );
            this.loadUsers();
            this.loadUserSummary();
          }
        },
        error: (error) => {
          this.toastService.error(
            error.message || this.translateService.instant('manageAdmins.userRestoredError'),
            this.translateService.instant('common.error')
          );
        }
      });
  }

  onPermanentDelete(user: BackendUserDto): void {
    if (this.isUserSuperAdmin(user)) {
      this.toastService.error(
        this.translateService.instant('manageAdmins.cannotDeleteSuperAdmin'),
        this.translateService.instant('common.error')
      );
      return;
    }
    this.selectedUser = user;
    this.showPermanentDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  onCancelPermanentDelete(): void {
    this.showPermanentDeleteConfirm = false;
    this.selectedUser = undefined;
    this.cdr.markForCheck();
  }

  confirmPermanentDelete(): void {
    if (this.selectedUser) {
      this.userManagementService.permanentDeleteUser(this.selectedUser.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (success) => {
            if (success) {
              this.showPermanentDeleteConfirm = false;
              const userName = this.selectedUser?.userName || this.translateService.instant('manageAdmins.user');
              this.selectedUser = undefined;
              this.cdr.markForCheck();
              this.loadUsers();
              this.loadUserSummary();
              this.toastService.success(
                this.translateService.instant('manageAdmins.userPermanentlyDeletedSuccess', { userName }),
                this.translateService.instant('manageAdmins.permanentDeleteUserTitle')
              );
            }
          },
          error: (error) => {
            this.toastService.error(
              error.message || this.translateService.instant('manageAdmins.userPermanentlyDeletedError'),
              this.translateService.instant('manageAdmins.permanentDeleteUserTitle')
            );
          }
        });
    }
  }
}

