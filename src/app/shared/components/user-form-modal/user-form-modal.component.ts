import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { BackendUserDto, RoleDto, CreateUserDto, UpdateUserDto } from '@models/backend-user.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BackendUserService } from '@services/backend-user.service';
import { LookupService, DepartmentDto, LookupItem } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';

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
  isLoading = false;
  errorMessage = '';
  // Departments
  departments: DepartmentDto[] = [];
  isLoadingDepartments = false;
  // Ranks
  ranks: LookupItem[] = [];
  isLoadingRanks = false;

  constructor(
    private fb: FormBuilder,
    private backendUserService: BackendUserService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private translate: TranslateService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadDepartments();
    this.loadRanks();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.initializeForm();
      this.errorMessage = '';
      if (this.user && this.mode === 'edit') {
        this.loadUserRoles();
      }
    }
    if (changes['user'] || changes['mode']) {
      this.initializeForm();
    }
  }

  private initializeForm(): void {
    // Handle both nameEn/nameAr (from frontend) and fullNameEN/fullNameAR (from API)
    const nameEn = this.user?.nameEn || (this.user as any)?.fullNameEN || '';
    const nameAr = this.user?.nameAr || (this.user as any)?.fullNameAR || '';
    
    // Get the first role ID if user has roles (for single selection)
    const roleId = this.user?.roleIds && this.user.roleIds.length > 0 ? this.user.roleIds[0] : null;
    
    this.userForm = this.fb.group({
      userName: [this.user?.userName || '', [Validators.required, Validators.minLength(3)]],
      email: [this.user?.email || '', [Validators.required, Validators.email]],
      isLdapUser: [this.user?.isLdapUser || false],
      extraEmployeesView: [this.user?.extraEmployeesView || ''],
      employeeId: [this.user?.employeeId || null],
      departmentId: [this.user?.departmentId ?? null],
      roleId: [roleId, [Validators.required]], // Single role selection - required
      // Common fields for both create and edit modes
      nameEn: [nameEn],
      nameAr: [nameAr],
      rankId: [this.user?.rankId || null],
      militaryId: [this.user?.militaryId || (this.user as any)?.militoryId || '']
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

  private loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.lookupService.getLookupItems('Department').subscribe({
      next: (deps: DepartmentDto[]) => {
        this.departments = deps ?? [];
        this.isLoadingDepartments = false;
      },
      error: () => {
        this.departments = [];
        this.isLoadingDepartments = false;
      }
    });
  }

  private loadRanks(): void {
    this.isLoadingRanks = true;
    this.lookupService.getLookupItems('Rank').subscribe({
      next: (items: LookupItem[]) => {
        this.ranks = items ?? [];
        this.isLoadingRanks = false;
      },
      error: () => {
        this.ranks = [];
        this.isLoadingRanks = false;
      }
    });
  }

private loadUserRoles(): void {
  if (!this.user?.id) return;

  this.backendUserService.getUserRoles(this.user.id).subscribe({
    next: (roles: any[]) => {
      // If roles are returned from getUserRoles, use them (they should include all roles with selection info)
      // Otherwise, keep the existing roles from loadRoles()
      if (roles && roles.length > 0) {
        // Map to RoleDto, including required fields
        this.roles = roles.map(r => ({
          id: r.roleId,
          name: r.roleName,
          isDefaultRole: r.isDefaultRole || false,  // set default if missing
          isSuperAdmin: r.isSuperAdmin || false     // set default if missing
        }));
      }

      // Pre-select the first selected role (single selection)
      const selectedRole = roles?.find(r => r.isSelected);
      if (selectedRole) {
        this.userForm.patchValue({ roleId: selectedRole.roleId });
      } else if (this.user?.roleIds && this.user.roleIds.length > 0) {
        // Fallback: use the first role ID from user data
        this.userForm.patchValue({ roleId: this.user.roleIds[0] });
      }

      // Bind department for edit form if provided in the response
      const selectedWithDept = roles?.find(r => r.isSelected && (r.departmentId != null || r.deparmentId != null));
      const deptId = selectedWithDept?.departmentId ?? selectedWithDept?.deparmentId;
      if (deptId != null) {
        this.userForm.patchValue({ departmentId: deptId });
      }

      console.log('Selected role for user:', selectedRole?.roleId || this.user?.roleIds?.[0]);
    },
    error: (error: any) => {
      // If getUserRoles fails, still try to set the role from user data
      if (this.user?.roleIds && this.user.roleIds.length > 0) {
        this.userForm.patchValue({ roleId: this.user.roleIds[0] });
      }
      console.error('Failed to load user roles:', error);
      // Don't show error message as roles might already be loaded from loadRoles()
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

  this.isLoading = true;
  this.errorMessage = '';

  if (this.mode === 'create') {
    const formValue = this.userForm.value;
    
    const dto: CreateUserDto = {
      userName: formValue.userName,
      email: formValue.email,
      password: formValue.password,
      isLdapUser: formValue.isLdapUser || false,
      extraEmployeesView: formValue.extraEmployeesView || undefined,
      employeeId: formValue.employeeId || undefined,
      organizationId: 1,
      departmentId: formValue.departmentId || undefined,
      roleIds: [formValue.roleId], // Single role as array
      // Map form field names to API field names
      fullNameEN: formValue.nameEn || undefined,
      fullNameAR: formValue.nameAr || undefined,
      rankId: formValue.rankId || undefined,
      militoryId: formValue.militaryId != null ? String(formValue.militaryId).trim() : undefined
    };

    console.log('Creating user with DTO:', JSON.stringify(dto, null, 2));
    console.log('Military ID - Raw form value:', formValue.militaryId, 'Type:', typeof formValue.militaryId, 'In DTO (militoryId):', dto.militoryId);

    this.backendUserService.createUser(dto).subscribe({
      next: (user: BackendUserDto) => {
        this.isLoading = false;
        this.toastService.success(this.translate.instant('userFormModal.createSuccess'));
        this.saved.emit();
        this.close();
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Failed to create user';
        console.error('Error creating user:', error);
      }
    });
  } else if (this.user) {
    const formValue = this.userForm.value;
    
    // Handle militaryId - always include in update, even if empty (to allow clearing the field)
    const militaryIdValue = formValue.militaryId != null 
      ? String(formValue.militaryId).trim() 
      : undefined;
    
    const dto: UpdateUserDto = {
      id: this.user.id,
      userName: formValue.userName,
      email: formValue.email,
      password: formValue.password || undefined,
      isLdapUser: formValue.isLdapUser || false,
      extraEmployeesView: formValue.extraEmployeesView || undefined,
      employeeId: formValue.employeeId || undefined,
      organizationId: this.user.organizationId,
      departmentId: formValue.departmentId || undefined,
      roleIds: [formValue.roleId], // Single role as array
      // Map form field names to API field names
      fullNameEN: formValue.nameEn || undefined,
      fullNameAR: formValue.nameAr || undefined,
      rankId: formValue.rankId || undefined,
      militoryId: militaryIdValue // Include even if empty string to allow clearing
    };

    console.log('Updating user with DTO:', JSON.stringify(dto, null, 2));
    console.log('Military ID - Raw form value:', formValue.militaryId, 'Type:', typeof formValue.militaryId);
    console.log('Military ID - Processed value (militoryId):', dto.militoryId);

    this.backendUserService.updateUser(this.user.id, dto).subscribe({
      next: (user: BackendUserDto) => {
        this.isLoading = false;
        this.toastService.success(this.translate.instant('userFormModal.updateSuccess'));
        this.saved.emit();
        this.close();
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Failed to update user';
        console.error('Error updating user:', error);
      }
    });
  }
}

  close(): void {
    this.userForm.reset();
    this.errorMessage = '';
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

