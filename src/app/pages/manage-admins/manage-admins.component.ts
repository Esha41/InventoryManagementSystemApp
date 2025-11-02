import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { UserFormModalComponent } from '@components/user-form-modal/user-form-modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { LucideAngularModule, UserPlus, Search, Edit, Trash2, Shield, Mail, User as UserIcon, Power } from 'lucide-angular';
import { BackendUserDto, RoleDto } from '@models/backend-user.model';
import { BackendUserService } from '@services/backend-user.service';

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
    ConfirmDialogComponent
  ],
  templateUrl: './manage-admins.component.html',
  styleUrls: ['./manage-admins.component.css']
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

  users: BackendUserDto[] = [];
  roles: RoleDto[] = [];
  userRolesMap: Map<string, string[]> = new Map(); // Cache user roles
  isLoading = false;
  errorMessage = '';
  
  searchTerm = '';
  selectedRoleId = '';

  // Modal states
  showUserModal = false;
  showDeleteConfirm = false;
  userModalMode: 'create' | 'edit' = 'create';
  selectedUser?: BackendUserDto;

  private destroy$ = new Subject<void>();

  constructor(
    private backendUserService: BackendUserService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
    
    this.backendUserService.users$
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.users = users;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.backendUserService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.isLoading = false;
        // Load roles for each user
        users.forEach(user => this.loadUserRolesData(user.id));
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load users: ' + (error.message || 'Unknown error');
      }
    });
  }

  private loadUserRolesData(userId: string): void {
    this.backendUserService.getUserRoles(userId).subscribe({
      next: (roles) => {
        this.userRolesMap.set(userId, roles.map(r => r.name));
      },
      error: (error) => {
        console.error(`Failed to load roles for user ${userId}:`, error);
        this.userRolesMap.set(userId, []);
      }
    });
  }

 // Returns an array of role names for a given user ID
getUserRoles(userId: string): string[] {
  const user = this.filteredUsers.find(u => u.id === userId);
  if (!user || !user.roleIds) return [];

  // Map roleIds to role names
  return user.roleIds
    .map(roleId => this.roles.find(r => r.id === roleId)?.name)
    .filter(Boolean) as string[]; // remove undefined
}

  loadRoles(): void {
    this.backendUserService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load roles: ' + (error.message || 'Unknown error');
      }
    });
  }

  get filteredUsers(): BackendUserDto[] {
    return this.users.filter(user => {
      const matchesSearch = user.userName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesSearch;
    });
  }

  getUserName(user: BackendUserDto): string {
    return user.userName || user.email;
  }

  getUserInitials(user: BackendUserDto): string {
    const name = user.userName || user.email;
    return name.substring(0, 2).toUpperCase();
  }

  onAddUser(): void {
    this.userModalMode = 'create';
    this.selectedUser = undefined;
    this.showUserModal = true;
  }

  onEdit(user: BackendUserDto): void {
    this.userModalMode = 'edit';
    this.selectedUser = user;
    this.showUserModal = true;
  }

  onDelete(user: BackendUserDto): void {
    this.selectedUser = user;
    this.showDeleteConfirm = true;
  }

  confirmDelete(): void {
    if (this.selectedUser) {
      this.backendUserService.deleteUser(this.selectedUser.id).subscribe({
        next: (success) => {
          if (success) {
            this.showDeleteConfirm = false;
            this.selectedUser = undefined;
            this.loadUsers();
          }
        },
        error: (error) => {
          this.errorMessage = error.message || 'Failed to delete user';
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
    return user.userName || user.email;
  }

  getStatusColor(): string {
    return 'bg-[var(--color-success)]';
  }

  getRoleTypeColor(): string {
    return 'bg-[var(--color-accent)]';
  }
  
}
