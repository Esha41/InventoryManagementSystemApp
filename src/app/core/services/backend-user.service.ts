import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ApplicationEntityDto,
  CreateRoleDto,
  CreateUserDto,
  CrudPermission,
  PermissionDto,
  RoleDto,
  UpdateRoleDto,
  UpdateUserDto,
  UserInRoleDto,
  BackendUserDto
} from '@models/backend-user.model';
import {
  PagedRequest,
  PagedResponse,
  PaginatedList
} from '@models/api-response.model';

import {
  ApplicationEntitiesApiService,
  PermissionsApiService,
  RoleMembersApiService,
  RolesApiService,
  UserRolesApiService,
  UsersApiService
} from './user-management';

// Re-export so existing imports of `UserSummaryDto` from this module keep working.
export type { UserSummaryDto } from './user-management/users-api.service';

/**
 * Backward-compatible facade over split user-management services.
 *
 * @deprecated Inject the focused services from `./user-management` instead.
 *             Scheduled for removal: Q2 2026 — see file header BACKEND_USER_SERVICE_MIGRATION.
 */
@Injectable({
  providedIn: 'root'
})
export class BackendUserService {
  private readonly users = inject(UsersApiService);
  private readonly userRoles = inject(UserRolesApiService);
  private readonly roles = inject(RolesApiService);
  private readonly roleMembers = inject(RoleMembersApiService);
  private readonly permissions = inject(PermissionsApiService);
  private readonly applicationEntities = inject(ApplicationEntitiesApiService);

  readonly users$ = this.users.users$;
  readonly roles$ = this.roles.roles$;

  getUsers(request?: PagedRequest): Observable<PaginatedList<BackendUserDto>> {
    return this.users.getUsers(request);
  }

  getUsersSummary() {
    return this.users.getUsersSummary();
  }

  getUserById(id: string): Observable<BackendUserDto> {
    return this.users.getUserById(id);
  }

  createUser(user: CreateUserDto): Observable<BackendUserDto> {
    return this.users.createUser(user);
  }

  updateUser(id: string, user: UpdateUserDto): Observable<BackendUserDto> {
    return this.users.updateUser(id, user);
  }

  toggleUserStatus(id: string): Observable<boolean> {
    return this.users.toggleUserStatus(id);
  }

  deleteUser(id: string): Observable<boolean> {
    return this.users.deleteUser(id);
  }

  restoreUser(id: string): Observable<boolean> {
    return this.users.restoreUser(id);
  }

  permanentDeleteUser(id: string): Observable<boolean> {
    return this.users.permanentDeleteUser(id);
  }

  // ==================== USER <-> ROLE ASSIGNMENTS ====================

  getUserRoles(userId: string): Observable<RoleDto[]> {
    return this.userRoles.getUserRoles(userId);
  }

  updateUserRoles(userId: string, roleIds: string[]): Observable<boolean> {
    return this.userRoles.updateUserRoles(userId, roleIds);
  }

  getRolesWithPagination(request: PagedRequest): Observable<PagedResponse<RoleDto>> {
    return this.roles.getRolesWithPagination(request);
  }

  getRoles(): Observable<RoleDto[]> {
    return this.roles.getRoles();
  }

  getAllRolesSimple(): Observable<RoleDto[]> {
    return this.roles.getAllRolesSimple();
  }

  getApplicationEntitiesByRole(roleId: string): Observable<number[]> {
    return this.roles.getApplicationEntitiesByRole(roleId);
  }

  getRoleById(id: string): Observable<RoleDto> {
    return this.roles.getRoleById(id);
  }

  createRole(role: CreateRoleDto): Observable<RoleDto> {
    return this.roles.createRole(role);
  }

  updateRole(id: string, role: UpdateRoleDto): Observable<RoleDto> {
    return this.roles.updateRole(id, role);
  }

  deleteRole(id: string): Observable<boolean> {
    return this.roles.deleteRole(id);
  }

  getRolePermissions(roleId: string): Observable<PermissionDto[]> {
    return this.permissions.getRolePermissions(roleId);
  }

  getPlainPermissionsForRole(roleId: string): Observable<CrudPermission[]> {
    return this.permissions.getPlainPermissionsForRole(roleId);
  }

  getCrudPermissionsForRole(roleId: string): Observable<CrudPermission[]> {
    return this.permissions.getCrudPermissionsForRole(roleId);
  }

  assignPermissionsToRole(
    roleId: string,
    permissionList: string[]
  ): Observable<{ data: boolean; message: string }> {
    return this.permissions.assignPermissionsToRole(roleId, permissionList);
  }

  getApplicationEntities(): Observable<ApplicationEntityDto[]> {
    return this.applicationEntities.getApplicationEntities();
  }

  getUsersInRole(roleId: string): Observable<UserInRoleDto[]> {
    return this.roleMembers.getUsersInRole(roleId);
  }

  removeUsersFromRole(roleId: string, userIds: string[]): Observable<boolean> {
    return this.roleMembers.removeUsersFromRole(roleId, userIds);
  }
}
