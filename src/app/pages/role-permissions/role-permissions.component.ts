import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, Shield, Save, RefreshCw, Search, ChevronDown, ChevronUp, X } from 'lucide-angular';

import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { RoleDto, CrudPermission } from '@models/backend-user.model';
import { CardComponent } from '@components/card/card.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { LoadingStateComponent } from '@components/index';

// ============================================================================
// INTERFACES
// ============================================================================

interface PermissionCategory {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  permissions: CrudPermission[];
  expanded: boolean;
  permissionTypes?: string[]; // Cached for performance
}

interface PermissionInfo {
  key: string;
  label: string;
  description: string;
  page?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    TranslateModule,
    ButtonComponent,
    RowsPerPageComponent,
    HasPermissionDirective,
    LoadingStateComponent
  ],
  templateUrl: './role-permissions.component.html',
  styleUrls: ['./role-permissions.component.css']
})
export class RolePermissionsComponent implements OnInit, OnDestroy {
  // ============================================================================
  // ICONS
  // ============================================================================
  readonly Shield = Shield;
  readonly Save = Save;
  readonly RefreshCw = RefreshCw;
  readonly Search = Search;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly X = X;

  // ============================================================================
  // STATE
  // ============================================================================
  roles: RoleDto[] = [];
  selectedRole: RoleDto | null = null;
  permissions: CrudPermission[] = [];
  plainPermissions: CrudPermission[] = [];
  
  categories: PermissionCategory[] = [];
  filteredCategories: PermissionCategory[] = [];
  
  roleSearchTerm = '';
  permissionSearchTerm = '';
  
  isLoading = false;
  isSaving = false;
  
  rowsPerPage = 10;
  
  permissionForm: FormGroup;
  private destroy$ = new Subject<void>();

  // ============================================================================
  // PERMISSION METADATA (for better UX)
  // ============================================================================
  private readonly permissionDescriptions: { [key: string]: PermissionInfo } = {
    'dashboard_view': { key: 'dashboard_view', label: 'View', description: 'Access main dashboard page', page: '/dashboard' },
    'request_create': { key: 'request_create', label: 'Create', description: 'Create new issue, return, or discard requests', page: '/new-issue-request' },
    'request_view': { key: 'request_view', label: 'View', description: 'View requests list and details', page: '/requests-management' },
    'request_manage': { key: 'request_manage', label: 'Manage', description: 'Edit, approve, and manage all requests', page: '/supply-request-management' },
    'asset_create': { key: 'asset_create', label: 'Create', description: 'Add new ammunition/assets to inventory', page: '/add-asset' },
    'asset_view': { key: 'asset_view', label: 'View', description: 'View ammunition inventory list', page: '/asset-list' },
    'inventory_view': { key: 'inventory_view', label: 'View', description: 'View warehouse inventory', page: '/warehouse' },
    'user_view': { key: 'user_view', label: 'View', description: 'View system users list', page: '/manage-admins' },
    'role_view': { key: 'role_view', label: 'View', description: 'View roles list', page: '/admin-roles' },
    'role_edit': { key: 'role_edit', label: 'Edit', description: 'Edit role permissions', page: '/role-permissions' },
    'CanChangePassword': { key: 'CanChangePassword', label: 'Change Password', description: 'Allow users to change their own password', page: '' },
    'CanGenerateReport': { key: 'CanGenerateReport', label: 'Generate Reports', description: 'Generate and export system reports', page: '' },
    'CanImportData': { key: 'CanImportData', label: 'Import Data', description: 'Import data into the system', page: '' },
    'EmailLogs': { key: 'EmailLogs', label: 'Email Logs', description: 'View email logs and notifications', page: '' },
  };

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================
  constructor(
    private backendUserService: BackendUserService,
    private fb: FormBuilder,
    private toastService: ToastService,
    private translateService: TranslateService
  ) {
    this.permissionForm = this.fb.group({});
  }

