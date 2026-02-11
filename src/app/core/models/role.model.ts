/**
 * Role and Permission Models
 */

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  userCount: number;
  isDefault: boolean;
  isActive: boolean;
  roleType: RoleType;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Permission {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: PermissionCategory;
  isSelected: boolean;
  module: string;
  action: PermissionAction;
}

export interface PermissionGroup {
  category: PermissionCategory;
  displayName: string;
  description: string;
  permissions: Permission[];
  isExpanded?: boolean;
}

export enum RoleType {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  MODERATOR = 'moderator',
  USER = 'user',
  VIEWER = 'viewer'
}

export enum PermissionCategory {
  DASHBOARD = 'dashboard',
  USERS = 'users',
  ROLES = 'roles',
  ASSETS = 'assets',
  INVENTORY = 'inventory',
  REQUESTS = 'requests',
  FORECAST = 'forecast',
  REPORTS = 'reports',
  SETTINGS = 'settings'
}

export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  EXPORT = 'export',
  IMPORT = 'import',
  APPROVE = 'approve',
  REJECT = 'reject'
}

export interface CreateRoleDTO {
  name: string;
  description: string;
  roleType: RoleType;
  permissions: string[];
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateRoleDTO extends Partial<CreateRoleDTO> {
  id: string;
}

