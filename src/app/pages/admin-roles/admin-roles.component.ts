import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { RoleFormModalComponent } from '@components/role-form-modal/role-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { LucideAngularModule, Shield, Plus, Edit, Trash2, Users, Settings, Copy, Check, X } from 'lucide-angular';
import { RoleDto } from '@models/backend-user.model';
import { BackendUserService } from '@services/backend-user.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [
    CommonModule, 
    CardComponent, 
    ButtonComponent, 
    LucideAngularModule,
    RoleFormModalComponent,
    ConfirmDialogComponent,
    TranslateModule,
    HasPermissionDirective
  ],
  templateUrl: './admin-roles.component.html',
  styleUrls: ['./admin-roles.component.css']
})
export class AdminRolesComponent implements OnInit, OnDestroy {
  readonly Shield = Shield;
  readonly Plus = Plus;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Users = Users;
  readonly Settings = Settings;
  readonly Copy = Copy;
  readonly Check = Check;
  readonly X = X;

  roles: RoleDto[] = [];
  isLoading = false;
  errorMessage = '';
  
  showRoleModal = false;
  showDeleteConfirm = false;
  roleModalMode: 'create' | 'edit' = 'create';
  selectedRole?: RoleDto;

  private destroy$ = new Subject<void>();

  constructor(
    private backendUserService: BackendUserService,
    private toastService: ToastService,
    private translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadRoles();
    
    this.backendUserService.roles$
      .pipe(takeUntil(this.destroy$))
      .subscribe((roles: RoleDto[]) => {
        this.roles = roles;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRoles(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.backendUserService.getRoles().subscribe({
      next: (roles: RoleDto[]) => {
        this.roles = roles;
        this.isLoading = false;
      },
      error: (error: any) => {
        this.isLoading = false;
        const errorMsg = error.message || 'Unknown error';
        this.errorMessage = 'Failed to load roles: ' + errorMsg;
        this.translateService.get(['toast.error', 'toast.failedToLoadRoles']).subscribe(translations => {
          this.toastService.error(
            translations['toast.failedToLoadRoles'] || `Failed to load roles: ${errorMsg}`,
            translations['toast.error']
          );
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
      const roleName = this.selectedRole.name;
      this.backendUserService.deleteRole(this.selectedRole.id).subscribe({
        next: (success: boolean) => {
          if (success) {
            this.showDeleteConfirm = false;
            this.selectedRole = undefined;
            this.translateService.get(['toast.success', 'toast.roleDeleted']).subscribe(translations => {
              const message = (translations['toast.roleDeleted'] || 'Role deleted successfully').replace('{roleName}', roleName);
              this.toastService.success(message, translations['toast.success']);
            });
            this.loadRoles();
          }
        },
        error: (error: any) => {
          const errorMsg = error.message || 'Failed to delete role';
          this.errorMessage = errorMsg;
          this.translateService.get(['toast.error', 'toast.failedToDeleteRole']).subscribe(translations => {
            const message = (translations['toast.failedToDeleteRole'] || `Failed to delete role: ${errorMsg}`).replace('{roleName}', roleName);
            this.toastService.error(message, translations['toast.error']);
          });
        }
      });
    }
  }

  onRoleSaved(role: RoleDto): void {
    // Role was saved successfully (create or update)
    const isCreate = this.roleModalMode === 'create';
    const roleName = role?.name || this.selectedRole?.name || '';
    
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
    });
    
    this.loadRoles();
  }

  onRoleError(errorMessage: string): void {
    // Role save failed (create or update)
    const isCreate = this.roleModalMode === 'create';
    const roleName = this.selectedRole?.name || '';
    
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
    });
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
}
