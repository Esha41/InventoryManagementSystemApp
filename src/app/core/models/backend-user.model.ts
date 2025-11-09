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
  departmentId?: number;
  departmentName?: string;
  // Optional profile fields if backend provides them
  nameEn?: string;
  nameAr?: string;
  rankId?: number;
  militaryId?: string; // Frontend field name
  militoryId?: string; // Backend API field name (typo in API)
  roleIds: string[];
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
  roleIds: string[];
  /** Optional selected department identifier */
  departmentId?: number;
  // Optional profile fields - matching API field names
  fullNameEN?: string;
  fullNameAR?: string;
  rankId?: number;
  militoryId?: string; // Note: API uses "militoryId" (typo) not "militaryId"
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
  roleIds: string[];
  /** Optional selected department identifier */
  departmentId?: number;
  // Optional profile fields - matching API field names
  fullNameEN?: string;
  fullNameAR?: string;
  rankId?: number;
  militoryId?: string; // Note: API uses "militoryId" (typo) not "militaryId"
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
  applicationEntityIds?: number[]; // Optional: Array of application entity IDs associated with the role
}

export interface RoleApplicationEntityLinkDto {
  roleId: string;
  applicationEntityId: number;
}

/**
 * Create Role DTO matching backend CreateRoleDto
 */
export interface CreateRoleDto {
  name: string;
  isDefaultRole?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
  applicationEntityIds?: number[]; // Optional: Array of application entity IDs to associate with the role (must be numbers)
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
  applicationEntityIds?: number[]; // Optional: Array of application entity IDs to associate with the role (must be numbers)
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

