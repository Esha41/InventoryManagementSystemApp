/**
 * Backend User Models
 * Aligned with C# DTOs from EttadBackend
 */

/**
 * Raw API response shape - backend may return different field names (e.g. militoryId, fullNameEN)
 * Used for normalizing API responses to BackendUserDto
 */
export interface RawUserApiResponse {
  id?: string;
  userName?: string;
  email?: string;
  militoryId?: string;
  fullNameEN?: string;
  fullNameAR?: string;
  defaultRoleId?: string | null;
  DefaultRoleId?: string | null;
  roles?: RawRoleApiResponse[];
  roleIds?: string[];
  departmentId?: number;
  departmentName?: string;
  department?: { id?: number; nameEn?: string; nameAr?: string };
  rankId?: number;
  rankNameEn?: string;
  rankNameAr?: string;
  rank?: { id?: number; nameEn?: string; nameAr?: string; name?: string };
}

/** Raw role object from API - may use roleId/roleName instead of id/name */
export interface RawRoleApiResponse {
  id?: string;
  roleId?: string;
  name?: string;
  roleName?: string;
  nameEn?: string;
  nameAr?: string;
  isDefaultRole?: boolean;
  isDefault?: boolean;
  isSuperAdmin?: boolean;
  superAdmin?: boolean;
  isAdmin?: boolean;
  admin?: boolean;
  applicationEntityIds?: number[];
  isSelected?: boolean;
  departmentId?: number | null;
}

/**
 * User DTO matching backend UserDto
 */
export interface BackendUserDto {
  id: string;
  userName: string;
  email: string;
  isActive: boolean;
  isLdapUser: boolean;
  ldapUserName?: string;
  extraEmployeesView?: string;
  organizationId?: number;
  departmentId?: number;
  departmentName?: string;
  departmentNameEn?: string;
  departmentNameAr?: string;
  // Optional profile fields if backend provides them
  nameEn?: string;
  nameAr?: string;
  /** Depot user API may return fullNameEN/fullNameAR (PascalCase) */
  fullNameEN?: string;
  fullNameAR?: string;
  rankId?: number;
  rankNameEn?: string;
  rankNameAr?: string;
  militaryId?: string; // Frontend field name
  militoryId?: string; // Backend API field name (typo in API)
  roles?: RoleDto[];
  roleIds: string[];
  /** Active session role id when provided by API. */
  defaultRoleId?: string | null;
}

/**
 * Create User DTO matching backend CreateUserDto
 */
export interface CreateUserDto {
  userName: string;
  email?: string;
  password: string;
  isActive: boolean;
  isLdapUser: boolean;
  ldapUserName?: string;
  extraEmployeesView?: string;
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
  email?: string;
  password?: string;
  isActive?: boolean;
  isLdapUser?: boolean;
  ldapUserName?: string;
  extraEmployeesView?: string;
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
  nameEn?: string;
  nameAr?: string;
  isDefaultRole: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  applicationEntityIds?: number[];
  isSelected?: boolean;
  departmentId?: number | null;
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
  nameEn?: string;
  nameAr?: string;
  isDefaultRole?: boolean;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
  permissions?: string[];
  applicationEntityIds?: number[]; // Optional: Array of application entity IDs to associate with the role (must be numbers)
}

/**
 * Update Role DTO matching backend UpdateRoleDto
 */
export interface UpdateRoleDto {
  id: string;
  name?: string;
  nameEn?: string;
  nameAr?: string;
  isDefaultRole?: boolean;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
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
 * Application entity (department, etc.) - used in workflow steps and role assignment
 */
export interface ApplicationEntityDto {
  id: number;
  applicationEntityId?: number;
  code?: string;
  nameAr?: string;
  nameEn?: string;
  isDeleted?: boolean;
  creationDate?: string;
  modificationDate?: string | null;
  modifiedBy?: string | null;
  createdBy?: string | null;
}

/**
 * User in role DTO
 */
export interface UserInRoleDto {
  id: string;
  userName: string;
}

