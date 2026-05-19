import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { RoleFormModalComponent } from '@admin/components/role-form-modal/role-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { LucideAngularModule, Badge, Plus, Edit, Trash2, Users, Settings, Copy, Check, X, Search } from 'lucide-angular';
import { RoleDto } from '@models/backend-user.model';
import { trackByStringId } from '@utils/trackby.utils';
import { BackendUserService } from '@services/backend-user.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationMap } from '@models/common.types';
import { formatDateShort } from '@utils/format.utils';
import { defaultPageSize } from '@constants/app.constants';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    LucideAngularModule,
    RoleFormModalComponent,
    ConfirmDialogComponent,
    PaginationComponent,
    RowsPerPageComponent,
    TranslateModule,
    HasPermissionDirective,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './admin-roles.component.html',
  styleUrls: ['./admin-roles.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminRolesComponent implements OnInit, OnDestroy {
  readonly PERMISSIONS = PERMISSIONS;

  readonly Badge = Badge;
  readonly Plus = Plus;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Users = Users;
  readonly Settings = Settings;
  readonly Copy = Copy;
  readonly Check = Check;
  readonly X = X;
  readonly Search = Search;

  roles: RoleDto[] = [];
  isLoading = false;
  errorMessage = '';

  // Search
  searchTerm = '';

  // Pagination
  currentPage = 1;
  rowsPerPage = defaultPageSize;

  showRoleModal = false;
  showDeleteConfirm = false;
  roleModalMode: 'create' | 'edit' = 'create';
  selectedRole?: RoleDto;

  private destroy$ = new Subject<void>();
  readonly trackByStringId = trackByStringId;

  constructor(
    private backendUserService: BackendUserService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadRoles();

    this.backendUserService.roles$
      .pipe(takeUntil(this.destroy$))
      .subscribe((roles: RoleDto[]) => {
        this.roles = roles;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRoles(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    this.backendUserService.getRoles().subscribe({
      next: (roles: RoleDto[]) => {
        this.roles = roles;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.isLoading = false;
        const errorMsg = (error instanceof Error ? error.message : String(error)) || 'Unknown error';
        this.translateService.get('adminRoles.errors.failedToLoadRoles').pipe(takeUntil(this.destroy$)).subscribe(translation => {
          this.errorMessage = `${translation || 'Failed to load roles'}: ${errorMsg}`;
          this.cdr.markForCheck();
        });
        this.translateService.get(['toast.error', 'toast.failedToLoadRoles']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
          this.toastService.error(
            translations['toast.failedToLoadRoles'] || `Failed to load roles: ${errorMsg}`,
            translations['toast.error']
          );
          this.cdr.markForCheck();
        });
      }
    });
  }

  onAddRole(): void {
    this.roleModalMode = 'create';
    this.selectedRole = undefined;
    this.showRoleModal = true;
  }

  onEditRole(role: RoleDto): void {
    this.roleModalMode = 'edit';
    this.selectedRole = role;
    this.showRoleModal = true;
  }

  onDeleteRole(role: RoleDto): void {
    this.selectedRole = role;
    this.showDeleteConfirm = true;
  }

  confirmDelete(): void {
    if (this.selectedRole) {
      const roleName = getLocalizedName(this.selectedRole, getCurrentLang(this.translateService)) || this.selectedRole.name || '';
      this.backendUserService.deleteRole(this.selectedRole.id).subscribe({
        next: (success: boolean) => {
          if (success) {
            this.showDeleteConfirm = false;
            this.selectedRole = undefined;
            this.translateService.get(['toast.success', 'toast.roleDeleted']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              const message = (translations['toast.roleDeleted'] || 'Role deleted successfully').replace('{roleName}', roleName);
              this.toastService.success(message, translations['toast.success']);
            });
            this.loadRoles();
            this.cdr.markForCheck();
          }
        },
        error: (error: unknown) => {
          const errObj = error as { userMessage?: string; message?: string };
          const serverMsg = (errObj?.userMessage || (error instanceof Error ? error.message : String(error)) || '').trim();

          this.translateService
            .get(['toast.error', 'toast.failedToDeleteRole', 'toast.roleDeleteInUse'])
            .pipe(takeUntil(this.destroy$))
            .subscribe((translations: TranslationMap) => {
              const failedTemplate = translations['toast.failedToDeleteRole'] || 'Failed to delete role "{roleName}"';
              const withRoleName =
                roleName && failedTemplate.includes('{roleName}')
                  ? failedTemplate.replace('{roleName}', roleName)
                  : (roleName ? `${failedTemplate} "${roleName}"`.trim() : failedTemplate);

              const inUseLocalized =
                translations['toast.roleDeleteInUse'] ||
                'This role cannot be deleted because it is currently in use.';

              const backendInUseEnglish = 'This role cannot be deleted because it is currently in use.';
              const looksLikeTechnical =
                serverMsg.includes('Microsoft.') ||
                serverMsg.includes('SqlException') ||
                serverMsg.includes('DbUpdateException') ||
                serverMsg.includes('at Microsoft.') ||
                serverMsg.includes('REFERENCE constraint');

              const isInUseFromApi =
                !looksLikeTechnical &&
                (serverMsg === backendInUseEnglish || serverMsg.includes('currently in use'));

              let message: string;
              if (isInUseFromApi) {
                message = inUseLocalized;
              } else if (looksLikeTechnical) {
                message = withRoleName;
              } else if (serverMsg && serverMsg !== 'Failed to delete role') {
                message = serverMsg;
              } else {
                message = withRoleName;
              }

              this.errorMessage = message;
              this.toastService.error(message, translations['toast.error']);
              this.cdr.markForCheck();
            });
        }
      });
    }
  }

  // Helper method for template
  getRoleDisplayName(role: RoleDto | null | undefined): string {
    if (!role) return '';
    return getLocalizedName(role, getCurrentLang(this.translateService)) || role.name || '';
  }

  onRoleSaved(role: RoleDto): void {
    // Role was saved successfully (create or update)
    const isCreate = this.roleModalMode === 'create';
    const roleName = role ? (getLocalizedName(role, getCurrentLang(this.translateService)) || role.name || '') :
      (this.selectedRole ? (getLocalizedName(this.selectedRole, getCurrentLang(this.translateService)) || this.selectedRole.name || '') : '');

    this.translateService.get([
      'toast.success',
      isCreate ? 'toast.roleCreated' : 'toast.roleUpdated'
    ]).subscribe(translations => {
      const messageKey = isCreate ? 'toast.roleCreated' : 'toast.roleUpdated';
      let message = translations[messageKey] || (isCreate ? 'Role created successfully' : 'Role updated successfully');
      if (roleName && message.includes('{roleName}')) {
        message = message.replace('{roleName}', roleName);
      }
      this.toastService.success(message, translations['toast.success']);
      this.cdr.markForCheck();
    });

    this.loadRoles();
  }

  onRoleError(errorMessage: string): void {
    // Role save failed (create or update)
    const isCreate = this.roleModalMode === 'create';
    const roleName = this.selectedRole ? (getLocalizedName(this.selectedRole, getCurrentLang(this.translateService)) || this.selectedRole.name || '') : '';

    this.translateService.get([
      'toast.error',
      isCreate ? 'toast.failedToCreateRole' : 'toast.failedToUpdateRole'
    ]).subscribe(translations => {
      const messageKey = isCreate ? 'toast.failedToCreateRole' : 'toast.failedToUpdateRole';
      let message = translations[messageKey] || (isCreate ? 'Failed to create role' : 'Failed to update role');
      if (roleName && message.includes('{roleName}')) {
        message = message.replace('{roleName}', roleName);
      }
      if (errorMessage && !message.includes(errorMessage)) {
        message += `: ${errorMessage}`;
      }
      this.toastService.error(message, translations['toast.error']);
      this.cdr.markForCheck();
    });
  }

  formatDate(date: Date | undefined): string {
    if (!date) {
      const translation = this.translateService.instant('common.never');
      return translation !== 'common.never' ? translation : 'Never';
    }
    const formatted = formatDateShort(date);
    if (formatted === 'N/A') {
      const translation = this.translateService.instant('common.never');
      return translation !== 'common.never' ? translation : 'Never';
    }
    return formatted;
  }

  getTotalRoles(): number {
    return this.roles.length;
  }

  getTotalUsers(): number {
    return 0;
  }

  getActiveRolesCount(): number {
    return this.roles.length;
  }

  // Search and Filter
  get filteredRoles(): RoleDto[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.roles;
    }

    return this.roles.filter(role => {
      const localizedName = getLocalizedName(role, getCurrentLang(this.translateService)) || role.name || '';
      const name = localizedName.toLowerCase();
      return name.includes(term);
    });
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.validateCurrentPage();
  }

  // Pagination
  get totalPages(): number {
    const totalItems = this.filteredRoles.length;
    if (totalItems === 0) {
      return 1;
    }
    return Math.ceil(totalItems / this.rowsPerPage);
  }

  get paginatedRoles(): RoleDto[] {
    this.validateCurrentPage();
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.filteredRoles.slice(startIndex, startIndex + this.rowsPerPage);
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
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.validateCurrentPage();
  }
}
