import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { LucideAngularModule, UserPlus, UserIcon, Shield, Power, Edit, Trash2 } from 'lucide-angular';
import { BackendUserDto, RoleDto } from '@models/backend-user.model';
import { LookupItem } from '@models/lookup.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { UserManagementService } from '@services/user-management.service';
import { UserFiltersComponent } from '../user-filters/user-filters.component';
import { UserFormModalComponent } from '@components/user-form-modal/user-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';

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
  readonly Shield = Shield;
  readonly Power = Power;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;

  users: BackendUserDto[] = [];
  roles: RoleDto[] = [];
  ranks: LookupItem[] = [];
  departments: LookupItem[] = [];
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

  @Output() userSaved = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  constructor(
    private userManagementService: UserManagementService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
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
    this.userManagementService.loadUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
          this.currentPage = 1;
          this.isLoading = false;
          this.validateCurrentPage();
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Failed to load users: ' + (error.message || 'Unknown error');
          this.cdr.markForCheck();
        }
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

  get filteredUsers(): BackendUserDto[] {
    return this.userManagementService.filterUsers(this.users, this.searchTerm);
  }

  get totalPages(): number {
    const totalItems = this.filteredUsers.length;
    if (totalItems === 0) {
      return 1;
    }
    return Math.ceil(totalItems / this.rowsPerPage);
  }

  get paginatedUsers(): BackendUserDto[] {
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
    this.cdr.markForCheck();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.validateCurrentPage();
    this.cdr.markForCheck();
  }

  onSearchChange(searchTerm: string): void {
    this.searchTerm = searchTerm;
    this.currentPage = 1;
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
}

