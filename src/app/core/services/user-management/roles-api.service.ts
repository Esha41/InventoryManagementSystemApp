import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ApiService } from '../api.service';
import { ConfigService } from '../config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import {
  CreateRoleDto,
  RoleApplicationEntityLinkDto,
  RoleDto,
  UpdateRoleDto
} from '@models/backend-user.model';
import { PagedRequest, PagedResponse, PaginatedList } from '@models/api-response.model';

import { normalizeRole } from './user-normalizer.util';

@Injectable({
  providedIn: 'root'
})
export class RolesApiService {
  private readonly rolesSubject = new BehaviorSubject<RoleDto[]>([]);
  readonly roles$ = this.rolesSubject.asObservable();

  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService
  ) {}

  /** Snapshot of the currently cached roles list. */
  get currentRoles(): RoleDto[] {
    return this.rolesSubject.value;
  }

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
        return throwError(() => new Error(error.userMessage || 'Failed to fetch roles'));
      })
    );
  }

  /** Fetches all roles via the paginated endpoint (large pageSize). */
  getRoles(): Observable<RoleDto[]> {
    this.configService.log('Fetching all roles');

    const paginationRequest = { page: 1, pageSize: 1000 };

    return this.apiService.post<PaginatedList<RoleDto>>(
      API_ENDPOINTS.ROLES.PAGINATED,
      paginationRequest
    ).pipe(
      map(data => {
        if (!data) {
          throw new Error('Failed to fetch roles');
        }
        return (data.items || []).map(normalizeRole);
      }),
      tap(roles => {
        this.rolesSubject.next(roles);
        this.configService.log(`Fetched ${roles.length} roles`);
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch roles', error);
        return throwError(() => new Error(error.userMessage || 'Failed to fetch roles'));
      })
    );
  }

  /** Lightweight GET /Roles (no pagination). */
  getAllRolesSimple(): Observable<RoleDto[]> {
    this.configService.log('Fetching all roles (simple)');
    return this.apiService.get<RoleDto[]>(API_ENDPOINTS.ROLES.BASE).pipe(
      map(roles => (roles || []).map(normalizeRole))
    );
  }

  /** Returns just the application-entity IDs linked to a role. */
  getApplicationEntitiesByRole(roleId: string): Observable<number[]> {
    this.configService.log('Fetching application entities for role', { roleId });
    return this.apiService.get<RoleApplicationEntityLinkDto[]>(
      API_ENDPOINTS.ROLES.APPLICATION_ENTITIES_BY_ROLE(roleId)
    ).pipe(
      map(data => Array.isArray(data) ? data.map(x => x.applicationEntityId) : [])
    );
  }

  getRoleById(id: string): Observable<RoleDto> {
    this.configService.log('Fetching role', { id });

    return this.apiService.get<RoleDto>(API_ENDPOINTS.ROLES.BY_ID(id)).pipe(
      map(role => {
        if (!role) {
          throw new Error('Failed to fetch role');
        }
        return role;
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch role', error);
        return throwError(() => new Error(error.userMessage || 'Failed to fetch role'));
      })
    );
  }

  createRole(role: CreateRoleDto): Observable<RoleDto> {
    this.configService.log('Creating role', { name: role.name });

    return this.apiService.post<RoleDto>(API_ENDPOINTS.ROLES.BASE, role).pipe(
      map(newRole => {
        if (!newRole) {
          throw new Error('Failed to create role');
        }
        return newRole;
      }),
      tap(newRole => {
        this.rolesSubject.next([...this.rolesSubject.value, newRole]);
        this.configService.log('Role created successfully', { id: newRole.id });
      }),
      catchError(error => {
        this.configService.logError('Failed to create role', error);
        return throwError(() => new Error(error.userMessage || 'Failed to create role'));
      })
    );
  }

  updateRole(id: string, role: UpdateRoleDto): Observable<RoleDto> {
    this.configService.log('Updating role', { id });

    return this.apiService.put<RoleDto>(API_ENDPOINTS.ROLES.BY_ID(id), { ...role, id }).pipe(
      map(updatedRole => {
        if (!updatedRole) {
          throw new Error('Failed to update role');
        }
        return updatedRole;
      }),
      tap(updatedRole => {
        const current = this.rolesSubject.value;
        const index = current.findIndex(r => r.id === id);
        if (index !== -1) {
          const next = [...current];
          next[index] = updatedRole;
          this.rolesSubject.next(next);
        }
        this.configService.log('Role updated successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to update role', error);
        return throwError(() => new Error(error.userMessage || 'Failed to update role'));
      })
    );
  }

  deleteRole(id: string): Observable<boolean> {
    this.configService.log('Deleting role', { id });

    return this.apiService.delete<unknown>(API_ENDPOINTS.ROLES.BY_ID(id)).pipe(
      map(() => true),
      tap(() => {
        this.rolesSubject.next(this.rolesSubject.value.filter(r => r.id !== id));
        this.configService.log('Role deleted successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to delete role', error);
        return throwError(() => new Error(error.userMessage || 'Failed to delete role'));
      })
    );
  }
}
