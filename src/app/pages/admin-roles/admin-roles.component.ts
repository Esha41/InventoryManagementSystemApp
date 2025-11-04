import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { RoleFormModalComponent } from '@components/role-form-modal/role-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { LucideAngularModule, Shield, Plus, Edit, Trash2, Users, Settings, Copy, Check, X } from 'lucide-angular';
import { RoleDto } from '@models/backend-user.model';
import { BackendUserService } from '@services/backend-user.service';
import { TranslateModule } from '@ngx-translate/core';

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
    TranslateModule
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

  constructor(private backendUserService: BackendUserService) {}

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
    this.backendUserService.getRoles().subscribe({
      next: (roles: RoleDto[]) => {
        this.roles = roles;
        this.isLoading = false;
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load roles: ' + (error.message || 'Unknown error');
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
      this.backendUserService.deleteRole(this.selectedRole.id).subscribe({
        next: (success: boolean) => {
          if (success) {
            this.showDeleteConfirm = false;
            this.selectedRole = undefined;
            this.loadRoles();
          }
        },
        error: (error: any) => {
          this.errorMessage = error.message || 'Failed to delete role';
        }
      });
    }
  }

  onRoleSaved(): void {
    this.loadRoles();
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
