import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import {
  BackendUserDto,
  CreateUserDto,
  UpdateUserDto,
  UpdateUserRolesDto,
  UserRolesDto,
  RoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  PermissionDto,
  AssignPermissionsDto,
  CrudPermission,
  UserInRoleDto
} from '@models/backend-user.model';
import { RoleApplicationEntityLinkDto } from '@models/backend-user.model';
import { ApiResponse, PagedResponse, PagedRequest, PaginatedList } from '@models/api-response.model';

export interface UserSummaryDto {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
}

/**
 * Backend User Service
 * Handles all user and role management operations with the backend
 */
@Injectable({
  providedIn: 'root'
})
export class BackendUserService {
  private usersSubject = new BehaviorSubject<BackendUserDto[]>([]);
  public users$ = this.usersSubject.asObservable();

  private rolesSubject = new BehaviorSubject<RoleDto[]>([]);
  public roles$ = this.rolesSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private configService: ConfigService
  ) { }

  // ==================== USER MANAGEMENT ====================

  /**
   * Get all users
   */
  getUsers(request?: PagedRequest): Observable<PaginatedList<BackendUserDto>> {
    this.configService.log('Fetching users', request);

    // Construct query parameters
    let params = new HttpParams()
      .set('Page', (request?.page || 1).toString())
      .set('PageSize', (request?.pageSize || 10).toString());

    if (request?.filter?.field) {
      params = params.set('Filter.Field', request.filter.field);
    }
    if (request?.filter?.operator) {
      params = params.set('Filter.Operator', request.filter.operator);
    }
    if (request?.filter?.value) {
      params = params.set('Filter.Value', request.filter.value);
    }

    return this.apiService.get<PaginatedList<BackendUserDto>>(
      API_ENDPOINTS.USERS.BASE,
      params
    ).pipe(
      map(response => {
        // Handle paginated response structure
        const items = response.items || [];

        // Normalize user data (similar to previous implementation but for paginated items)
        const normalizedItems = items.map(rawUser => {
          const user = { ...rawUser } as BackendUserDto;

          // Normalize militoryId
          if ((rawUser as any).militoryId && !user.militaryId) {
            user.militaryId = (rawUser as any).militoryId;
          }

          // Normalize roles
          const rawRoles = Array.isArray((rawUser as any).roles) ? (rawUser as any).roles : [];
          if (rawRoles.length > 0) {
            const mappedRoles: RoleDto[] = rawRoles.map((role: any) => ({
              id: String(role.id ?? role.roleId ?? ''),
              name: role.name ?? role.roleName ?? '',
              isDefaultRole: !!(role.isDefaultRole ?? role.isDefault),
              isSuperAdmin: !!(role.isSuperAdmin ?? role.superAdmin),
              isAdmin: !!(role.isAdmin ?? role.admin),
              applicationEntityIds: Array.isArray(role.applicationEntityIds) ? role.applicationEntityIds : undefined
            }));
            user.roles = mappedRoles;
            // Extract role IDs
            const roleIdsFromRoles = mappedRoles
              .map(role => role.id)
              .filter((id): id is string => !!id);
            user.roleIds = roleIdsFromRoles.length > 0 ? roleIdsFromRoles : (Array.isArray(user.roleIds) ? user.roleIds : []);
          } else {
            user.roles = [];
            user.roleIds = Array.isArray(user.roleIds) ? user.roleIds : [];
          }

          // Normalize department
          const department = (rawUser as any).department;
          if (department) {
            user.departmentId = department.id ?? user.departmentId;
            user.departmentName = department.nameEn ?? department.nameAr ?? user.departmentName;
          }

          // Normalize rank
          const rank = (rawUser as any).rank;
          if (rank) {
            user.rankId = rank.id ?? user.rankId;
            user.rankNameEn = rank.nameEn ?? rank.name ?? user.rankNameEn;
            user.rankNameAr = rank.nameAr ?? user.rankNameAr;
          }

          // Normalize full names
          if (!user.nameEn) {
            user.nameEn = (rawUser as any).fullNameEN ?? user.nameEn;
          }
          if (!user.nameAr) {
            user.nameAr = (rawUser as any).fullNameAR ?? user.nameAr;
          }

          return user;
        });

        return {
          ...response,
          items: normalizedItems
        };
      }),
      tap(paginatedList => {
        // Update local state with the items from the current page
        this.usersSubject.next(paginatedList.items);
        this.configService.log(`Fetched ${paginatedList.items.length} users (Page ${paginatedList.pageIndex})`);
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch users', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch users'
        ));
      })
    );
  }

  /**
   * Get users summary (total, active, inactive)
   */
  getUsersSummary(): Observable<UserSummaryDto> {
    return this.apiService.get<UserSummaryDto>(API_ENDPOINTS.USERS.BASE + '/Summary').pipe(
      map(data => data || { totalUsers: 0, activeUsers: 0, inactiveUsers: 0 }),
      catchError(error => {
        this.configService.logError('Failed to fetch users summary', error);
        return throwError(() => new Error('Failed to fetch users summary'));
      })
    );
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): Observable<BackendUserDto> {
    this.configService.log('Fetching user', { id });

    return this.apiService.get<BackendUserDto>(
      API_ENDPOINTS.USERS.BY_ID(id)
    ).pipe(
      map(userData => {
        if (!userData) {
          throw new Error('Failed to fetch user');
        }
        // Normalize militoryId to militaryId for consistency
        if ((userData as any).militoryId && !userData.militaryId) {
          userData.militaryId = (userData as any).militoryId;
        }
        return userData;
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch user', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch user'
        ));
      })
    );
  }

  /**
   * Create new user
   */
  createUser(user: CreateUserDto): Observable<BackendUserDto> {
    this.configService.log('Creating user', { userName: user.userName });

    return this.apiService.post<BackendUserDto>(
      API_ENDPOINTS.USERS.BASE,
      user
    ).pipe(
      map(newUser => {
        if (!newUser) {
          throw new Error('Failed to create user');
        }
        return newUser;
      }),
      tap(newUser => {
        // Update local users list
        const currentUsers = this.usersSubject.value;
        this.usersSubject.next([...currentUsers, newUser]);
        this.configService.log('User created successfully', { id: newUser.id });
      }),
      catchError(error => {
        this.configService.logError('Failed to create user', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to create user'
        ));
      })
    );
  }

  /**
   * Update existing user
   */
  updateUser(id: string, user: UpdateUserDto): Observable<BackendUserDto> {
    this.configService.log('Updating user', { id });
    console.log("User update DTO:", JSON.stringify(user, null, 2));

    return this.apiService.put<BackendUserDto>(
      API_ENDPOINTS.USERS.BY_ID(id),
      { ...user, id }
    ).pipe(
      map(userData => {
        if (!userData) {
          throw new Error('Failed to update user');
        }
        // Normalize militoryId to militaryId for consistency
        if ((userData as any).militoryId && !userData.militaryId) {
          userData.militaryId = (userData as any).militoryId;
        }
        return userData;
      }),
      tap(updatedUser => {
        // Update local users list
        const currentUsers = this.usersSubject.value;
        const index = currentUsers.findIndex(u => u.id === id);
        if (index !== -1) {
          currentUsers[index] = updatedUser;
          this.usersSubject.next([...currentUsers]);
        }
        this.configService.log('User updated successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to update user', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to update user'
        ));
      })
    );
  }

  /**
   * Toggle user active status
   */
  toggleUserStatus(id: string): Observable<boolean> {
    this.configService.log('Toggling user status', { id });

    return this.apiService.put<boolean>(
      API_ENDPOINTS.USERS.TOGGLE_STATUS(id),
      {}
    ).pipe(
      map(succeeded => {
        if (!succeeded) {
          throw new Error('Failed to toggle user status');
        }
        return true;
      }),
      tap(() => {
        // Update local status
        const currentUsers = this.usersSubject.value;
        const index = currentUsers.findIndex(u => u.id === id);
        if (index !== -1) {
          currentUsers[index].isActive = !currentUsers[index].isActive;
          this.usersSubject.next([...currentUsers]);
        }
        this.configService.log('User status toggled successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to toggle user status', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to toggle user status'
        ));
      })
    );
  }

  /**
   * Delete user
   */
  deleteUser(id: string): Observable<boolean> {
    this.configService.log('Deleting user', { id });

    return this.apiService.delete<any>(
      API_ENDPOINTS.USERS.BY_ID(id)
    ).pipe(
      map(() => {
        return true;
      }),
      tap(() => {
        // Remove from local users list
        const currentUsers = this.usersSubject.value;
        this.usersSubject.next(currentUsers.filter(u => u.id !== id));
        this.configService.log('User deleted successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to delete user', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to delete user'
        ));
      })
    );
  }

  /**
   * Get user roles
   */
  getUserRoles(userId: string): Observable<RoleDto[]> {
    this.configService.log('Fetching user roles', { userId });

    return this.apiService.get<RoleDto[]>(
      API_ENDPOINTS.USERS.ROLES(userId)
    ).pipe(
      map(roles => {
        console.log("response", roles);
        return roles || [];
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch user roles', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch user roles'
        ));
      })
    );
  }

  /**
   * Update user roles
   */
  updateUserRoles(userId: string, roleIds: string[]): Observable<boolean> {
    console.log("updateUserRoles", roleIds)
    this.configService.log('Updating user roles', { userId, roleIds });

    const dto: UpdateUserRolesDto = { userId, roleIds };

    return this.apiService.put<any>(
      API_ENDPOINTS.USERS.UPDATE_ROLES(userId),
      dto
    ).pipe(
      map(response => {
        // Handle case where put returns boolean succeeded directly
        if (typeof response === 'boolean' && !response) {
          throw new Error('Failed to update user roles');
        }
        return true;
      }),
      tap(() => {
        this.configService.log('User roles updated successfully', { userId });
      }),
      catchError(error => {
        this.configService.logError('Failed to update user roles', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to update user roles'
        ));
      })
    );
  }

  // ==================== ROLE MANAGEMENT ====================

  /**
   * Get all roles with pagination
   */
  getRolesWithPagination(request: PagedRequest): Observable<PagedResponse<RoleDto>> {
    this.configService.log('Fetching roles with pagination', request);

    return this.apiService.post<PagedResponse<RoleDto>>(
      API_ENDPOINTS.ROLES.BASE + '/GetRolesWithPagination',
      request
    ).pipe(
      tap(response => {
        if (response && response.succeeded && Array.isArray(response.data)) {
          this.rolesSubject.next(response.data);
          this.configService.log(`Fetched ${response.data.length} roles`);
        }
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch roles', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch roles'
        ));
      })
    );
  }

  /**
   * Get all roles using paginated endpoint
   */
  getRoles(): Observable<RoleDto[]> {
    this.configService.log('Fetching all roles');

    const paginationRequest = {
      page: 1,
      pageSize: 1000
    };

    return this.apiService.post<PaginatedList<RoleDto>>(
      API_ENDPOINTS.ROLES.PAGINATED,
      paginationRequest
    ).pipe(
      map(data => {
        if (!data) {
          throw new Error('Failed to fetch roles');
        }
        return data.items || [];
      }),
      tap(roles => {
        this.rolesSubject.next(roles);
        this.configService.log(`Fetched ${roles.length} roles`);
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch roles', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch roles'
        ));
      })
    );
  }

  /**
   * Get all roles using simple GET /Roles (no pagination)
   */
  getAllRolesSimple(): Observable<RoleDto[]> {
    this.configService.log('Fetching all roles (simple)');
    return this.apiService.get<RoleDto[]>(
      API_ENDPOINTS.ROLES.BASE
    ).pipe(
      map(roles => {
        return roles || [];
      })
    );
  }

  /**
   * Get application entities linked to a role
   */
  getApplicationEntitiesByRole(roleId: string): Observable<number[]> {
    this.configService.log('Fetching application entities for role', { roleId });
    // Backend expects roleId in path: /Roles/getApplicationentities/{roleId}
    return this.apiService.get<RoleApplicationEntityLinkDto[]>(
      API_ENDPOINTS.ROLES.APPLICATION_ENTITIES_BY_ROLE(roleId)
    ).pipe(
      map(data => {
        if (Array.isArray(data)) {
          return data.map(x => x.applicationEntityId);
        }
        return [] as number[];
      })
    );
  }

  /**
   * Get role by ID
   */
  getRoleById(id: string): Observable<RoleDto> {
    this.configService.log('Fetching role', { id });

    return this.apiService.get<RoleDto>(
      API_ENDPOINTS.ROLES.BY_ID(id)
    ).pipe(
      map(role => {
        if (!role) {
          throw new Error('Failed to fetch role');
        }
        return role;
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch role', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch role'
        ));
      })
    );
  }

  /**
   * Create new role
   */
  createRole(role: CreateRoleDto): Observable<RoleDto> {
    this.configService.log('Creating role', { name: role.name });
    console.log('BackendUserService - Creating role with payload:', JSON.stringify(role, null, 2));

    return this.apiService.post<RoleDto>(
      API_ENDPOINTS.ROLES.BASE,
      role
    ).pipe(
      map(newRole => {
        if (!newRole) {
          throw new Error('Failed to create role');
        }
        return newRole;
      }),
      tap(newRole => {
        // Update local roles list
        const currentRoles = this.rolesSubject.value;
        this.rolesSubject.next([...currentRoles, newRole]);
        this.configService.log('Role created successfully', { id: newRole.id });
      }),
      catchError(error => {
        this.configService.logError('Failed to create role', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to create role'
        ));
      })
    );
  }

  /**
   * Update existing role
   */
  updateRole(id: string, role: UpdateRoleDto): Observable<RoleDto> {
    this.configService.log('Updating role', { id });

    return this.apiService.put<RoleDto>(
      API_ENDPOINTS.ROLES.BY_ID(id),
      { ...role, id }
    ).pipe(
      map(updatedRole => {
        if (!updatedRole) {
          throw new Error('Failed to update role');
        }
        return updatedRole;
      }),
      tap(updatedRole => {
        // Update local roles list
        const currentRoles = this.rolesSubject.value;
        const index = currentRoles.findIndex(r => r.id === id);
        if (index !== -1) {
          currentRoles[index] = updatedRole;
          this.rolesSubject.next([...currentRoles]);
        }
        this.configService.log('Role updated successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to update role', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to update role'
        ));
      })
    );
  }

  /**
   * Delete role
   */
  deleteRole(id: string): Observable<boolean> {
    this.configService.log('Deleting role', { id });

    return this.apiService.delete<any>(
      API_ENDPOINTS.ROLES.BY_ID(id)
    ).pipe(
      map(() => {
        return true;
      }),
      tap(() => {
        // Remove from local roles list
        const currentRoles = this.rolesSubject.value;
        this.rolesSubject.next(currentRoles.filter(r => r.id !== id));
        this.configService.log('Role deleted successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to delete role', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to delete role'
        ));
      })
    );
  }

  /**
   * Get role permissions
   */
  getRolePermissions(roleId: string): Observable<PermissionDto[]> {
    this.configService.log('Fetching role permissions', { roleId });

    return this.apiService.get<PermissionDto[]>(
      API_ENDPOINTS.ROLES.PERMISSIONS(roleId)
    ).pipe(
      map(permissions => {
        return permissions || [];
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch role permissions', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch role permissions'
        ));
      })
    );
  }


  // ========================================
  // PERMISSION MANAGEMENT
  // ========================================

  /**
   * Get plain permissions for a role
   */
  getPlainPermissionsForRole(roleId: string): Observable<CrudPermission[]> {
    this.configService.log('Fetching plain permissions for role', { roleId });

    return this.apiService.get<CrudPermission[]>(
      API_ENDPOINTS.ROLES.PERMISSIONS(roleId)
    ).pipe(
      map(permissions => {
        return permissions || [];
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch plain permissions', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch permissions'
        ));
      })
    );
  }

  /**
   * Get CRUD permissions for a role
   */
  getCrudPermissionsForRole(roleId: string): Observable<CrudPermission[]> {
    this.configService.log('Fetching CRUD permissions for role', { roleId });

    return this.apiService.get<CrudPermission[]>(
      API_ENDPOINTS.ROLES.CRUD_PERMISSIONS(roleId)
    ).pipe(
      map(permissions => {
        return permissions || [];
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch CRUD permissions', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch CRUD permissions'
        ));
      })
    );
  }

  /**
   * Assign permissions to a role
   */
  assignPermissionsToRole(roleId: string, permissions: string[]): Observable<{ data: boolean; message: string }> {
    this.configService.log('Assigning permissions to role', { roleId, permissions });

    const assignPermissionsDto: AssignPermissionsDto = {
      entityId: roleId,
      permissionsList: permissions
    };

    return this.apiService.postRaw<boolean>(
      API_ENDPOINTS.ROLES.ASSIGN_PERMISSIONS,
      assignPermissionsDto
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to assign permissions');
        }
        return {
          data: response.data ?? false,
          message: response.message || 'Permissions assigned successfully.'
        };
      }),
      tap(() => {
        this.configService.log('Permissions assigned successfully');
      }),
      catchError(error => {
        this.configService.logError('Failed to assign permissions', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to assign permissions'
        ));
      })
    );
  }

  // ==================== APPLICATION ENTITIES ====================

  /**
   * Get all application entities
   */
  getApplicationEntities(): Observable<any[]> {
    this.configService.log('Fetching application entities');
    const endpoint = API_ENDPOINTS.APPLICATION_ENTITIES.BASE;
    console.log('API Call: GET', endpoint);
    console.log('Full URL will be:', `${this.configService.apiUrl}${endpoint}`);

    return this.apiService.get<any[]>(
      endpoint
    ).pipe(
      map((response: any) => {
        console.log('API Response:', response);

        // Handle different response formats
        if (Array.isArray(response)) {
          return response;
        }

        // If it's a wrapped response but was auto-unwrapped, response is the data
        if (response && typeof response === 'object') {
          return response;
        }

        return [];
      }),
      tap(entities => {
        console.log(`Successfully parsed ${entities.length} application entities:`, entities);
        this.configService.log(`Fetched ${entities.length} application entities`);
      }),
      catchError(error => {
        console.error('API Error fetching application entities:', error);
        console.error('Error details:', {
          status: error?.status,
          statusText: error?.statusText,
          message: error?.message,
          error: error?.error,
          url: error?.url
        });
        this.configService.logError('Failed to fetch application entities', error);

        // Provide more helpful error message
        const errorMessage = error?.status === 404
          ? 'Application entities endpoint not found. Please check the API endpoint.'
          : error?.message || error?.error?.message || 'Failed to fetch application entities';

        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Get users in a role
   */
  getUsersInRole(roleId: string): Observable<UserInRoleDto[]> {
    this.configService.log('Fetching users in role', { roleId });

    return this.apiService.get<UserInRoleDto[]>(
      API_ENDPOINTS.ROLES.USERS_IN_ROLE(roleId)
    ).pipe(
      map(data => {
        return data || [];
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch users in role', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to fetch users in role'
        ));
      })
    );
  }

  /**
   * Remove users from a role
   */
  removeUsersFromRole(roleId: string, userIds: string[]): Observable<boolean> {
    this.configService.log('Removing users from role', { roleId, userIds });

    return this.apiService.post<boolean>(
      API_ENDPOINTS.ROLES.USERS_IN_ROLE(roleId),
      { userIds }
    ).pipe(
      map(succeeded => {
        return !!succeeded;
      }),
      tap(() => {
        this.configService.log('Users removed from role successfully');
      }),
      catchError(error => {
        this.configService.logError('Failed to remove users from role', error);
        return throwError(() => new Error(
          error.userMessage || 'Failed to remove users from role'
        ));
      })
    );
  }
}