  // ============================================================================
  // LIFECYCLE HOOKS
  // ============================================================================
  ngOnInit(): void {
    this.loadRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  get filteredRoles(): RoleDto[] {
    const search = this.roleSearchTerm.trim().toLowerCase();
    if (!search) return this.roles;
    return this.roles.filter(role => role.name?.toLowerCase().includes(search));
  }

  get paginatedRoles(): RoleDto[] {
    return this.filteredRoles.slice(0, this.rowsPerPage);
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================
  loadRoles(): void {
    this.isLoading = true;
    this.backendUserService.getRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.roles = roles;
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
          this.toastService.error('Failed to load roles', 'Error');
        }
      });
  }

  onRoleSelect(role: RoleDto): void {
    this.selectedRole = role;
    this.loadRolePermissions(role.id);
  }

  loadRolePermissions(roleId: string): void {
    this.isLoading = true;
    
    // Load both CRUD and Plain permissions in parallel
    forkJoin({
      crud: this.backendUserService.getCrudPermissionsForRole(roleId),
      plain: this.backendUserService.getPlainPermissionsForRole(roleId)
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ crud, plain }) => {
        this.permissions = crud;
        this.plainPermissions = plain;
        this.organizePermissions();
        this.createPermissionForm();
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        this.toastService.error('Failed to load permissions', 'Error');
      }
    });
  }

  // ============================================================================
  // PERMISSION ORGANIZATION
  // ============================================================================
  private organizePermissions(): void {
    const categoryMap = new Map<string, PermissionCategory>();

    // Process CRUD permissions
    this.permissions.forEach(group => {
      const category = group.category || 'Other';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          name: category,
          displayName: this.getCategoryDisplayName(category),
          description: this.getCategoryDescription(category),
          icon: this.getCategoryIcon(category),
          permissions: [],
          expanded: true
        });
      }
      categoryMap.get(category)!.permissions.push(group);
    });

    // Process Plain permissions
    this.plainPermissions.forEach(group => {
      const category = group.entityName || 'Other';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          name: category,
          displayName: category,
          description: this.getCategoryDescription(category),
          icon: this.getCategoryIcon(category),
          permissions: [],
          expanded: true
        });
      }
      categoryMap.get(category)!.permissions.push(group);
    });

    // Sort categories by priority
    this.categories = Array.from(categoryMap.values()).sort((a, b) => {
      const order = ['Dashboard', 'Requests', 'Inventory', 'User Management', 'System Features', 'Other'];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });
    
    // Pre-calculate permission types for performance (avoids recalculation in template)
    this.categories.forEach(category => {
      category.permissionTypes = this.calculateUniquePermissionTypes(category);
    });
    
    this.filteredCategories = this.categories;
  }

  // ============================================================================
  // CATEGORY METADATA
  // ============================================================================
  private getCategoryDisplayName(category: string): string {
    const names: { [key: string]: string } = {
      'Dashboard': 'Dashboard',
      'Requests': 'Requests & Orders',
      'Inventory': 'Inventory & Assets',
      'UserManagement': 'Admin & Users',
      'User Management': 'Admin & Users',
      'SettingsSupport': 'Settings & Support',
      'OrganizationSettings': 'System Configuration',
      'RequestManagement': 'Request Management',
      'WorkFlowType': 'Workflows',
      'System Features': 'System Features'
    };
    return names[category] || category;
  }

  private getCategoryDescription(category: string): string {
    const descriptions: { [key: string]: string } = {
      'Dashboard': 'Main dashboard and overview pages',
      'Requests': 'Create, view, and manage supply requests and orders',
      'Inventory': 'Manage ammunition, assets, and warehouse inventory',
      'UserManagement': 'Manage system administrators, users, and roles',
      'User Management': 'Manage system administrators, users, and roles',
      'System Features': 'Additional system capabilities like reports and imports',
      'SettingsSupport': 'System settings and support tools',
      'OrganizationSettings': 'Manage departments, suppliers, manufacturers, and system lookups',
      'RequestManagement': 'Advanced request management features',
      'WorkFlowType': 'Workflow type configurations'
    };
    return descriptions[category] || 'Permissions for ' + category;
  }

  private getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'Dashboard': '📊',
      'Requests': '📝',
      'Inventory': '📦',
      'UserManagement': '👥',
      'User Management': '👥',
      'System Features': '⚙️',
      'SettingsSupport': '🛠️',
      'OrganizationSettings': '🏢',
      'RequestManagement': '📋',
      'WorkFlowType': '🔄'
    };
    return icons[category] || '📁';
  }

  // ============================================================================
  // SEARCH & FILTERING
  // ============================================================================
  onPermissionSearchChange(): void {
    this.filterPermissions();
  }

  private filterPermissions(): void {
    if (!this.permissionSearchTerm || this.permissionSearchTerm.trim() === '') {
      this.filteredCategories = this.categories;
      return;
    }

    const searchLower = this.permissionSearchTerm.toLowerCase().trim();
    
    this.filteredCategories = this.categories
      .map(category => {
        const categoryMatches = 
          category.name.toLowerCase().includes(searchLower) ||
          category.displayName.toLowerCase().includes(searchLower) ||
          category.description.toLowerCase().includes(searchLower);

        const filteredPermissions = category.permissions
          .map(group => {
            const entityMatches = group.entityName.toLowerCase().includes(searchLower);

            const filteredPermissionsList = group.permissionsList.filter(perm => {
              const permInfo = this.getPermissionInfo(perm.displayValue);
              return (
                perm.displayValue.toLowerCase().includes(searchLower) ||
                permInfo.label.toLowerCase().includes(searchLower) ||
                permInfo.description.toLowerCase().includes(searchLower) ||
                (permInfo.page && permInfo.page.toLowerCase().includes(searchLower))
              );
            });

            if (entityMatches || filteredPermissionsList.length > 0) {
              return {
                ...group,
                permissionsList: entityMatches ? group.permissionsList : filteredPermissionsList
              };
            }
            return null;
          })
          .filter((group): group is CrudPermission => group !== null);

        if (categoryMatches || filteredPermissions.length > 0) {
          const filteredCategory = {
            ...category,
            permissions: filteredPermissions,
            expanded: this.permissionSearchTerm.trim() !== '' ? true : category.expanded
          };
          filteredCategory.permissionTypes = this.calculateUniquePermissionTypes(filteredCategory);
          return filteredCategory;
        }
        return null;
      })
      .filter((category): category is PermissionCategory => category !== null);
  }

  // ============================================================================
  // PERMISSION FORM
  // ============================================================================
  private createPermissionForm(): void {
    const formControls: { [key: string]: any } = {};

    // Add CRUD permissions to form
    this.permissions.forEach(group => {
      group.permissionsList.forEach(perm => {
        const controlKey = this.sanitizeControlName(perm.displayValue);
        formControls[controlKey] = [perm.isSelected || false];
      });
    });

    // Add Plain permissions to form
    this.plainPermissions.forEach(group => {
      group.permissionsList.forEach(perm => {
        const controlKey = this.sanitizeControlName(perm.displayValue);
        formControls[controlKey] = [perm.isSelected || false];
      });
    });

    this.permissionForm = this.fb.group(formControls);
  }

  sanitizeControlName(name: any): string {
    if (typeof name !== 'string') {
      name = String(name);
    }
    return name.replace(/\./g, '_').replace(/\s+/g, '_');
  }

  // ============================================================================
  // PERMISSION INFO HELPERS
  // ============================================================================
  getPermissionInfo(displayValue: string | null | undefined): PermissionInfo {
    if (!displayValue) {
      return { key: '', label: '', description: '' };
    }

    const parts = displayValue.split('.');
    const key = parts[parts.length - 1];
    
    // Check if we have metadata for this permission
    if (this.permissionDescriptions[key]) {
      return this.permissionDescriptions[key];
    }

    // Generate default info
    return {
      key: key,
      label: key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim(),
      description: `Permission: ${key}`,
      page: ''
    };
  }

  getUniquePermissionTypes(category: PermissionCategory): string[] {
    // Return cached result if available (performance optimization)
    if (category.permissionTypes) {
      return category.permissionTypes;
    }
    return this.calculateUniquePermissionTypes(category);
  }

  private calculateUniquePermissionTypes(category: PermissionCategory): string[] {
    const permissionTypes = new Set<string>();
    
    category.permissions.forEach(group => {
      group.permissionsList.forEach(perm => {
        const label = this.getPermissionInfo(perm.displayValue).label;
        if (label) {
          permissionTypes.add(label);
        }
      });
    });
    
    // Sort by priority: Page, View, Create, Edit, Delete
    const order = ['Page', 'View', 'Create', 'Edit', 'Delete'];
    return Array.from(permissionTypes).sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  // ============================================================================
  // UI INTERACTIONS
  // ============================================================================
  toggleCategory(category: PermissionCategory): void {
    category.expanded = !category.expanded;
  }

  onCategoryToggleAll(category: PermissionCategory, selectAll: boolean): void {
    category.permissions.forEach(group => {
      group.permissionsList.forEach(perm => {
        const control = this.permissionForm.get(this.sanitizeControlName(perm.displayValue));
        if (control) {
          control.setValue(selectAll);
        }
      });
    });
  }

  isCategoryFullySelected(category: PermissionCategory): boolean {
    return category.permissions.every(group =>
      group.permissionsList.every(perm =>
        this.permissionForm.get(this.sanitizeControlName(perm.displayValue))?.value === true
      )
    );
  }

  getCategorySelectedCount(category: PermissionCategory): { selected: number; total: number } {
    let selected = 0;
    let total = 0;

    category.permissions.forEach(group => {
      group.permissionsList.forEach(perm => {
        total++;
        if (this.permissionForm.get(this.sanitizeControlName(perm.displayValue))?.value === true) {
          selected++;
        }
      });
    });

    return { selected, total };
  }

  // ============================================================================
  // SAVE PERMISSIONS
  // ============================================================================
  onSavePermissions(): void {
    if (!this.selectedRole) return;

    this.isSaving = true;
    const selectedPermissions: string[] = [];

    // Collect CRUD permissions
    this.permissions.forEach(permissionGroup => {
      permissionGroup.permissionsList.forEach(perm => {
        const controlName = this.sanitizeControlName(perm.displayValue);
        const controlValue = this.permissionForm.get(controlName)?.value;
        if (controlValue === true) {
          const permissionString = `${permissionGroup.entityName}.${perm.displayValue}`;
          selectedPermissions.push(permissionString);
        }
      });
    });

    // Collect Plain permissions
    this.plainPermissions.forEach(permissionGroup => {
      permissionGroup.permissionsList.forEach(perm => {
        const controlName = this.sanitizeControlName(perm.displayValue);
        const controlValue = this.permissionForm.get(controlName)?.value;
        if (controlValue === true) {
          const permissionString = `${permissionGroup.entityName}.${perm.displayValue}`;
          selectedPermissions.push(permissionString);
        }
      });
    });

    // Strip first segment (e.g., "Dashboard.Users.View" → "Users.View")
    const finalPermissions = selectedPermissions.map(p => {
      const parts = p.split('.');
      if (parts.length > 1) {
        parts.shift();
        return parts.join('.');
      }
      return p;
    });

    // Save to backend
    this.backendUserService.assignPermissionsToRole(this.selectedRole.id, finalPermissions)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ message }) => {
          this.isSaving = false;
          this.toastService.success(message ?? this.translateService.instant('rolePermissions.permissionsSaved'));
        },
        error: () => {
          this.isSaving = false;
          this.toastService.error(this.translateService.instant('rolePermissions.errorSaving'));
        }
      });
  }


  isFirstPermissionOfType(group: CrudPermission, permType: string, currentPerm: any): boolean {
    const permissionsOfType = group.permissionsList.filter(p => 
      this.getPermissionInfo(p.displayValue).label === permType
    );
    return permissionsOfType.length > 0 && permissionsOfType[0] === currentPerm;
  }

  /**
   * Check if all permissions in a row are selected
   */
  isRowFullySelected(group: CrudPermission): boolean {
    if (!group.permissionsList || group.permissionsList.length === 0) {
      return false;
    }
    return group.permissionsList.every(perm => {
      const control = this.permissionForm.get(this.sanitizeControlName(perm.displayValue));
      return control?.value === true;
    });
  }

  /**
   * Toggle all permissions for a specific row (entity group)
   */
  onRowToggle(group: CrudPermission, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const selectAll = checkbox.checked;
    
    group.permissionsList.forEach(perm => {
      const control = this.permissionForm.get(this.sanitizeControlName(perm.displayValue));
      if (control) {
        control.setValue(selectAll);
      }
    });
  }

  /**
   * Check if all permissions of a specific type (column) are selected in a category
   */
  isColumnFullySelected(category: PermissionCategory, permType: string): boolean {
    let hasAnyPermission = false;
    
    for (const group of category.permissions) {
      for (const perm of group.permissionsList) {
        const label = this.getPermissionInfo(perm.displayValue).label;
        if (label === permType) {
          hasAnyPermission = true;
          const control = this.permissionForm.get(this.sanitizeControlName(perm.displayValue));
          if (!control || control.value !== true) {
            return false;
          }
        }
      }
    }
    
    return hasAnyPermission;
  }

  /**
   * Toggle all permissions of a specific type (column) in a category
   */
  onColumnToggle(category: PermissionCategory, permType: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const selectAll = checkbox.checked;
    
    category.permissions.forEach(group => {
      group.permissionsList.forEach(perm => {
        const label = this.getPermissionInfo(perm.displayValue).label;
        if (label === permType) {
          const control = this.permissionForm.get(this.sanitizeControlName(perm.displayValue));
          if (control) {
            control.setValue(selectAll);
          }
        }
      });
    });
  }
}
