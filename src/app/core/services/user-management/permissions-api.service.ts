import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ApiService } from '../api.service';
import { ConfigService } from '../config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import {
  AssignPermissionsDto,
  CrudPermission,
  PermissionDto
} from '@models/backend-user.model';

/**
 * Permissions API Service
 *
 * Single responsibility: read role permissions (plain or CRUD) and
 * persist permission assignments to a role.
 *
 * For role definitions, see {@link RolesApiService}.
 */
@Injectable({
  providedIn: 'root'
})
export class PermissionsApiService {
  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService
  ) {}

  /** Permissions for a role in their raw form. */
  getRolePermissions(roleId: string): Observable<PermissionDto[]> {
    this.configService.log('Fetching role permissions', { roleId });

    return this.apiService.get<PermissionDto[]>(API_ENDPOINTS.ROLES.PERMISSIONS(roleId)).pipe(
      map(permissions => permissions || []),
      catchError(error => {
        this.configService.logError('Failed to fetch role permissions', error);
        return throwError(() => new Error(error.userMessage || 'Failed to fetch role permissions'));
      })
    );
  }

  /** Same endpoint as {@link getRolePermissions}, typed as {@link CrudPermission}. */
  getPlainPermissionsForRole(roleId: string): Observable<CrudPermission[]> {
    this.configService.log('Fetching plain permissions for role', { roleId });

    return this.apiService.get<CrudPermission[]>(API_ENDPOINTS.ROLES.PERMISSIONS(roleId)).pipe(
      map(permissions => permissions || []),
      catchError(error => {
        this.configService.logError('Failed to fetch plain permissions', error);
        return throwError(() => new Error(error.userMessage || 'Failed to fetch permissions'));
      })
    );
  }

  /** CRUD-shaped permissions endpoint (different backend route). */
  getCrudPermissionsForRole(roleId: string): Observable<CrudPermission[]> {
    this.configService.log('Fetching CRUD permissions for role', { roleId });

    return this.apiService.get<CrudPermission[]>(API_ENDPOINTS.ROLES.CRUD_PERMISSIONS(roleId)).pipe(
      map(permissions => permissions || []),
      catchError(error => {
        this.configService.logError('Failed to fetch CRUD permissions', error);
        return throwError(() => new Error(error.userMessage || 'Failed to fetch CRUD permissions'));
      })
    );
  }

  assignPermissionsToRole(
    roleId: string,
    permissions: string[]
  ): Observable<{ data: boolean; message: string }> {
    this.configService.log('Assigning permissions to role', { roleId, permissions });

    const dto: AssignPermissionsDto = {
      entityId: roleId,
      permissionsList: permissions
    };

    return this.apiService.postRaw<boolean>(API_ENDPOINTS.ROLES.ASSIGN_PERMISSIONS, dto).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to assign permissions');
        }
        return {
          data: response.data ?? false,
          message: response.message || 'Permissions assigned successfully.'
        };
      }),
      tap(() => this.configService.log('Permissions assigned successfully')),
      catchError(error => {
        this.configService.logError('Failed to assign permissions', error);
        return throwError(() => new Error(error.userMessage || 'Failed to assign permissions'));
      })
    );
  }
}
