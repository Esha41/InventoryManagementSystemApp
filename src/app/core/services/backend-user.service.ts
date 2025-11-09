import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
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
  ) {}

  // ==================== USER MANAGEMENT ====================

  /**
   * Get all users
   */
  getUsers(): Observable<BackendUserDto[]> {
    this.configService.log('Fetching all users');

    return this.apiService.getWithAuth<ApiResponse<BackendUserDto[]>>(
      API_ENDPOINTS.USERS.BASE
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch users');
        }
        // Normalize militoryId to militaryId for all users
        const users = response.data || [];
        return users.map(user => {
          if ((user as any).militoryId && !user.militaryId) {
            user.militaryId = (user as any).militoryId;
          }
          return user;
        });
      }),
      tap(users => {
        this.usersSubject.next(users);
        this.configService.log(`Fetched ${users.length} users`);
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
   * Get user by ID
   */
  getUserById(id: string): Observable<BackendUserDto> {
    this.configService.log('Fetching user', { id });

    return this.apiService.getWithAuth<ApiResponse<BackendUserDto>>(
      API_ENDPOINTS.USERS.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to fetch user');
        }
        // Normalize militoryId to militaryId for consistency
        const userData = response.data;
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

    return this.apiService.postWithAuth<ApiResponse<BackendUserDto>>(
      API_ENDPOINTS.USERS.BASE,
      user
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to create user');
        }
        return response.data;
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
    
    return this.apiService.putWithAuth<ApiResponse<BackendUserDto>>(
      API_ENDPOINTS.USERS.BY_ID(id),
      { ...user, id }
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to update user');
        }
        // Normalize militoryId to militaryId for consistency
        const userData = response.data;
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
   * Delete user
   */
  deleteUser(id: string): Observable<boolean> {
    this.configService.log('Deleting user', { id });

    return this.apiService.deleteWithAuth<ApiResponse<any>>(
      API_ENDPOINTS.USERS.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to delete user');
        }
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

    return this.apiService.getWithAuth<ApiResponse<RoleDto[]>>(
      API_ENDPOINTS.USERS.ROLES(userId)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch user roles');
        }
        console.log("response",response.data);
        return response.data || [];
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
    console.log("updateUserRoles",roleIds)
    this.configService.log('Updating user roles', { userId, roleIds });

    const dto: UpdateUserRolesDto = { userId, roleIds };

    return this.apiService.putWithAuth<ApiResponse<any>>(
      API_ENDPOINTS.USERS.UPDATE_ROLES(userId),
      dto
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to update user roles');
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

    return this.apiService.postWithAuth<PagedResponse<RoleDto>>(
      API_ENDPOINTS.ROLES.BASE + '/GetRolesWithPagination',
      request
    ).pipe(
      tap(response => {
        if (response.succeeded && response.data) {
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

    return this.apiService.postWithAuth<ApiResponse<PaginatedList<RoleDto>>>(
      API_ENDPOINTS.ROLES.PAGINATED,
      paginationRequest
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to fetch roles');
        }
        return response.data.items || [];
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
    return this.apiService.getWithAuth<ApiResponse<RoleDto[]>>(
      API_ENDPOINTS.ROLES.BASE
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch roles');
        }
        return response.data || [];
      })
    );
  }

  /**
   * Get application entities linked to a role
   */
  getApplicationEntitiesByRole(roleId: string): Observable<number[]> {
    this.configService.log('Fetching application entities for role', { roleId });
    // Backend expects roleId in path: /Roles/getApplicationentities/{roleId}
    return this.apiService.getWithAuth<ApiResponse<RoleApplicationEntityLinkDto[]>>(
      API_ENDPOINTS.ROLES.APPLICATION_ENTITIES_BY_ROLE(roleId)
    ).pipe(
      map(response => {
        if (response?.succeeded && Array.isArray(response.data)) {
          return response.data.map(x => x.applicationEntityId);
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

    return this.apiService.getWithAuth<ApiResponse<RoleDto>>(
      API_ENDPOINTS.ROLES.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to fetch role');
        }
        return response.data;
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

    return this.apiService.postWithAuth<ApiResponse<RoleDto>>(
      API_ENDPOINTS.ROLES.BASE,
      role
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to create role');
        }
        return response.data;
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

    return this.apiService.putWithAuth<ApiResponse<RoleDto>>(
      API_ENDPOINTS.ROLES.BY_ID(id),
      { ...role, id }
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to update role');
        }
        return response.data;
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

    return this.apiService.deleteWithAuth<ApiResponse<any>>(
      API_ENDPOINTS.ROLES.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to delete role');
        }
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

    return this.apiService.getWithAuth<ApiResponse<PermissionDto[]>>(
      API_ENDPOINTS.ROLES.PERMISSIONS(roleId)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch role permissions');
        }
        return response.data || [];
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

    return this.apiService.getWithAuth<ApiResponse<CrudPermission[]>>(
      API_ENDPOINTS.ROLES.PERMISSIONS(roleId)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch permissions');
        }
        return response.data || [];
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

    return this.apiService.getWithAuth<ApiResponse<CrudPermission[]>>(
      API_ENDPOINTS.ROLES.CRUD_PERMISSIONS(roleId)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch CRUD permissions');
        }
        return response.data || [];
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
  assignPermissionsToRole(roleId: string, permissions: string[]): Observable<boolean> {
    this.configService.log('Assigning permissions to role', { roleId, permissions });

    const assignPermissionsDto: AssignPermissionsDto = {
      entityId: roleId,
      permissionsList: permissions
    };

    return this.apiService.postWithAuth<ApiResponse<boolean>>(
      API_ENDPOINTS.ROLES.ASSIGN_PERMISSIONS,
      assignPermissionsDto
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to assign permissions');
        }
        return response.data;
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

    return this.apiService.getWithAuth<ApiResponse<any[]>>(
      endpoint
    ).pipe(
      map((response: any) => {
        console.log('Raw API Response:', response);
        console.log('Response type:', typeof response);
        console.log('Response succeeded:', response?.succeeded);
        console.log('Response data:', response?.data);
        
        // Handle different response formats
        // Case 1: Standard ApiResponse with succeeded flag
        if (response && typeof response === 'object') {
          if ('succeeded' in response) {
            if (!response.succeeded) {
              throw new Error(response.message || 'Failed to fetch application entities');
            }
            // Data might be directly in response.data or response.data could be an array
            const entities = response.data || response;
            return Array.isArray(entities) ? entities : (Array.isArray(response.data) ? response.data : []);
          }
          // Case 2: Direct array response
          if (Array.isArray(response)) {
            return response;
          }
          // Case 3: Response has data property that's an array
          if (response.data && Array.isArray(response.data)) {
            return response.data;
          }
        }
        
        // Default: return empty array if format is unexpected
        console.warn('Unexpected response format, returning empty array');
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

    return this.apiService.getWithAuth<ApiResponse<UserInRoleDto[]>>(
      API_ENDPOINTS.ROLES.USERS_IN_ROLE(roleId)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch users in role');
        }
        return response.data || [];
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

    return this.apiService.postWithAuth<ApiResponse<boolean>>(
      API_ENDPOINTS.ROLES.USERS_IN_ROLE(roleId),
      { userIds }
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to remove users from role');
        }
        return response.data;
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

