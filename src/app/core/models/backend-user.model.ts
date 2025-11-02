/**
 * Backend User Models
 * Aligned with C# DTOs from EttadBackend
 */

/**
 * User DTO matching backend UserDto
 */
export interface BackendUserDto {
  id: string;
  userName: string;
  email: string;
  isLdapUser: boolean;
  extraEmployeesView?: string;
  employeeId?: number;
  organizationId?: number;
}

/**
 * Create User DTO matching backend CreateUserDto
 */
export interface CreateUserDto {
  userName: string;
  password: string;
  isLdapUser: boolean;
  extraEmployeesView?: string;
  employeeId?: number;
  organizationId?: number;
  roleIds?: string[]; // Optional: Array of role IDs to assign to the user
}

/**
 * Update User DTO matching backend UpdateUserDto
 */
export interface UpdateUserDto {
  id: string;
  userName?: string;
  password?: string;
  isLdapUser?: boolean;
  extraEmployeesView?: string;
  employeeId?: number;
  organizationId?: number;
}

/**
 * User roles assignment DTO
 */
export interface UpdateUserRolesDto {
  userId: string;
  roleIds: string[];
}

/**
 * User with roles response
 */
export interface UserRolesDto {
  userId: string;
  userName: string;
  roles: RoleDto[];
}

/**
 * Role DTO matching backend RoleDto
 */
export interface RoleDto {
  id: string;
  name: string;
  isDefaultRole: boolean;
  isSuperAdmin: boolean;
}

/**
 * Create Role DTO matching backend CreateRoleDto
 */
export interface CreateRoleDto {
  name: string;
  isDefaultRole?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
}

/**
 * Update Role DTO matching backend UpdateRoleDto
 */
export interface UpdateRoleDto {
  id: string;
  name?: string;
  isDefaultRole?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
}

/**
 * Permission DTO
 */
export interface PermissionDto {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  module?: string;
  category?: string;
}

/**
 * Assign permissions to role DTO
 */
export interface AssignPermissionsDto {
  entityId: string;
  permissionsList: string[];
}

/**
 * CRUD Permission structure
 */
export interface CrudPermission {
  isForReportDesinger: boolean;
  category: string;
  entityName: string;
  permissionsList: CheckBox[];
}

export interface CheckBox {
  displayValue: string;
  isSelected?: boolean;
}

/**
 * User in role DTO
 */
export interface UserInRoleDto {
  id: string;
  userName: string;
}

