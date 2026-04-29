import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ApiService } from '../api.service';
import { ConfigService } from '../config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { UserInRoleDto } from '@models/backend-user.model';
import { ErrorHandler } from '@utils/error-handler.utils';

/**
 * Role Members API Service
 *
 * Single responsibility: read the users that belong to a role and
 * remove members from a role.
 *
 * For assigning roles to a single user, see {@link UserRolesApiService}.
 */
@Injectable({
  providedIn: 'root'
})
export class RoleMembersApiService {
  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService
  ) {}

  getUsersInRole(roleId: string): Observable<UserInRoleDto[]> {
    this.configService.log('Fetching users in role', { roleId });

    return this.apiService.get<UserInRoleDto[]>(API_ENDPOINTS.ROLES.USERS_IN_ROLE(roleId)).pipe(
      map(data => data || []),
      catchError(error => {
        this.configService.logError('Failed to fetch users in role', error);
        return throwError(() => new Error(error.userMessage || 'Failed to fetch users in role'));
      })
    );
  }

  removeUsersFromRole(roleId: string, userIds: string[]): Observable<boolean> {
    this.configService.log('Removing users from role', { roleId, userIds });

    return this.apiService.post<boolean>(
      API_ENDPOINTS.ROLES.USERS_IN_ROLE(roleId),
      { userIds }
    ).pipe(
      map(succeeded => !!succeeded),
      tap(() => this.configService.log('Users removed from role successfully')),
      catchError(error => {
        this.configService.logError('Failed to remove users from role', error);
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to remove users from role');
        return throwError(() => new Error(errorMessage));
      })
    );
  }
}
