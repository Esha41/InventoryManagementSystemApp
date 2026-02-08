import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { BackendUserDto, RoleDto, CreateUserDto, UpdateUserDto } from '@models/backend-user.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BackendUserService } from '@services/backend-user.service';
import { LookupService, DepartmentDto, LookupItem } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { Subscription } from 'rxjs';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { BackendAuthService } from '@services/backend-auth.service';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    TranslateModule,
    DropdownComponent
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
  private rolesSubscription?: Subscription;
  private departmentsSubscription?: Subscription;
  private ranksSubscription?: Subscription;

  errorMessage = '';
  private isLdapToggleSubscription?: Subscription;
  // Departments
  departments: DepartmentDto[] = [];
  isLoadingDepartments = false;
  // Ranks
  ranks: LookupItem[] = [];
  isLoadingRanks = false;
  // Super admin check
  isCurrentUserSuperAdmin = false;
  readonly departmentOptionLabel = (option: DropdownOption<DepartmentDto> | DepartmentDto | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly rankOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) =>
    this.getLocalizedName(this.unwrapOption(option));
  readonly roleOptionLabel = (option: DropdownOption<RoleDto> | RoleDto | null) => {
    const role = this.unwrapOption(option);
    return role ? getLocalizedName(role, getCurrentLang(this.translate)) || role.name || '' : '';
  };

  constructor(
    private fb: FormBuilder,
    private backendUserService: BackendUserService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private translate: TranslateService,
    private authService: BackendAuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.isCurrentUserSuperAdmin = this.authService.isSuperAdmin();
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

    // Get all role IDs if user has roles (for multiple selection)
    const roleIds = this.user?.roleIds && this.user.roleIds.length > 0 ? this.user.roleIds : [];

    // For non-super-admin users, automatically set IsLdapUser to true
    const isLdapUser = !this.isCurrentUserSuperAdmin ? true : (this.user?.isLdapUser || false);

    // For non-super-admin users, userName and password are optional
    const userNameValidators = this.isCurrentUserSuperAdmin
      ? [Validators.required, Validators.minLength(3)]
      : [];
    const passwordValidators = this.isCurrentUserSuperAdmin
      ? [Validators.required, Validators.minLength(6)]
      : [];

    this.userForm = this.fb.group({
      userName: [this.user?.userName || '', userNameValidators],
      email: [this.user?.email || '', [Validators.required, Validators.email]],
      isLdapUser: [{ value: isLdapUser, disabled: !this.isCurrentUserSuperAdmin }],
      ldapUserName: [this.user?.ldapUserName || ''],
      isActive: [this.user?.isActive ?? true],
      extraEmployeesView: [this.user?.extraEmployeesView || ''],
      departmentId: [this.user?.departmentId ?? null],
      roleIds: [roleIds, [this.validateRoleIds.bind(this)]], // Multiple role selection - required
      // Common fields for both create and edit modes
      nameEn: [nameEn],
      nameAr: [nameAr],
      rankId: [this.user?.rankId || null],
      militaryId: [this.user?.militaryId || (this.user as any)?.militoryId || '']
    });

    if (this.mode === 'create') {
      this.userForm.addControl('password', this.fb.control('', passwordValidators));
    }

    this.setupLdapUserControls();
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
        isSuperAdmin: true,
        isAdmin: true
      },
      {
        id: '2',
        name: 'Warehouse Manager',
        isDefaultRole: false,
        isSuperAdmin: false,
        isAdmin: false
      },
      {
        id: '3',
        name: 'Inventory Clerk',
        isDefaultRole: true,
        isSuperAdmin: false,
        isAdmin: false
      },
      {
        id: '4',
        name: 'Viewer',
        isDefaultRole: false,
        isSuperAdmin: false,
        isAdmin: false
      },
      {
        id: '5',
        name: 'Editor',
        isDefaultRole: false,
        isSuperAdmin: false,
        isAdmin: false
      },
      {
        id: '6',
        name: 'Moderator',
        isDefaultRole: false,
        isSuperAdmin: false,
        isAdmin: false
      }
    ];
  }

  private loadDepartments(): void {
    this.isLoadingDepartments = true;
    const control = this.userForm?.get('departmentId');
    if (control) control.disable({ emitEvent: false });

    this.lookupService.getLookupItems('Department').subscribe({
      next: (deps: DepartmentDto[]) => {
        this.departments = deps ?? [];
        this.isLoadingDepartments = false;
        if (control) control.enable({ emitEvent: false });
      },
      error: () => {
        this.departments = [];
        this.isLoadingDepartments = false;
        if (control) control.enable({ emitEvent: false });
      }
    });
  }

  private loadRanks(): void {
    this.isLoadingRanks = true;
    const control = this.userForm?.get('rankId');
    if (control) control.disable({ emitEvent: false });

    this.lookupService.getLookupItems('Rank').subscribe({
      next: (items: LookupItem[]) => {
        this.ranks = items ?? [];
        this.isLoadingRanks = false;
        if (control) control.enable({ emitEvent: false });
      },
      error: () => {
        this.ranks = [];
        this.isLoadingRanks = false;
        if (control) control.enable({ emitEvent: false });
      }
    });
  }

  private unwrapOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (!option) {
      return null;
    }
    if (typeof option === 'object' && option !== null && 'value' in option) {
      return option.value as T;
    }
    return option as T;
  }

  private getLocalizedName(entity: { nameEn?: string; nameAr?: string } | null | undefined): string {
    if (!entity) {
      return '';
    }
    return getLocalizedName(entity, getCurrentLang(this.translate));
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
            isSuperAdmin: r.isSuperAdmin || false,     // set default if missing
            isAdmin: r.isAdmin || false               // set default if missing
          }));
        }

        // Pre-select all selected roles (multiple selection)
        const selectedRoleIds = roles?.filter(r => r.isSelected).map(r => r.roleId) || [];
        if (selectedRoleIds.length > 0) {
          this.userForm.patchValue({ roleIds: selectedRoleIds });
        } else if (this.user?.roleIds && this.user.roleIds.length > 0) {
          // Fallback: use all role IDs from user data
          this.userForm.patchValue({ roleIds: this.user.roleIds });
        }

        // Bind department for edit form if provided in the response
        const selectedWithDept = roles?.find(r => r.isSelected && (r.departmentId != null || r.deparmentId != null));
        const deptId = selectedWithDept?.departmentId ?? selectedWithDept?.deparmentId;
        if (deptId != null) {
          this.userForm.patchValue({ departmentId: deptId });
        }
      },
      error: (error: any) => {
        // If getUserRoles fails, still try to set the roles from user data
        if (this.user?.roleIds && this.user.roleIds.length > 0) {
          this.userForm.patchValue({ roleIds: this.user.roleIds });
        }
        // Don't show error message as roles might already be loaded from loadRoles()
      }
    });
  }

  /**
   * Custom validator to ensure at least one role is selected
   */
  validateRoleIds(control: any): { [key: string]: any } | null {
    const roleIds = control.value;
    if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
      return { required: true };
    }
    return null;
  }



  get title(): string {
    if (this.mode === 'create') {
      return this.translate.instant('userFormModal.addNewUser');
    } else {
      return `${this.translate.instant('userFormModal.editUser')}: ${this.user?.userName}`;
    }
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'create') {
      const formValue = this.userForm.getRawValue();

      // For non-super-admin users, ensure isLdapUser is true
      const isLdapUser = !this.isCurrentUserSuperAdmin ? true : (formValue.isLdapUser || false);

      const dto: CreateUserDto = {
        userName: formValue.userName || undefined,
        email: formValue.email,
        password: formValue.password || undefined,
        isLdapUser: isLdapUser,
        ldapUserName: formValue.ldapUserName || undefined,
        extraEmployeesView: formValue.extraEmployeesView || undefined,
        organizationId: 1,
        departmentId: formValue.departmentId || undefined,
        roleIds: formValue.roleIds || [], // Multiple roles as array
        // Map form field names to API field names
        fullNameEN: formValue.nameEn || undefined,
        fullNameAR: formValue.nameAr || undefined,
        rankId: formValue.rankId || undefined,
        isActive: formValue.isActive ?? true,
        militoryId: formValue.militaryId != null ? String(formValue.militaryId).trim() : undefined
      };

      this.backendUserService.createUser(dto).subscribe({
        next: (user: BackendUserDto) => {
          this.isLoading = false;
          this.errorMessage = '';
          this.toastService.success(
            this.translate.instant('userFormModal.createSuccess'),
            this.translate.instant('userFormModal.createTitle')
          );
          this.saved.emit();
          this.close();
        },
        error: (error: unknown) => {
          this.isLoading = false;
          
          // Extract error message from various possible locations
          let errorMsg = this.translate.instant('userFormModal.createError');
          
          if (error instanceof Error) {
            errorMsg = error.message || errorMsg;
          } else if (error && typeof error === 'object') {
            // Handle HTTP error response
            const httpError = error as any;
            if (httpError.error?.message) {
              errorMsg = httpError.error.message;
            } else if (httpError.error?.data?.message) {
              errorMsg = httpError.error.data.message;
            } else if (httpError.error?.error?.message) {
              errorMsg = httpError.error.error.message;
            } else if (typeof httpError.error === 'string') {
              errorMsg = httpError.error;
            } else if (httpError.message) {
              errorMsg = httpError.message;
            }
          }
          
          // Check for domain-related errors and translate them
          if (errorMsg.includes('Invalid domain') || errorMsg.includes('domain')) {
            const domainMatch = errorMsg.match(/domain:\s*([^\s]+)/i);
            if (domainMatch && domainMatch[1]) {
              errorMsg = this.translate.instant('userFormModal.invalidDomain', { domain: domainMatch[1] });
            } else {
              errorMsg = this.translate.instant('userFormModal.invalidDomain', { domain: '' });
            }
          } else if (errorMsg.includes('Unable to retrieve LDAP settings')) {
            errorMsg = this.translate.instant('userFormModal.ldapSettingsUnavailable');
          }
          
          this.errorMessage = errorMsg;
          this.cdr.detectChanges();
          this.toastService.error(
            errorMsg,
            this.translate.instant('userFormModal.createTitle')
          );
        }
      });
    } else if (this.user) {
      const formValue = this.userForm.getRawValue();

      // Handle militaryId - always include in update, even if empty (to allow clearing the field)
      const militaryIdValue = formValue.militaryId != null
        ? String(formValue.militaryId).trim()
        : undefined;

      // For non-super-admin users, ensure isLdapUser is true
      const isLdapUser = !this.isCurrentUserSuperAdmin ? true : (formValue.isLdapUser || false);

      const dto: UpdateUserDto = {
        id: this.user.id,
        userName: formValue.userName,
        email: formValue.email,
        password: formValue.password || undefined,
        isLdapUser: isLdapUser,
        ldapUserName: formValue.ldapUserName || undefined,
        extraEmployeesView: formValue.extraEmployeesView || undefined,
        organizationId: this.user.organizationId,
        departmentId: formValue.departmentId || undefined,
        roleIds: formValue.roleIds || [], // Multiple roles as array
        // Map form field names to API field names
        fullNameEN: formValue.nameEn || undefined,
        fullNameAR: formValue.nameAr || undefined,
        rankId: formValue.rankId || undefined,
        isActive: formValue.isActive ?? true,
        militoryId: militaryIdValue // Include even if empty string to allow clearing
      };

      this.backendUserService.updateUser(this.user.id, dto).subscribe({
        next: (user: BackendUserDto) => {
          this.isLoading = false;
          this.errorMessage = '';
          this.toastService.success(
            this.translate.instant('userFormModal.updateSuccess'),
            this.translate.instant('userFormModal.updateTitle')
          );
          this.saved.emit();
          this.close();
        },
        error: (error: unknown) => {
          this.isLoading = false;
          
          // Extract error message from various possible locations
          let errorMsg = this.translate.instant('userFormModal.updateError');
          
          if (error instanceof Error) {
            errorMsg = error.message || errorMsg;
          } else if (error && typeof error === 'object') {
            // Handle HTTP error response
            const httpError = error as any;
            if (httpError.error?.message) {
              errorMsg = httpError.error.message;
            } else if (httpError.error?.data?.message) {
              errorMsg = httpError.error.data.message;
            } else if (httpError.error?.error?.message) {
              errorMsg = httpError.error.error.message;
            } else if (typeof httpError.error === 'string') {
              errorMsg = httpError.error;
            } else if (httpError.message) {
              errorMsg = httpError.message;
            }
          }
          
          // Check for domain-related errors and translate them
          if (errorMsg.includes('Invalid domain') || errorMsg.includes('domain')) {
            const domainMatch = errorMsg.match(/domain:\s*([^\s]+)/i);
            if (domainMatch && domainMatch[1]) {
              errorMsg = this.translate.instant('userFormModal.invalidDomain', { domain: domainMatch[1] });
            } else {
              errorMsg = this.translate.instant('userFormModal.invalidDomain', { domain: '' });
            }
          } else if (errorMsg.includes('Unable to retrieve LDAP settings')) {
            errorMsg = this.translate.instant('userFormModal.ldapSettingsUnavailable');
          }
          
          this.errorMessage = errorMsg;
          this.cdr.detectChanges();
          this.toastService.error(
            errorMsg,
            this.translate.instant('userFormModal.updateTitle')
          );
        }
      });
    }
  }


  close(): void {
    this.isLdapToggleSubscription?.unsubscribe();
    this.isLdapToggleSubscription = undefined;
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
        if (fieldName === 'roleIds') {
          return 'At least one role must be selected';
        }
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

  private setupLdapUserControls(): void {
    this.isLdapToggleSubscription?.unsubscribe();
    this.isLdapToggleSubscription = undefined;

    const isLdapControl = this.userForm.get('isLdapUser');
    const ldapUserNameControl = this.userForm.get('ldapUserName');

    if (!isLdapControl || !ldapUserNameControl) {
      return;
    }

    // For non-super-admin users, ldapUserName is always required
    if (!this.isCurrentUserSuperAdmin) {
      ldapUserNameControl.enable({ emitEvent: false });
      ldapUserNameControl.setValidators([Validators.required]);
      ldapUserNameControl.updateValueAndValidity({ emitEvent: false });
      return;
    }

    // For super-admin users, handle LDAP toggle behavior
    const applyState = (isLdap: boolean) => {
      if (isLdap) {
        ldapUserNameControl.enable({ emitEvent: false });
        ldapUserNameControl.setValidators([Validators.required]);
      } else {
        ldapUserNameControl.setValidators([]);
        ldapUserNameControl.setValue('', { emitEvent: false });
        ldapUserNameControl.disable({ emitEvent: false });
      }
      ldapUserNameControl.updateValueAndValidity({ emitEvent: false });
    };

    applyState(isLdapControl.value === true);

    this.isLdapToggleSubscription = isLdapControl.valueChanges.subscribe(value => {
      applyState(value === true);
    });
  }
}

