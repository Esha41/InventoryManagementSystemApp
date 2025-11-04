import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { BackendUserDto, RoleDto, CreateUserDto, UpdateUserDto } from '@models/backend-user.model';
import { TranslateModule } from '@ngx-translate/core';
import { BackendUserService } from '@services/backend-user.service';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    TranslateModule
  ],
  templateUrl: './user-form-modal.component.html',
  styleUrls: ['./user-form-modal.component.css']
})
export class UserFormModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() user?: BackendUserDto;
  @Input() mode: 'create' | 'edit' = 'create';
  
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  userForm!: FormGroup;
  roles: RoleDto[] = [];
  selectedRoleIds: string[] = [];
  showRolesDropdown = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private backendUserService: BackendUserService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadRoles();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.initializeForm();
      this.errorMessage = '';
      if (this.user && this.mode === 'edit') {
        this.loadUserRoles();
      } else {
        this.selectedRoleIds = [];
      }
    }
    if (changes['user'] || changes['mode']) {
      this.initializeForm();
    }
  }

  private initializeForm(): void {
    this.userForm = this.fb.group({
      userName: [this.user?.userName || '', [Validators.required, Validators.minLength(3)]],
      isLdapUser: [this.user?.isLdapUser || false],
      extraEmployeesView: [this.user?.extraEmployeesView || ''],
      employeeId: [this.user?.employeeId || null]
    });

    if (this.mode === 'create') {
      this.userForm.addControl('password', this.fb.control('', [Validators.required, Validators.minLength(6)]));
    }
  }

  private loadRoles(): void {
    this.backendUserService.getRoles().subscribe({
      next: (roles: RoleDto[]) => {
        this.roles = roles;
        
        // If no roles returned from API, use fallback sample roles for development
        if (this.roles.length === 0) {
          this.loadFallbackRoles();
        }
      },
      error: (error: any) => {
        console.error('Failed to load roles from API:', error);
        this.errorMessage = 'Failed to load roles';
        // Load fallback roles on error
        this.loadFallbackRoles();
      }
    });
  }

  private loadFallbackRoles(): void {
    // Fallback sample roles for development/testing
    this.roles = [
      { 
        id: '1', 
        name: 'Administrator', 
        isDefaultRole: false, 
        isSuperAdmin: true 
      },
      { 
        id: '2', 
        name: 'Warehouse Manager', 
        isDefaultRole: false, 
        isSuperAdmin: false 
      },
      { 
        id: '3', 
        name: 'Inventory Clerk', 
        isDefaultRole: true, 
        isSuperAdmin: false 
      },
      { 
        id: '4', 
        name: 'Viewer', 
        isDefaultRole: false, 
        isSuperAdmin: false 
      },
      { 
        id: '5', 
        name: 'Editor', 
        isDefaultRole: false, 
        isSuperAdmin: false 
      },
      { 
        id: '6', 
        name: 'Moderator', 
        isDefaultRole: false, 
        isSuperAdmin: false 
      }
    ];
    console.log('Using fallback roles:', this.roles);
  }

private loadUserRoles(): void {
  if (!this.user?.id) return;

  this.backendUserService.getUserRoles(this.user.id).subscribe({
    next: (roles: any[]) => {
      // Map to RoleDto, including required fields
      this.roles = roles.map(r => ({
        id: r.roleId,
        name: r.roleName,
        isDefaultRole: r.isDefaultRole || false,  // set default if missing
        isSuperAdmin: r.isSuperAdmin || false     // set default if missing
      }));

      // Pre-select roles that user already has
      this.selectedRoleIds = roles
        .filter(r => r.isSelected)
        .map(r => r.roleId);

      console.log('Selected roles for user:', this.selectedRoleIds);
    },
    error: (error: any) => {
      this.errorMessage = 'Failed to load user roles';
      console.error(error);
    }
  });
}



  get title(): string {
    return this.mode === 'create' ? 'Add New User' : `Edit User: ${this.user?.userName}`;
  }

  onSubmit(): void {
  if (this.userForm.invalid) {
    this.markFormGroupTouched();
    return;
  }

  if (this.selectedRoleIds.length === 0) {
    this.errorMessage = 'Please select at least one role';
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';

  if (this.mode === 'create') {
    const dto: CreateUserDto = {
      ...this.userForm.value,
      organizationId: 1,
      roleIds: this.selectedRoleIds // include roles here
    };

    this.backendUserService.createUser(dto).subscribe({
      next: (user: BackendUserDto) => {
        this.isLoading = false;
        this.saved.emit();
        this.close();
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Failed to create user';
      }
    });
  } else if (this.user) {
    const dto: UpdateUserDto = {
      id: this.user.id,
      ...this.userForm.value,
      organizationId: this.user.organizationId,
      roleIds: this.selectedRoleIds // include roles here
    };

    this.backendUserService.updateUser(this.user.id, dto).subscribe({
      next: (user: BackendUserDto) => {
        this.isLoading = false;
        this.saved.emit();
        this.close();
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Failed to update user';
      }
    });
  }
}

  toggleRolesDropdown(): void {
    this.showRolesDropdown = !this.showRolesDropdown;
  }

toggleRoleSelection(roleId: string | undefined): void {
  // Remove undefined values first
  this.selectedRoleIds = this.selectedRoleIds.filter(id => !!id);

  if (!roleId) return; // skip invalid ids

  const index = this.selectedRoleIds.indexOf(roleId);
  if (index > -1) {
    this.selectedRoleIds.splice(index, 1);
  } else {
    this.selectedRoleIds.push(roleId);
  }

  console.log("selectedRoleIds here", this.selectedRoleIds);
}


  isRoleSelected(roleId: string): boolean {
    return this.selectedRoleIds.includes(roleId);
  }

  getSelectedRolesText(): string {
    if (this.selectedRoleIds.length === 0) {
      return 'Select roles';
    }
    const selectedRoles = this.roles.filter(r => this.selectedRoleIds.includes(r.id));
    return selectedRoles.map(r => r.name).join(', ');
  }

  close(): void {
    this.userForm.reset();
    this.errorMessage = '';
    this.selectedRoleIds = [];
    this.showRolesDropdown = false;
    this.closed.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.userForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        const displayName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1');
        return `${displayName} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        return `Minimum length is ${field.errors['minlength'].requiredLength}`;
      }
    }
    return '';
  }
}

